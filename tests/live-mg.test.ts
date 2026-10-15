import { describe, it, expect, beforeAll } from 'vitest'
import { setPlatform, installMgSource, getSource } from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'

const live = process.env.LIVE === '1'

describe.skipIf(!live)('mg against the real Migu API', () => {
  beforeAll(() => { setPlatform(desktopPlatform); installMgSource() })

  it('searches and builds play urls + lyrics', async () => {
    const r = await getSource('mg').musicSearch!('起风了', 1, 10)
    expect(r.total).toBeGreaterThan(0)
    console.log('  mg total:', r.total, 'returned:', r.list.length)
    const s = r.list[0]!
    console.log('  first:', s.name, '|', s.singer, '|', s.albumName, '|', s.interval, '| q=', JSON.stringify(s.qualitys))
    console.log('  pic:', s.picUrl)
    expect(s.songmid).toBeTruthy()
    expect(s.copyrightId).toBeTruthy()

    // 咪咕的 listenSong.do 直接吐字节，所以这里独立下载前几个字节验证真的可播
    let audio = 0
    for (const item of r.list.slice(0, 5)) {
      const u = await getSource('mg').getMusicUrl(item, '320k')
      const res = await fetch(u.url)
      const buf = new Uint8Array(await res.arrayBuffer())
      const isId3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33
      const isMpeg = buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0
      if (isId3 || isMpeg) { console.log('  audio:', item.name, '->', buf.length, 'bytes, ok'); audio++ }
      else { console.log('  not audio:', item.name, '->', new TextDecoder().decode(buf.subarray(0, 60))) }
    }
    console.log('  audio ok:', audio, '/ 5')
    expect(audio).toBeGreaterThan(0)

    let withLyric = 0
    for (const item of r.list) {
      try { const l = await getSource('mg').getLyric(item); if (l.lyric) withLyric++ } catch { /* 无歌词 */ }
    }
    console.log('  songs with lyric:', withLyric, '/', r.list.length)
  }, 180000)
})
