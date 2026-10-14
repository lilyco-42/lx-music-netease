/**
 * Tailwind preset —— 把设计令牌映射为 Tailwind 主题
 * 供 shadcn-vue / Tailwind v4 使用
 */
const dark = {
  bg: '#101010', surface: '#202020', elevated: '#303030',
  bottomBar: '#1d1d1d', topBar: '#282828', sidebar: '#1e1e1e', main: '#232323',
  textPrimary: '#EEEEEE', textSecondary: '#969696', textDim: '#555555',
  accent: '#E83A45',
};
const light = {
  bg: '#F4F6FB', sidebar: '#EEF1F6', bottomBar: '#FBFCFE', topBar: '#F3F4F8',
  divider: '#E9ECF2',
  textPrimary: '#252D42', textSecondary: '#465066', textMuted: '#747D90', textFaint: '#A5ACBA',
  accent: '#D43B52', accentPlay: '#D83A50', progress: '#DE7085', scrollbar: '#DADCE2',
};

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ncm: {
          light: {
            bg: light.bg, sidebar: light.sidebar, 'bottom-bar': light.bottomBar,
            topbar: light.topBar, divider: light.divider,
            fg: light.textPrimary, muted: light.textSecondary,
            faint: light.textFaint, accent: light.accent, progress: light.progress,
          },
          dark: {
            bg: dark.bg, surface: dark.surface, elevated: dark.elevated,
            'bottom-bar': dark.bottomBar, topbar: dark.topBar, sidebar: dark.sidebar,
            main: dark.main, fg: dark.textPrimary, muted: dark.textSecondary,
            dim: dark.textDim, accent: dark.accent,
          },
        },
      },
      borderRadius: {
        nav: '10px', search: '11px', channel: '8px',
        cover: '7px', banner: '12px', tab: '21px', pill: '24px',
      },
      spacing: {
        sidebar: '255px', topbar: '94px', bottombar: '102px',
      },
      fontFamily: {
        sans: ['PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
