/**
 * electron-builder afterPack 钩子：给 macOS 的 .app 做 ad-hoc 签名。
 *
 * 为什么需要这个钩子：
 *
 * electron-builder 在没有可用证书时**不会**退化成 ad-hoc 签名，而是
 * 直接 return false 什么都不做（见 app-builder-lib/out/macPackager.js
 * 里 "identity == null && !options.sign" 那条分支）。结果是 .app 完全
 * 没有签名。未签名的 .app 在 Apple Silicon 上会被 Gatekeeper 拒绝执行，
 * 用户双击看到的是「已损坏，无法打开」，而不是可以绕过的那句
 * 「无法验证开发者」。
 *
 * 也不能靠 identity: '-' 解决：那个值会被当成证书名字丢给
 * findIdentity() 去 keychain 里匹配，CI 的 keychain 是空的，照样匹配不到。
 *
 * 所以这里在打包完成后自己调 codesign --sign -（ad-hoc），
 * 保证 bundle 完整性可校验。**这仍然不是 Developer ID 签名，
 * 也不代表 Gatekeeper 信任**，用户首次打开仍需右键 → 打开。
 *
 * 时序：platformPackager.doPack 里 afterPack 在第 245 行、
 * doSignAfterPack 在第 251 行。identity 为 null 时后者什么都不做，
 * 因此这里签好的签名不会被覆盖。
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

/**
 * 跑一个命令并同时拿到 stdout 与 stderr。
 *
 * 用 spawnSync 而不是 execFileSync：后者只返回 stdout，而 codesign
 * 的 --display / --verify 结果全部写在 **stderr** 上。早期版本用
 * execFileSync 导致「Signature=」后面永远是空的 —— 日志看着像成功了，
 * 其实什么都没打印出来，等于没有证据。
 */
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  if (r.error) throw r.error
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' }
}

function must(cmd, args) {
  const r = run(cmd, args)
  if (r.code !== 0) {
    throw new Error(cmd + ' ' + args.join(' ') + ' 失败（exit ' + r.code + '）:\n' + r.err)
  }
  return r
}

exports.default = async function afterPack(context) {
  // 只处理 macOS；Windows/Linux 上这个钩子也会被调用，直接跳过
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename + '.app'
  const appPath = path.join(context.appOutDir, appName)

  if (!fs.existsSync(appPath)) {
    throw new Error('afterPack: 找不到 .app，路径为 ' + appPath)
  }

  // 先递归清掉扩展属性。xattr 变化会让签名失效，
  // 而 electron-builder 复制文件时可能带上 com.apple.quarantine 之类。
  const x = run('xattr', ['-cr', appPath])
  if (x.code !== 0) {
    // 不致命（比如文件系统不支持 xattr），但要说出来
    console.log('[after-pack] xattr -cr 跳过（exit ' + x.code + '）: ' + x.err.trim().slice(0, 200))
  }

  // ad-hoc 签名：--sign - 表示不做证书链验证的匿名签名。
  // --force 覆盖打包过程中可能已存在的签名；--deep 一并签内嵌的
  // framework / helper（Electron 有很多个），否则外层签名会因为
  // 内层未签而校验失败。
  must('codesign', ['--force', '--deep', '--sign', '-', appPath])

  // 立刻校验，别把坏包发出去。--strict 会检查 bundle 结构与资源封印，
  // 这是「签名是否真的可用」唯一可信的判据。
  const v = must('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])

  // 读出真实签名信息作为证据。--display 的输出在 stderr 上。
  const d = must('codesign', ['--display', '--verbose=2', appPath])
  const text = d.err + d.out
  const sig = (text.split('\n').find(l => /Signature=/.test(l)) || '').trim()
  const ident = (text.split('\n').find(l => /^Identifier=/.test(l)) || '').trim()
  const cd = (text.split('\n').find(l => /^CDHash=/.test(l)) || '').trim()

  // ad-hoc 签名的 Signature 就是 "adhoc"。如果不是，说明根本没签上，
  // 这时候宁可让构建失败，也不要发一个在 Apple Silicon 上打不开的包。
  if (!/Signature=adhoc/.test(sig)) {
    throw new Error('afterPack: 期望 ad-hoc 签名，实际是 ' + (sig || '(空)'))
  }

  console.log('[after-pack] ad-hoc signed ' + appName)
  console.log('[after-pack]   ' + sig)
  if (ident) console.log('[after-pack]   ' + ident)
  if (cd) console.log('[after-pack]   ' + cd)
  if (v.err.trim()) {
    for (const l of v.err.trim().split('\n').slice(0, 6)) console.log('[after-pack]   verify: ' + l.trim())
  }
}
