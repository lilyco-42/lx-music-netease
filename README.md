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
  core/               平台无关内核：PlatformAdapter、统一数据模型、签名算法、音源注册表
  platform-desktop/   桌面端实现：node:crypto / node:zlib / fetch
  tokens/             设计令牌：实测色值、布局、圆角、字号 + Tailwind preset
apps/
  desktop/            Vue3 + Vite + Tailwind v4 + shadcn-vue（已实现）
  mobile/             (计划) React Native + react-native-reusables
```

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
Test Files  2 passed (2)
     Tests  24 passed (24)
```

其中 `tests/wy-crypto.test.ts` 用**独立的逐字转写参考实现**（直接走 `node:crypto` + `Buffer`，不经 PlatformAdapter）比对，证明移植后的 `eapi` / `linuxapi` 输出与上游字节完全相同。

## 构建

**不在本机编译**——所有构建走 GitHub Actions：

- [`ci.yml`](./.github/workflows/ci.yml) — packages 构建/类型检查/测试 + 桌面端构建
- [`tokens.yml`](./.github/workflows/tokens.yml) — 设计令牌校验

本机只做代码编写与提交，产物从 Actions artifacts 下载（`lxmn-packages`、`lxmn-desktop-dist`）。

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
