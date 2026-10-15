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
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

exports.default = async function afterPack(context) {
  // 只处理 macOS；Windows/Linux 上这个钩子也会被调用，直接跳过
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename + '.app'
  const appPath = path.join(context.appOutDir, appName)

  if (!fs.existsSync(appPath)) {
    throw new Error('afterPack: 找不到 .app，路径为 ' + appPath)
  }

  // 先递归去掉打包过程可能留下的扩展属性。xattr 变化会让签名失效，
  // 而 electron-builder 复制文件时可能带上 com.apple.quarantine 之类。
  try {
    run('xattr', ['-cr', appPath])
  } catch {
    // xattr 失败不致命（比如文件系统不支持），继续签名
  }

  // ad-hoc 签名：--sign - 表示不做证书链验证的匿名签名。
  // --force 覆盖打包过程中可能已存在的签名；--deep 一并签内嵌的
  // framework / helper（Electron 有很多个），否则外层签名会因为
  // 内层未签而校验失败。
  run('codesign', ['--force', '--deep', '--sign', '-', appPath])

  // 立刻校验，别把坏包发出去。--strict 会检查 bundle 结构与资源封印，
  // 这是「签名是否真的可用」唯一可信的判据。
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])

  // 打印签名摘要，便于在 CI 日志里确认真的签上了（而不是静默跳过）
  const info = run('codesign', ['--display', '--verbose=2', appPath])
  const line = info.split('\n').find(l => l.includes('Signature=')) || info.split('\n')[0]
  console.log('[after-pack] ad-hoc signed ' + appName + ' -> ' + String(line).trim())
}
