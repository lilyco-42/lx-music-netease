import { describe, it, expect, beforeAll } from 'vitest'
import { setPlatform, installKgSource, getSource } from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'

const live = process.env.LIVE === '1'

describe.skipIf(!live)('kg against the real Kugou API', () => {
  beforeAll(() => { setPlatform(desktopPlatform); installKgSource() })

  it('searches, resolves a play url, and fetches lyric + pic', async () => {
    // 用「轻音乐」而不是「起风了」：实测前者可播比例更高（5/10），
    // 后者热门曲目大多需要付费，容易把测试做成偶发失败。
    const r = await getSource('kg').musicSearch!('轻音乐', 1, 10)
    expect(r.total).toBeGreaterThan(0)
    console.log('  kg total:', r.total, 'returned:', r.list.length)
    const s = r.list[0]!
    console.log('  first:', s.name, '|', s.singer, '|', s.albumName, '|', s.interval, '| hash=', s.hash)
    expect(s.hash).toBeTruthy()

    let ok = 0
    for (const item of r.list.slice(0, 5)) {
      try {
        const u = await getSource('kg').getMusicUrl(item, '128k')
        if (u.url) { console.log('  playable:', item.name, '->', u.url.slice(0, 60) + '...'); ok++ }
      } catch (e) { console.log('  fail:', item.name, '->', (e as Error).message) }
    }
    console.log('  playable:', ok, '/ 5')
    // 免费端点只给 128k，且部分曲目需要付费，只要有一首能播即可
    expect(ok).toBeGreaterThan(0)

    // 歌词：酷狗用 lyrics.kugou.com/search + /download，并非每首都收录
    let withLyric = 0
    for (const item of r.list) {
      try {
        const l = await getSource('kg').getLyric(item)
        if (/\[\d{2}:\d{2}/.test(l.lyric)) {
          console.log('  lyric ok:', item.name, '->', l.lyric.length, 'bytes')
          withLyric++
        }
      } catch { /* 该曲目无歌词，属正常 */ }
    }
    console.log('  songs with lyric:', withLyric, '/', r.list.length)
    expect(withLyric).toBeGreaterThan(0)

    // 封面来自搜索结果里的模板，必须已替换掉 {size}
    const p = await getSource('kg').getPic(s)
    console.log('  pic:', p.url)
    expect(p.url).toMatch(/^https?:\/\//)
    expect(p.url).not.toContain('{size}')
  }, 120000)
})
