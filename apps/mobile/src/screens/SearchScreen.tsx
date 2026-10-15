/**
 * 搜索页 —— 真正能听歌的入口。
 *
 * 调 @lxmn/core 的 musicSearch（与桌面端同一份内核），点条目即播放。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { getSource, hasSource, listSources, type MusicItem } from '@lxmn/core'
import { play, usePlayerState } from '../player'
import { colors, topInset } from '../theme'

export default function SearchScreen({ initialKeyword }: { initialKeyword?: string }) {
  const [keyword, setKeyword] = useState(initialKeyword ?? '')
  const [list, setList] = useState<MusicItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const st = usePlayerState()

  /** 真正执行搜索。显式收 keyword，这样「首页带词跳进来」也能复用 */
  const runWith = useCallback(async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setList([])
    setTotal(0)
    try {
      // 和桌面端同一策略：并发查所有能搜索的音源，去重合并。
      // 只查 wy 会把 kw/mg/kg 的免费曲库白白丢掉，而 wy 上大量 VIP 曲目
      // 本来就拿不到播放地址。
      const ids = listSources().filter(id => hasSource(id) && Boolean(getSource(id).musicSearch))
      if (!ids.length) throw new Error('当前没有可用的音源')

      const results = await Promise.all(
        ids.map(id => getSource(id).musicSearch!(q, 1, 30).catch(() => null)),
      )
      const seen = new Set<string>()
      const merged: MusicItem[] = []
      let sum = 0
      for (const r of results) {
        if (!r) continue
        sum += r.total
        for (const it of r.list) {
          const key = it.source + '-' + String(it.songmid)
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(it)
        }
      }
      if (!merged.length && results.every(r => r === null)) {
        throw new Error('所有音源都没有响应，请检查网络')
      }
      setList(merged)
      setTotal(sum)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const run = useCallback(() => void runWith(keyword), [keyword, runWith])

  const currentId = st.queue[st.index]?.songmid

  /**
   * 从首页带词跳进来时自动搜一次。
   * 用 ref 记住上一次搜过的词，避免父组件重渲染时把用户手输的内容覆盖掉。
   */
  const lastSeed = useRef('')
  useEffect(() => {
    const q = (initialKeyword ?? '').trim()
    if (!q || q === lastSeed.current) return
    lastSeed.current = q
    setKeyword(q)
    void runWith(q)
  }, [initialKeyword])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topInset }}>
      {/* 搜索框 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12 }}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={run}
          returnKeyType="search"
          placeholder="搜索歌曲、歌手"
          placeholderTextColor={colors.fainter}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 20,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            color: colors.fg,
            fontSize: 15,
          }}
        />
        <Pressable onPress={run} hitSlop={10}>
          <Text style={{ color: colors.accent, fontSize: 15 }}>搜索</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <Text style={{ color: colors.accent, paddingHorizontal: 20, fontSize: 14 }}>{error}</Text>
      ) : !list.length ? (
        <Text style={{ color: colors.fainter, paddingHorizontal: 20, fontSize: 14 }}>
          {keyword.trim() ? '没有找到相关歌曲' : '输入关键词后回车搜索'}
        </Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={i => i.source + '-' + i.songmid}
          ListHeaderComponent={
            <Text style={{ color: colors.fainter, fontSize: 12, paddingHorizontal: 20, paddingBottom: 8 }}>
              共 {total} 首
            </Text>
          }
          renderItem={({ item, index }) => {
            const active = item.songmid === currentId
            return (
              <Pressable
                onPress={() => void play(item, list)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 }}
              >
                <Text style={{ color: colors.fainter, fontSize: 13, width: 20 }}>{index + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: active ? colors.accent : colors.fg, fontSize: 15 }}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                    {item.singer}{item.albumName ? ' · ' + item.albumName : ''}
                  </Text>
                </View>
                <Text style={{ color: colors.fainter, fontSize: 11 }}>{item.source.toUpperCase()}</Text>
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}
