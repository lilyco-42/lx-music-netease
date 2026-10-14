/**
 * LX Music 移动端入口
 *
 * 三个标签页：首页 / 播放器 / 会员
 * 启动时装配平台适配器（纯 JS 加密，无原生加密模块）。
 */
import { useEffect, useState } from 'react'
import { Pressable, StatusBar, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import './global.css'

import HomeScreen from './src/screens/HomeScreen'
import PlayerScreen from './src/screens/PlayerScreen'
import MembershipScreen from './src/screens/MembershipScreen'
import { ensurePlatform } from './src/platform'
import { colors } from './src/theme'

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
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          {tab === 'home' ? <HomeScreen /> : tab === 'player' ? <PlayerScreen /> : <MembershipScreen />}
        </View>

        {/* 底部标签栏 */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.bottombar,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            paddingBottom: 6,
          }}
        >
          {TABS.map(t => {
            const active = t.key === tab
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: active ? colors.accent : 'transparent',
                    marginBottom: 7,
                  }}
                />
                <Text style={{ color: active ? colors.accent : colors.muted, fontSize: 13, fontWeight: active ? '600' : '400' }}>
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </SafeAreaProvider>
  )
}
