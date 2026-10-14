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
  mobile/             React Native 0.76 + NativeWind
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
Test Files  5 passed (5)
     Tests  112 passed (112)
```

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

## 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面 UI | Vue 3 + **shadcn-vue** + Tailwind v4 | 与 lx-music-desktop 同为 Vue3；shadcn-vue 是 MIT，复制粘贴式组件，便于改造成网易云风格 |
| 移动 UI | React Native + **react-native-reusables** | shadcn 的 RN 移植，MIT |
| 参考蓝本 | [YesPlayMusic](https://github.com/qier222/YesPlayMusic) (MIT, 33.4k★) | UI 最接近网易云，许可证宽松，同为 Electron |

### 已知摩擦点

- lx-music-desktop 用 **Less + Pug + Webpack**，shadcn-vue 需要 **Tailwind** → 需引入 Tailwind 并与 Less 共存
- lx-music-mobile 是 **RN 0.73.11**，react-native-reusables 要求 **reanimated 4.x (RN 0.86+)** → 移动端要么升级 RN，要么用旧版 reusables 组件手工适配

## 设计依据

配色、布局、圆角、字号全部来自对参考截图的像素级实测，见 [DESIGN.md](./DESIGN.md)。

## 许可证

Apache-2.0。本项目基于 lx-music (Apache-2.0) 的 UI 重制。