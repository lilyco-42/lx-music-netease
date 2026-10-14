import { Platform, StatusBar } from 'react-native'

/** 与桌面端 DESIGN.md 实测色值一致 */
export const colors = {
  bg: '#101010',
  surface: '#202020',
  elevated: '#303030',
  bottombar: '#1d1d1d',
  accent: '#E83A45',
  fg: '#f0f0f0',
  muted: '#9a9a9a',
  fainter: '#6b6b6b',
  divider: '#2a2a2a',
} as const

export type ThemeColor = keyof typeof colors

/**
 * 顶部安全区高度。
 * 用 StatusBar.currentHeight 代替 react-native-safe-area-context，
 * 少一个原生依赖。
 */
export const topInset = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 44

/** 底部标签栏高度 */
export const TAB_BAR_HEIGHT = 56
