/**
 * LX Music 移动端入口
 *
 * 四个标签页：首页 / 搜索 / 播放器 / 会员
 * 启动时装配平台适配器（纯 JS 加密，无原生加密模块），并初始化原生播放器。
 */
import { useEffect, useState } from 'react'
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import HomeScreen from './src/screens/HomeScreen'
import SearchScreen from './src/screens/SearchScreen'
import PlayerScreen from './src/screens/PlayerScreen'
import MembershipScreen from './src/screens/MembershipScreen'
import { ensurePlatform } from './src/platform'
import { setupPlayer, useTrackPlayerEvents } from './src/player'
import { colors, TAB_BAR_HEIGHT, topInset } from './src/theme'

type TabKey = 'home' | 'search' | 'player' | 'member'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: '首页' },
  { key: 'search', label: '搜索' },
  { key: 'player', label: '播放器' },
  { key: 'member', label: '会员' },
]

export default function App() {
  const [tab, setTab] = useState<TabKey>('home')
  /** 首页点歌单/频道时带过来的搜索词 */
  const [seedKeyword, setSeedKeyword] = useState('')

  useEffect(() => {
    // 装配 @lxmn/platform-mobile：注入 AsyncStorage，加密走内核纯 JS 实现
    ensurePlatform()
    // 初始化原生播放器（ExoPlayer / AVPlayer）。失败不阻塞 UI：
    // 搜索和会员页不依赖它，只有真正点播放时才会再次尝试。
    void setupPlayer().catch(() => undefined)
  }, [])

  // 通知栏 / 耳机切歌时同步 JS 状态
  useTrackPlayerEvents()

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} translucent={false} />

      <View style={styles.body}>
        {tab === 'home' ? (
          <HomeScreen
            onOpenSearch={kw => {
              if (kw) setSeedKeyword(kw)
              setTab('search')
            }}
          />
        ) : tab === 'search' ? (
          <SearchScreen initialKeyword={seedKeyword} />
        ) : tab === 'player' ? (
          <PlayerScreen />
        ) : (
          <MembershipScreen />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => {
          const active = t.key === tab
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.7}>
              <View style={[styles.tabIndicator, { backgroundColor: active ? colors.accent : 'transparent' }]} />
              <Text style={[styles.tabLabel, { color: active ? colors.accent : colors.muted, fontWeight: active ? '600' : '400' }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    backgroundColor: colors.bottombar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIndicator: { width: 22, height: 3, borderRadius: 2, marginBottom: 6 },
  tabLabel: { fontSize: 13 },
})
