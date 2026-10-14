/**
 * 刻意保持最小化：只有 RN 官方 preset + 一个路径别名插件。
 *
 * 这里**不用** nativewind / reanimated 的 babel 插件——
 * 少一个 babel 变换，CI 上就少一个失败点。
 */
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '^@lxmn/core$': '../../packages/core/src/index.ts',
          '^@lxmn/platform-mobile$': '../../packages/platform-mobile/src/index.ts',
        },
      },
    ],
  ],
}
