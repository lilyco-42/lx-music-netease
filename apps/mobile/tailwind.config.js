/** 与桌面端 DESIGN.md 实测色值保持一致 */
module.exports = {
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ncm: {
          bg: '#101010',
          surface: '#202020',
          elevated: '#303030',
          bottombar: '#1d1d1d',
          accent: '#E83A45',
          fg: '#f0f0f0',
          muted: '#9a9a9a',
          fainter: '#6b6b6b',
          divider: '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
}
