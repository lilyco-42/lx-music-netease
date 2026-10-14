// reanimated/plugin 必须放在最后
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'nativewind/babel',
    [
      'module-resolver',
      {
        alias: {
          '^@lxmn/core$': '../../packages/core/src/index.ts',
          '^@lxmn/platform-mobile$': '../../packages/platform-mobile/src/index.ts',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
}
