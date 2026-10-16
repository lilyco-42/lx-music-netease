import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * 应用身份守卫：包名 / Bundle ID / 启动图标。
 *
 * 背景：这些东西散落在各平台工程文件里，很容易「改了一半」：
 *  - iOS 的 PRODUCT_BUNDLE_IDENTIFIER 一直是 React Native 模板默认的
 *    org.reactjs.native.example.*，而 Android 和桌面端用的是 top.lain42.lycomusic
 *  - iOS 的 AppIcon.appiconset 长期只有 Contents.json、一个图标文件都没有
 *  - Android 的 ic_launcher 还是 RN 模板里的安卓机器人
 * 结果就是「商店列表里是黑胶图标、装到手机上却是模板图标」。
 * 所以把身份信息也写成断言，改漏了直接红。
 */

const repo = fileURLToPath(new URL('..', import.meta.url))
const read = (rel: string) => readFileSync(repo + '/' + rel, 'utf8')
const abs = (rel: string) => repo + '/' + rel

const APP_ID = 'top.lain42.lycomusic'

/** 只读 PNG 的 IHDR，避免为了测尺寸引入图像库依赖 */
function pngSize(rel: string): { width: number; height: number } {
  const buf = readFileSync(abs(rel))
  expect(buf.subarray(1, 4).toString('ascii'), rel + ' 不是 PNG').toBe('PNG')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe('应用身份：包名与 Bundle ID', () => {
  const pbx = read('apps/mobile/ios/LycoMusic.xcodeproj/project.pbxproj')

  it('iOS 工程里没有 React Native 模板的 Bundle ID 残留', () => {
    expect(pbx).not.toContain('org.reactjs.native.example')
  })

  it('iOS app target 用的是品牌 Bundle ID', () => {
    const blocks = pbx.split('PRODUCT_BUNDLE_IDENTIFIER = ')
    const appIds: string[] = []
    for (const b of blocks.slice(1)) {
      const id = b.slice(0, b.indexOf(';'))
      const tail = b.slice(0, 400)
      if (tail.includes('PRODUCT_NAME = LycoMusic;')) appIds.push(id)
    }
    expect(appIds.length).toBe(2) // Debug + Release
    for (const id of appIds) expect(id).toBe(APP_ID)
  })

  it('iOS 测试 target 用同名子域，不与 app 冲突', () => {
    expect(pbx).toContain('PRODUCT_BUNDLE_IDENTIFIER = ' + APP_ID + '.tests;')
  })

  it('Android applicationId 与桌面 appId 同为 ' + APP_ID, () => {
    const gradle = read('apps/mobile/android/app/build.gradle')
    const eb = read('apps/desktop/electron-builder.yml')
    expect(gradle).toContain('applicationId "' + APP_ID + '"')
    expect(gradle).toContain('namespace "' + APP_ID + '"')
    expect(eb).toContain('appId: ' + APP_ID)
  })
})

describe('应用身份：启动图标', () => {
  it('iOS AppIcon 每个声明的槽位都有对应文件，尺寸正确', () => {
    const dir = 'apps/mobile/ios/LycoMusic/Images.xcassets/AppIcon.appiconset/'
    const contents = JSON.parse(read(dir + 'Contents.json')) as {
      images: { idiom: string; size: string; scale: string; filename?: string }[]
    }
    expect(contents.images.length).toBeGreaterThanOrEqual(9)
    for (const img of contents.images) {
      expect(img.filename, img.idiom + ' ' + img.size + ' 缺少 filename').toBeTruthy()
      expect(existsSync(abs(dir + img.filename)), img.filename + ' 文件不存在').toBe(true)
      const px = Number(img.size.split('x')[0]) * Number(img.scale.replace('x', ''))
      const actual = pngSize(dir + img.filename!)
      expect(actual).toEqual({ width: px, height: px })
    }
    // iOS 图标不能带 alpha 通道：必须是 RGB（PNG 颜色类型 2）
    const buf = readFileSync(abs(dir + 'AppIcon-1024x1024@1x.png'))
    expect(buf[25], 'iOS 图标应为 RGB（颜色类型 2），不能带透明通道').toBe(2)
  })

  it('Android 五种密度的方形/圆形启动图标尺寸正确，且不再是模板图标', () => {
    const sizes: Record<string, number> = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
    for (const [density, px] of Object.entries(sizes)) {
      const base = 'apps/mobile/android/app/src/main/res/mipmap-' + density + '/'
      for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
        expect(existsSync(abs(base + name)), base + name + ' 不存在').toBe(true)
        expect(pngSize(base + name)).toEqual({ width: px, height: px })
      }
    }
  })

  it('两端的启动图标取自同一张商店母图', () => {
    // 圆角方形的黑胶母图是唯一来源；图标变了这里也要跟着变
    const master = 'store-assets/icon/lyco_music_icon_1024.png'
    expect(existsSync(abs(master))).toBe(true)
    expect(pngSize(master)).toEqual({ width: 1024, height: 1024 })
  })

  it('桌面端有 electron-builder 需要的图标文件', () => {
    const icon = 'apps/desktop/build/icon.png'
    expect(existsSync(abs(icon))).toBe(true)
    expect(pngSize(icon)).toEqual({ width: 1024, height: 1024 })
  })
})
