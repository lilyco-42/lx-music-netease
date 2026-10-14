/**
 * 设计令牌 —— 数值全部来自对参考截图的像素级实测 (Python/Pillow)
 * 见仓库根目录 DESIGN.md
 */

/** 深色主题：播放器模式 */
export const dark = {
  bg: '#101010',
  surface: '#202020',
  elevated: '#303030',
  bottomBar: '#1d1d1d',
  topBar: '#282828',
  sidebar: '#1e1e1e',
  main: '#232323',
  textPrimary: '#EEEEEE',
  textSecondary: '#969696',
  textDim: '#555555',
  textDarker: '#383838',
  accent: '#E83A45',
  vinylBody: '#0B0B0B',
  vinylEdge: '#303030',
  vinylRing: '#F7F7F7',
} as const

/** 浅色主题：首页推荐 */
export const light = {
  bg: '#F4F6FB',
  sidebar: '#EEF1F6',
  bottomBar: '#FBFCFE',
  topBar: '#F3F4F8',
  divider: '#E9ECF2',
  textPrimary: '#252D42',
  textSecondary: '#465066',
  textMuted: '#747D90',
  textFaint: '#A5ACBA',
  accent: '#D43B52',
  accentNav: '#D13B50',
  accentPlay: '#D83A50',
  progress: '#DE7085',
  scrollbar: '#DADCE2',
} as const

/** 布局常量（1920×1200 基准实测） */
export const layout = {
  sidebarWidth: 255,
  topBarHeight: 94,
  bottomBarHeight: 102,
  progressBarHeight: 4,
  contentPaddingX: 49,
  scrollbarWidth: 6,
  playButtonSize: 52,
} as const

/** 圆角（实测） */
export const radius = {
  navItem: 10,
  searchBox: 11,
  channelCard: 8,
  playlistCover: 7,
  activityBanner: 12,
  sidebarCover: 4,
  tabContainer: 21,
  vipPill: 24,
  tag: 3,
} as const

/** 字号层级（实测） */
export const fontSize = {
  songTitle: 35,
  lyric: 24,
  sectionTitle: 24,
  logo: 22,
  channelCardTitle: 21,
  navItem: 18,
  meta: 18,
  bottomBarTitle: 18,
  cardDesc: 15,
  playCount: 12,
  tag: 11,
} as const

/** 字体栈 */
export const fontFamily = {
  sans: [
    'PingFang SC',
    'Microsoft YaHei',
    'Noto Sans CJK SC',
    'Arial',
    'sans-serif',
  ].join(', '),
} as const

export const tokens = { dark, light, layout, radius, fontSize, fontFamily }
export default tokens
