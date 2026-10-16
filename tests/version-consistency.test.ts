import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CORE_VERSION, APP_VERSION } from '@lxmn/core'

/**
 * 版本号一致性守卫。
 *
 * 背景：这个项目发版 tag 形如 v0.2.1-20261016，而产物文件名、Android
 * versionName、iOS MARKETING_VERSION、应用内「关于」显示的版本号各自
 * 有独立的声明点。曾经出现过「release 叫 v0.2.1、产物却叫 0.1.0、
 * 手机端还写着 1.0」的漂移 —— 用户下载到的东西和看到的东西对不上。
 *
 * 所以把「根 package.json 是唯一真相」这条规则写成测试：任何一个声明点
 * 漏改都会让 CI 红，而不是等到发版之后才发现。
 */

const repo = fileURLToPath(new URL('..', import.meta.url))
const read = (rel: string) => readFileSync(repo + '/' + rel, 'utf8')

const rootPkg = JSON.parse(read('package.json')) as { version: string }
const version = rootPkg.version

/** versionCode 必须单调递增，否则应用商店会拒绝升级包 */
const expectedCode =
  version.split('.').map(Number).reduce((acc, n, i) => acc + n * [1000000, 1000, 1][i], 0)

const workspacePackages = [
  'package.json',
  'apps/desktop/package.json',
  'apps/mobile/package.json',
  'packages/core/package.json',
  'packages/tokens/package.json',
  'packages/platform-desktop/package.json',
  'packages/platform-mobile/package.json',
]

describe('版本号一致性', () => {
  it('根 package.json 的版本是语义化三段式', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it.each(workspacePackages)('%s 与根版本一致', rel => {
    const pkg = JSON.parse(read(rel)) as { version: string }
    expect(pkg.version).toBe(version)
  })

  it('core 暴露的 CORE_VERSION / APP_VERSION 与根版本一致', () => {
    expect(CORE_VERSION).toBe(version)
    expect(APP_VERSION).toBe(version)
  })

  it('portable-platform 的兜底版本号与根版本一致', () => {
    const src = read('packages/core/src/portable-platform.ts')
    const m = src.match(/options\.version \?\? '([^']+)'/)
    expect(m, '没找到 options.version 的兜底字面量').not.toBeNull()
    expect(m![1]).toBe(version)
  })

  it('Android 默认 versionName / versionCode 与根版本一致', () => {
    const gradle = read('apps/mobile/android/app/build.gradle')
    const name = gradle.match(/versionName\(System\.getenv\("LXMN_VERSION_NAME"\) \?: "([^"]+)"\)/)
    const code = gradle.match(/versionCode\(System\.getenv\("LXMN_VERSION_CODE"\) \? System\.getenv\("LXMN_VERSION_CODE"\)\.toInteger\(\) : (\d+)\)/)
    expect(name, 'android versionName 兜底没找到').not.toBeNull()
    expect(code, 'android versionCode 兜底没找到').not.toBeNull()
    expect(name![1]).toBe(version)
    expect(Number(code![1])).toBe(expectedCode)
  })

  it('iOS MARKETING_VERSION / CURRENT_PROJECT_VERSION 与根版本一致', () => {
    const pbx = read('apps/mobile/ios/LycoMusic.xcodeproj/project.pbxproj')
    const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1])
    const build = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(m => m[1])
    // Debug / Release 两套配置都要写对
    expect(marketing.length).toBeGreaterThanOrEqual(2)
    expect(build.length).toBeGreaterThanOrEqual(2)
    for (const v of marketing) expect(v).toBe(version)
    for (const v of build) expect(Number(v)).toBe(expectedCode)
  })

  it('下载页发布脚本认的版本号来自 tag，不与 package.json 冲突', () => {
    // publish-downloads.py 从 tag 里取版本（v0.2.1-20261016 -> 0.2.1），
    // tag 的版本段必须等于 package.json，否则下载页展示的版本会错。
    const src = read('scripts/publish-downloads.py')
    expect(src).toContain("ver = tag[1:].split('-')[0]")
  })
})

describe('CI 注入的构建号', () => {
  const wf = read('.github/workflows/release.yml')

  it('Android 与 iOS 两处 versionCode 公式一致（都必须是百万量级，给 minor/patch 留足位数）', () => {
    // 只看真正参与计算的 console.log 行，注释里提到公式不算
    const codeLines = wf.split('\n').filter(l => l.includes('console.log') && l.includes('major*'))
    const formulas = codeLines
      .map(l => l.match(/major\*(\d+)\s*\+\s*minor\*(\d+)/))
      .map(m => [Number(m![1]), Number(m![2])])
    // 曾经踩过：Android 用 major*1000000+minor*1000+patch，iOS 却写成
    // major*10000+minor*100+patch，同一版本两端算出 2002 / 202 两个不同构建号。
    expect(formulas.length, 'release.yml 里应有 Android、iOS 两处构建号公式').toBe(2)
    for (const f of formulas) expect(f).toEqual([1000000, 1000])
  })

  it('CI 算出来的构建号与工程文件里的默认值一致', () => {
    expect(read('apps/mobile/android/app/build.gradle')).toContain(': ' + expectedCode + ')')
    expect(read('apps/mobile/ios/LycoMusic.xcodeproj/project.pbxproj'))
      .toContain('CURRENT_PROJECT_VERSION = ' + expectedCode + ';')
  })
})
