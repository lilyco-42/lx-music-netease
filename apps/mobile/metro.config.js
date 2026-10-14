const path = require('node:path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withNativeWind } = require('nativewind/metro')

const workspaceRoot = path.resolve(__dirname, '../..')

/**
 * Monorepo 下的 Metro 配置：
 *  - watchFolders 必须包含仓库根，否则 Metro 看不到 packages/*
 *  - nodeModulesPaths 让 Metro 依次在 app 与仓库根查找依赖
 *  - extraNodeModules 把 workspace 包直接指向源码，免去先构建
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    extraNodeModules: {
      '@lxmn/core': path.resolve(workspaceRoot, 'packages/core/src'),
      '@lxmn/platform-mobile': path.resolve(workspaceRoot, 'packages/platform-mobile/src'),
    },
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'],
  },
}

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
  input: './global.css',
})
