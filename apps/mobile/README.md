# LX Music · 移动端

React Native 0.76 客户端，与桌面端共用同一套内核（`@lxmn/core`）。

UI 全部用 RN 原生 `View` / `Text` / `StyleSheet` 手写，**不引入 NativeWind、
reanimated、safe-area-context 等任何需要 babel 插件或原生代码的 UI 库**。
原生依赖只有 `@react-native-async-storage/async-storage` 一个。

## 为什么不需要原生加密模块

原 lx-music-mobile 依赖 `react-native-quick-md5` 与自写的
`NativeModules.CryptoModule`（AES/RSA），需要 iOS / Android 各维护一份原生代码。

本项目把这些加密能力用**纯 JavaScript** 重写进 `@lxmn/core`，并与
`node:crypto` 逐字节比对通过（见根目录 `tests/crypto-parity.test.ts`）。
因此移动端只需注入 `fetch` 与 `AsyncStorage`，无需任何加密原生模块。

## 构建 APK

CI 负责构建，本地不需要环境：

```bash
# 打 tag 触发全平台发布
git tag v0.1.0 && git push origin v0.1.0

# 或手动触发
gh workflow run release.yml
```

产物在 GitHub Release 与 Actions artifacts 中：

| 平台 | 文件 |
| --- | --- |
| Android | `*.apk`（直接侧载） |
| iOS | `LX-Music-unsigned.ipa`（未签名，需自行签名或 AltStore） |

### 可选：正式签名

未配置时使用模板自带的 debug keystore 签名，可直接安装。
配置以下仓库 secrets 后自动改用正式签名：

```
LXMN_KEYSTORE_PATH        # 仓库内 keystore 路径，或先解码到工作区
LXMN_KEYSTORE_PASSWORD
LXMN_KEY_ALIAS
LXMN_KEY_PASSWORD
```

### iOS 说明

未签名 IPA **不能直接安装**。要装到真机需要：

1. 自备 Apple 开发者证书重新签名；或
2. 用 AltStore / Sideloadly 侧载（免费账号 7 天有效）。

必须要有 Mac + Xcode 才能构建；CI 已在 `macos-latest` 上完成这一步。

## 会员与音源订阅

1. 打开 <https://lain42.top/studio/shop/>，用积分购买「音乐会员 · 年卡」（**88 元 / 年**）
2. 在「我的账户」复制订阅链接
3. 客户端「会员」页粘贴链接 → 激活
4. 全部第三方音源自动补全，即可自由听歌

订阅文档由服务端 `/api/music/sub/<token>` 下发，包含会员到期时间与音源清单；
客户端会缓存，离线也能保持已激活状态。
