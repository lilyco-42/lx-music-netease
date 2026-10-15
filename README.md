# lx-music-netease

LX Music 的**网易云音乐风格 UI 重制版**，并把桌面端与移动端重复的核心逻辑抽取为共享内核。

> 仅复刻视觉风格与交互结构。**不包含**网易云音乐的 logo、名称或任何品牌资产（详见 [DESIGN.md](./DESIGN.md) 第十节）。

## 为什么可行（实测依据）

对 [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) 与 [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) 的 `musicSdk/`（音乐源适配层）做 SHA-256 字节级比对：

| 结果 | 数量 |
|---|---|
| **字节级完全相同** | **34** |
| 有差异 | 18 |
| 单侧独有 | 14 |

差异 **100%** 集中在平台垫片：桌面用 `node:crypto` / `node:zlib`，移动用 `nativeModules/crypto` 与 `react-native-background-timer`。业务逻辑同源。

**结论**：共享内核的基础已经存在，缺的只是把它正式抽成包 + 定义平台边界。

## 架构

```
packages/
  core/               平台无关内核：PlatformAdapter、统一数据模型、签名算法、音源注册表、会员订阅
  platform-desktop/   桌面端实现：node:crypto / node:zlib / fetch
  platform-mobile/    移动端实现：纯 JS 加密 + RN fetch + AsyncStorage（无原生加密模块）
  tokens/             设计令牌：实测色值、布局、圆角、字号 + Tailwind preset
apps/
  desktop/            Vue3 + Vite + Tailwind v4 + shadcn-vue + Electron
  mobile/             React Native 0.76（纯 View/Text/StyleSheet，未用 NativeWind）
```

### 全平台兼容是怎么做到的

内核里所有加密都是**纯 JavaScript**（`packages/core/src/crypto/`）：
MD5、SHA-1、AES-128 CBC/ECB、RSA（BigInt + 手写 DER 解析）。
它们与 `node:crypto` **逐字节一致**，有 54 个测试为证。

好处是移动端不再需要 `react-native-quick-md5` 和自写的
`NativeModules.CryptoModule`——那两个原生模块原本要为 iOS / Android 各维护一份。
现在同一份 `@lxmn/core` 在桌面、移动、浏览器、测试环境都能直接跑。

平台差异通过 `PlatformAdapter` 接口注入（`setPlatform`），业务代码只依赖接口：

```ts
import { getPlatform } from '@lxmn/core'

const { crypto, compress, http } = getPlatform()
```

### 关键设计：暴露「原语」而非「业务函数」

`CryptoAdapter` 刻意提供 `aesEncrypt(data, mode, key, iv)` / `rsaEncrypt` / `randomBytes` 这类**原始能力**，而不是 `weapi()` 这类业务函数。原因：两端签名算法完全一致，差异只在 `createCipheriv` / `publicEncrypt` 的调用方式上。把原语抽出来，网易云的 eapi / weapi / linuxapi 签名算法就能 **100% 共用同一份代码**。

## 已移植的音源

上游的取流接口**全部已失效**，所以每个音源的取流部分都是重写的：
`kw/api-temp.js` 指向 `tm.tempmusics.tk`、`wy/bd/kg/mg/tx/api-test.js` 指向
`ts.tempmusics.tk`，两个域名都已 DNS 失效；桌面端 `api-source.js` 里所有内置
`getMusicUrl` 也早已被注释掉。每个音源都重新找到了仍在服务的端点并重写了解析。

| id | 名称 | 搜索 | 取流 | 歌词 | 封面 | 实测情况 |
|---|---|---|---|---|---|---|
| `wy` | 网易云音乐 | ✅ | ✅ | ✅ | ✅ | 起风了 8/10 可播；VIP 曲目 `fee:1` 返回 `code:200`+`url:null` |
| `kw` | 酷我音乐 | ✅ | ✅ | ✅ | ✅ | total=3564，5/5 拿到真实音频；flac 无权限，降级 mp3 |
| `mg` | 咪咕音乐 | ✅ | ✅ | ✅ | ✅ | total=191，3/5 可播（另 2 首版权下架）、28/28 有歌词 |
| `kg` | 酷狗音乐 | ✅ | ✅ | ✅ | ✅ | 轻音乐 5/10 可播、9/10 有歌词；**只声明 128k**（见下） |
| `tx` | QQ 音乐 | ✅ | ❌ | — | — | 播放**全部**返回 `104003`+`purl` 空，需登录 QQ 账号，已放弃 |
| `bd` `xm` | 百度 / 虾米 | — | — | — | — | 服务已停止 |

**搜索是聚合的**：四个源并发查、按 `(source, songmid)` 去重后合并。
实测搜「起风了」：wy 329 + kw 3564 + mg 192 + kg 480 = 4565，去重后 59 条。
只查 wy 会把另外三家的曲库白白丢掉，而 wy 上大量 VIP 曲目本来就拿不到地址。

> `kg` 的音质**刻意只声明 128k**：搜索结果里 128k/320k/flac 三种 hash 都齐全，
> 但免费端点对**所有** hash 一律只回 128k 的 mp3（`bitRate=128`、`extName=mp3`），
> 请求 HQ/SQ 的 hash 拿到的地址字节完全相同。声明得比实际少是诚实的，反过来不是。

### 网易云音乐（`wy`）

对应 lx-music-desktop 的 `musicSdk/wy/`，算法逐行移植且**输出字节与上游一致**（有测试为证）：

| 能力 | 状态 |
|---|---|
| `weapi`（AES-128-CBC 双层 + RSA 无填充） | ✅ |
| `linuxapi`（AES-128-ECB） | ✅ |
| `eapi`（AES-128-ECB + md5 校验段） | ✅ |
| `eapiDecrypt` | ✅ |
| `getMusicUrl` / `getLyric` / `getPic` | ✅ |

**保留了 lx-music 的自定义音源能力**：`setMusicUrlProvider()` 允许宿主注入自己的取地址实现，原 `apis('wy')` 的间接层被换成显式注入。

## 测试

```
Test Files  10 passed | 5 skipped (15)
     Tests  179 passed | 6 skipped (185)
```

跳过的都是**联网测试**（`live-*.test.ts`、`multi-source.test.ts`），
需要 `LIVE=1 pnpm vitest run` 才跑 —— 网络抖动不该让构建无故变红。

其中 `tests/wy-crypto.test.ts` 用**独立的逐字转写参考实现**（直接走 `node:crypto` + `Buffer`，不经 PlatformAdapter）比对，证明移植后的 `eapi` / `linuxapi` 输出与上游字节完全相同。

## 构建

**不在本机编译**——所有构建走 GitHub Actions：

- [`ci.yml`](./.github/workflows/ci.yml) — packages 构建/类型检查/测试 + 桌面端构建
- [`tokens.yml`](./.github/workflows/tokens.yml) — 设计令牌校验
- [`release.yml`](./.github/workflows/release.yml) — **全平台安装包**（Windows / macOS / Android / iOS / Linux）

本机只做代码编写与提交，产物从 Actions artifacts 与 GitHub Release 下载。

## 下载与发布

打 tag 即触发全平台构建并发布到 GitHub Release：

```bash
git tag v0.1.0 && git push origin v0.1.0
# 或手动触发
gh workflow run release.yml
```

| 平台 | 产物 | 说明 |
|---|---|---|
| Windows | `*-windows-setup.exe` / `*.msi` / portable | 未签名，SmartScreen 会提示 |
| macOS | `*.dmg`（x64 + arm64） | 未签名，首次打开需右键 → 打开 |
| Android | `*.apk` | 直接侧载安装 |
| iOS | `LX-Music-unsigned.ipa` | 未签名，需自签或 AltStore 侧载 |
| Linux | `*.AppImage` | `chmod +x` 后运行 |

Android 默认用模板自带的 debug keystore 签名（可直接安装）；
配置 `LXMN_KEYSTORE_*` secrets 后自动切换为正式签名。

## 会员与音源订阅

商业模式：**用积分购买会员，会员解锁全部第三方音源**。

1. 打开 <https://lain42.top/shop/>，用积分购买「音乐会员 · 年卡」（**88 元 / 年**）
2. 在「我的账户」复制订阅链接
3. 客户端「会员」页粘贴链接 → 激活
4. 全部音源（wy / tx / kw / kg / mg / bd / xm）自动补全

服务端 `GET /api/music/sub/<token>` 下发订阅文档：

```json
{
  "ok": true,
  "schema": 1,
  "plan": { "id": "music_annual", "name": "音乐会员 · 年卡", "expires_at": "2027-10-14T22:56:37" },
  "sources": [{ "id": "wy", "name": "网易云音乐", "type": "builtin", "qualitys": ["flac", "320k"] }],
  "signature": "…64 位 sha256…"
}
```

桌面端「音乐会员」页与移动端「会员」页共用 `SubscriptionClient`，
协议与缓存逻辑完全一致。

客户端行为：

- 缓存订阅，**离线也能保持已激活状态**
- 到期后自动降级，并提示续费
- `script` 类型音源默认**不执行**，需用户显式同意（安全默认值）

## 发布与下载

所有安装包由 [`.github/workflows/release.yml`](./.github/workflows/release.yml) 在 GitHub Actions 上构建，
**不在本机编译**。五个平台各自一个 job，全部 `continue-on-error`，任何一个挂了不影响其它平台出包。

| 平台 | 产物 | 说明 |
|---|---|---|
| Windows | `LX.Music-<版本>-windows-setup.exe` / `.msi` / `-x64-portable.exe` | 安装向导 / MSI 静默 / 免安装 |
| macOS | `LX.Music-<版本>-macos-x64.dmg` / `-arm64.dmg` | 未签名，首次打开需右键 → 打开 |
| Linux | `LX.Music-<版本>-linux-x86_64.AppImage` | `chmod +x` 后直接运行 |
| Android | `LX.Music-<版本>-android-universal.apk` | 侧载安装；debug 签名 |
| iOS | `LX.Music-<版本>-ios-unsigned.ipa` | 未签名，需自行签名或用 AltStore 侧载 |

发布同时把产物同步到 `https://lain42.top/downloads/`（含 `SHA256SUMS.txt`），
并幂等登记进下载页的 `manifest.json`。

### iOS 链接失败的那次踩坑

`react-native-track-player` 的 podspec 写的是 `swift_version = 4.2`，编译出的 `.o`
会 autolink 到 `libswiftCompatibility56`，链接期报 `Undefined symbols`。

社区普遍说是「Xcode 26 删掉了这个库」。**实测不是**：库还在，只存在于
**工具链**目录 `<Xcode>/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/iphoneos/`；
SDK 目录 `<iPhoneOS.sdk>/usr/lib/swift/` 下只有 `.tbd` 桩文件。

本 app target 是纯 Objective-C（`AppDelegate.mm` / `main.m`，没有任何 `.swift`），
Xcode 据此判定它不是 Swift target，就不往 `LIBRARY_SEARCH_PATHS` 里塞工具链的
swift 目录 —— 于是链接器根本没被告诉去哪里找。报的 `Undefined symbols` 是结果，不是原因。

修复：`Podfile` 的 `post_install` 里给 user project 每个 target 补上
`$(TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)`，`release.yml` 里再显式传一遍。

## 会员与音源订阅

会员走**积分购买**：`https://lain42.top/shop/` 用积分购买「音乐会员 · 年卡」（¥88 / 88 积分），
购买后在「我的账户」领取订阅链接，填进客户端「会员」页即可一键补全全部第三方音源。

服务端 `GET /studio/api/music/sub/<token>` 下发订阅文档（实测返回）：

```json
{
  "ok": true,
  "plan": { "id": "music_annual", "name": "音乐会员 · 年卡", "expires_at": "2027-10-15T10:03:23", "active": true },
  "implemented_sources": ["kg", "kw", "mg", "wy"],
  "sources": [
    { "id": "wy", "name": "网易云音乐", "qualitys": ["master","atmos","hires","flac24bit","flac","320k","128k"], "implemented": true },
    { "id": "tx", "name": "QQ 音乐",   "qualitys": ["flac","320k","128k"], "implemented": false },
    { "id": "kg", "name": "酷狗音乐", "qualitys": ["128k"], "implemented": true }
  ],
  "signature": "…64 位 sha256…"
}
```

`implemented` 是**客户端内核里真的实现了取流**的标记，界面据此区分「订阅包含」与
「本次真正可用」—— 只有 `implemented: true` 的源才会被标成已解锁，不谎报。

## 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面 UI | Vue 3 + **shadcn-vue** + Tailwind v4 | 与 lx-music-desktop 同为 Vue3；shadcn-vue 是 MIT，复制粘贴式组件，便于改造成网易云风格 |
| 移动 UI | React Native + 手写 StyleSheet | react-native-reusables 要求 reanimated 4.x（RN 0.86+），本项目 RN 0.76 装不上，故直接用原生 View/Text/StyleSheet |
| 参考蓝本 | [YesPlayMusic](https://github.com/qier222/YesPlayMusic) (MIT, 33.4k★) | UI 最接近网易云，许可证宽松，同为 Electron |

### 已知摩擦点

- lx-music-desktop 用 **Less + Pug + Webpack**，shadcn-vue 需要 **Tailwind** → 本项目从零搭 Vite + Tailwind，不再继承旧构建链
- lx-music-mobile 是 **RN 0.73.11**，react-native-reusables 要求 **reanimated 4.x (RN 0.86+)** → 移动端放弃 reusables，直接用原生 `View`/`Text`/`StyleSheet`

## 设计依据

配色、布局、圆角、字号全部来自对参考截图的像素级实测，见 [DESIGN.md](./DESIGN.md)。

## 许可证

Apache-2.0。本项目基于 lx-music (Apache-2.0) 的 UI 重制。