/**
 * 首页 —— 网易云风格布局（不含任何网易商标/图形资产）
 * 结构：顶栏（Logo + 标题）→ 推荐歌单横向卡片 → 猜你喜欢列表
 */
import { ScrollView, Text, View, Pressable, FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Logo } from '../components/Icons'
import { colors } from '../theme'

interface Playlist {
  id: number
  title: string
  count: string
}

/** 实测规格：卡片 140x170，圆角 8 */
const PLAYLISTS: Playlist[] = [
  { id: 1, title: '每日推荐 · 为你而选', count: '30 首' },
  { id: 2, title: '私人雷达 · 越听越懂你', count: '50 首' },
  { id: 3, title: '华语流行精选', count: '42 首' },
  { id: 4, title: '深夜轻音乐', count: '28 首' },
  { id: 5, title: '电子 · 律动', count: '36 首' },
  { id: 6, title: '民谣与故事', count: '33 首' },
  { id: 7, title: '经典摇滚', count: '45 首' },
]

interface Track {
  id: number
  title: string
  artist: string
  plays: string
}

const TRACKS: Track[] = [
  { id: 1, title: '城市夜航', artist: '林一 / 陈默', plays: '128 万' },
  { id: 2, title: '雨后的窗台', artist: '苏晚', plays: '96 万' },
  { id: 3, title: '远方的信号', artist: 'Northbound', plays: '88 万' },
  { id: 4, title: '旧磁带', artist: '周与南', plays: '75 万' },
  { id: 5, title: '凌晨四点', artist: '夜行者', plays: '64 万' },
  { id: 6, title: '海边的信', artist: '蓝调小组', plays: '59 万' },
  { id: 7, title: '回到那天', artist: '许青', plays: '51 万' },
  { id: 8, title: '光影之间', artist: 'Mono Lake', plays: '43 万' },
]

function CoverPlaceholder({ size, radius = 8 }: { size: number; radius?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.elevated,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 几何占位：三条竖条，暗示封面 */}
      <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end' }}>
        {[0.4, 0.7, 0.55].map((h, i) => (
          <View
            key={i}
            style={{ width: 4, height: size * 0.34 * h * 2, borderRadius: 2, backgroundColor: colors.fainter }}
          />
        ))}
      </View>
    </View>
  )
}

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* 顶栏 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 }}>
          <Logo size={34} />
          <Text style={{ color: colors.fg, fontSize: 21, fontWeight: '600' }}>LX Music</Text>
        </View>

        {/* 推荐歌单 */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.fg, fontSize: 17, fontWeight: '600' }}>推荐歌单</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>更多 ›</Text>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PLAYLISTS}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable style={{ width: 140 }}>
              <CoverPlaceholder size={140} radius={8} />
              <Text numberOfLines={2} style={{ color: colors.fg, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
                {item.title}
              </Text>
              <Text style={{ color: colors.fainter, fontSize: 11, marginTop: 3 }}>{item.count}</Text>
            </Pressable>
          )}
        />

        {/* 猜你喜欢 */}
        <View style={{ paddingHorizontal: 20, marginTop: 26, marginBottom: 10 }}>
          <Text style={{ color: colors.fg, fontSize: 17, fontWeight: '600' }}>猜你喜欢</Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {TRACKS.map((t, idx) => (
            <Pressable
              key={t.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 9,
                gap: 12,
              }}
            >
              <Text style={{ color: colors.fainter, fontSize: 13, width: 18 }}>{idx + 1}</Text>
              <CoverPlaceholder size={48} radius={6} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.fg, fontSize: 15 }}>
                  {t.title}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                  {t.artist}
                </Text>
              </View>
              <Text style={{ color: colors.fainter, fontSize: 12 }}>{t.plays}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
