/**
 * LX Music 移动端入口
 *
 * 三个标签页：首页 / 播放器 / 会员
 * 启动时装配平台适配器（纯 JS 加密，无原生加密模块）。
 */
import { useEffect, useState } from 'react'
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import HomeScreen from './src/screens/HomeScreen'
import PlayerScreen from './src/screens/PlayerScreen'
import MembershipScreen from './src/screens/MembershipScreen'
import { ensurePlatform } from './src/platform'
import { colors, TAB_BAR_HEIGHT, topInset } from './src/theme'

type TabKey = 'home' | 'player' | 'member'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: '首页' },
  { key: 'player', label: '播放器' },
  { key: 'member', label: '会员' },
]

export default function App() {
  const [tab, setTab] = useState<TabKey>('home')

  useEffect(() => {
    // 装配 @lxmn/platform-mobile：注入 AsyncStorage，加密走内核纯 JS 实现
    ensurePlatform()
  }, [])

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} translucent={false} />

      <View style={styles.body}>
        {tab === 'home' ? <HomeScreen /> : tab === 'player' ? <PlayerScreen /> : <MembershipScreen />}
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
