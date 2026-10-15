/**
 * 我的音乐（移动端）—— 收藏 / 最近播放
 *
 * 曲库是内核级的，与桌面端读同一份数据，所以这里看到的就是同步过去的内容。
 */
import { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import type { MusicItem } from '@lxmn/core'
import { play, usePlayerState } from '../player'
import { library } from '../sync'
import { colors, topInset } from '../theme'

type Tab = 'fav' | 'recent'

interface Row {
  item: MusicItem
  playedAt: number
}

export default function MyMusicScreen() {
  const [tab, setTab] = useState<Tab>('fav')
  const [rows, setRows] = useState<Row[]>([])
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([])
  const st = usePlayerState()

  const pull = useCallback(() => {
    const s = library.snapshot()
    setPlaylists(s.playlists.map(p => ({ id: p.id, name: p.name })))
    setRows(
      tab === 'fav'
        ? s.favorites.map(item => ({ item, playedAt: 0 }))
        : s.history.map(h => ({ item: h, playedAt: h.playedAt })),
    )
  }, [tab])

  useEffect(() => {
    void library.load().then(pull)
  }, [pull])

  async function unfav(item: MusicItem) {
    await library.removeFavorite(item)
    pull()
  }

  async function addTo(playlistId: string, item: MusicItem) {
    await library.addToPlaylist(playlistId, item)
    pull()
  }

  function fmtTime(ms: number): string {
    if (!ms) return ''
    const d = new Date(ms)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const currentId = st.queue[st.index]?.songmid

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topInset }}>
      <Text style={{ color: colors.fg, fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 12 }}>
        我的音乐
      </Text>

      {/* 标签 */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 14 }}>
        {([['fav', '我喜欢的'], ['recent', '最近播放']] as const).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={{
              borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
              backgroundColor: tab === k ? colors.accent : colors.surface,
            }}
          >
            <Text style={{ color: tab === k ? '#fff' : colors.muted, fontSize: 13.5 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {!rows.length ? (
        <Text style={{ color: colors.fainter, paddingHorizontal: 20, fontSize: 14 }}>
          {tab === 'fav' ? '还没有收藏。在搜索页点右侧的心形即可收藏。' : '还没有播放记录。'}
        </Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.item.source + '-' + String(r.item.songmid)}
          renderItem={({ item: row, index }) => {
            const active = row.item.songmid === currentId
            return (
              <Pressable
                onPress={() => void play(row.item, rows.map(r => r.item))}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 }}
              >
                <Text style={{ color: colors.fainter, fontSize: 13, width: 20 }}>{index + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: active ? colors.accent : colors.fg, fontSize: 15 }}>
                    {row.item.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                    {row.item.singer}
                    {tab === 'recent' && row.playedAt ? ' · ' + fmtTime(row.playedAt) : ''}
                  </Text>
                </View>

                {/* 加入歌单：没有歌单就不显示，避免点了没反应 */}
                {playlists.length ? (
                  <Pressable
                    onPress={() => void addTo(playlists[0]!.id, row.item)}
                    hitSlop={10}
                    style={{ paddingHorizontal: 6, paddingVertical: 6 }}
                  >
                    <Text style={{ color: colors.fainter, fontSize: 15 }}>＋</Text>
                  </Pressable>
                ) : null}

                {tab === 'fav' ? (
                  <Pressable onPress={() => void unfav(row.item)} hitSlop={12} style={{ paddingHorizontal: 4 }}>
                    <Text style={{ color: colors.accent, fontSize: 17 }}>♥</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}
