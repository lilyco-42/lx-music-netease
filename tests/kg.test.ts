/**
 * kg（酷狗）音源的测试。
 *
 * 断言的是**真实响应的形状** —— payload 逐字取自线上返回，
 * 不是照着实现反推的假数据，否则实现错了测试也会一起错。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  setPlatform, installKgSource, resetSources, getSource, getSupportQuality, handleKgSearchItem,
  type HttpRequestOptions, type HttpResponse, type PlatformAdapter,
} from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'

/** 线上 song_search_v2 的真实返回（截取，字段未改动） */
const REAL_ITEM = {
  FileHash: '981713ECCA54DFE14994C642B59126CE',
  FileSize: 4126317,
  HQFileHash: 'B4F05DA4430E4FF729A98276C74829D4',
  HQFileSize: 10315781,
  SQFileHash: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
  SQFileSize: 26000000,
  ResFileHash: '',
  ResFileSize: 0,
  Duration: 257,
  AudioID: 88068843,
  MixSongID: 283856080,
  AlbumID: 40227694,
  AlbumName: '钢琴曲纯音乐',
  SongName: '雨的印记 (钢琴版纯音乐)',
  OriSongName: '雨的印记',
  Suffix: '',
  Singers: [{ name: 'jaycd', id: 5234172 }],
  Image: 'http://imge.kugou.com/stdmusic/{size}/20250828/20250828205103283059.jpg',
}

let captured: HttpRequestOptions[] = []

function fakeHttp(responder: (o: HttpRequestOptions) => unknown): PlatformAdapter {
  return {
    ...desktopPlatform,
    http: {
      async request(o: HttpRequestOptions): Promise<HttpResponse> {
        captured.push(o)
        const r = responder(o)
        const body = typeof r === 'string' ? r : JSON.stringify(r)
        return { statusCode: 200, headers: {}, body, raw: new Uint8Array() }
      },
    },
  }
}

beforeEach(() => {
  captured = []
  resetSources()
})

describe('kg 音源', () => {
  it('把真实搜索结果映射成 MusicItem', () => {
    const item = handleKgSearchItem(REAL_ITEM)!
    expect(item.source).toBe('kg')
    expect(item.name).toBe('雨的印记 (钢琴版纯音乐)')
    expect(item.singer).toBe('jaycd')
    expect(item.albumName).toBe('钢琴曲纯音乐')
    expect(item.albumId).toBe('40227694')
    // 257 秒 -> 04:17
    expect(item.interval).toBe('04:17')
    // 主 hash 是 128k 那条
    expect(item.hash).toBe('981713ECCA54DFE14994C642B59126CE')
    // songmid 用 AudioID，不能用 FileHash（FileHash 随音质变，不是稳定主键）
    expect(item.songmid).toBe('88068843')
  })

  it('四种 hash 都齐时四种音质都被解析出来', () => {
    const item = handleKgSearchItem(REAL_ITEM)!
    expect(Object.keys(item.qualitys ?? {}).sort()).toEqual(['128k', '320k', 'flac'])
    expect((item.qualitys?.['128k'] as { size?: string })?.size).toBe('3.9MB')
    expect((item.qualitys?.['320k'] as { hash?: string })?.hash).toBe('B4F05DA4430E4FF729A98276C74829D4')
  })

  it('FileSize 为 0 的档位不出现（空 hash 同理）', () => {
    const item = handleKgSearchItem({ ...REAL_ITEM, ResFileSize: 0, ResFileHash: '' })!
    expect(item.qualitys).not.toHaveProperty('flac24bit')
  })

  it('缺 FileHash 的条目直接丢弃', () => {
    expect(handleKgSearchItem({ ...REAL_ITEM, FileHash: '' })).toBeNull()
    expect(handleKgSearchItem(null)).toBeNull()
  })

  it('只声明 128k —— 免费端点对 320k/flac 也一律只回 128k', () => {
    installKgSource()
    expect(getSupportQuality('kg')).toEqual(['128k'])
    expect(getSource('kg').name).toBe('酷狗音乐')
  })

  it('SingerName 字符串形态与 Singers 数组形态都能拼', () => {
    expect(handleKgSearchItem({ ...REAL_ITEM, Singers: undefined, SingerName: 'A&B' })!.singer).toBe('A、B')
    expect(handleKgSearchItem({ ...REAL_ITEM, Singers: [{ name: 'A' }, { name: 'B' }] })!.singer).toBe('A、B')
  })

  it('取流成功时返回 url', async () => {
    setPlatform(fakeHttp(() => ({ url: 'https://sharefs.kugou.com/abc/128.mp3', bitRate: 128, extName: 'mp3', fileSize: 4126317 })))
    installKgSource()
    const info = await getSource('kg').getMusicUrl(handleKgSearchItem(REAL_ITEM)!, '128k')
    expect(info.url).toContain('sharefs.kugou.com')
    expect(info.type).toBe('mp3')
    // 请求里必须带上 hash
    expect(captured[0]?.url).toContain('981713ECCA54DFE14994C642B59126CE')
  })

  it('版权受限（error: 需要付费 且无 url）时抛错，而不是返回空地址', async () => {
    setPlatform(fakeHttp(() => ({ error: '需要付费', status: 0 })))
    installKgSource()
    await expect(getSource('kg').getMusicUrl(handleKgSearchItem(REAL_ITEM)!, '128k')).rejects.toThrow(/无可播放地址/)
  })

  it('歌词：search -> download，base64 解出 UTF-8 且去掉 BOM', async () => {
    const lrc = '\uFEFF[ti:雨的印记]\r\n[00:00.00]第一行\r\n[00:05.00]第二行\r\n'
    const b64 = Buffer.from(lrc, 'utf8').toString('base64')
    setPlatform(fakeHttp(o => {
      if (String(o.url).includes('/search')) {
        return { candidates: [{ id: '827855600', accesskey: '25DC0A04CF05FE0746EE3704E2DD4D40' }] }
      }
      return { status: 200, content: b64 }
    }))
    installKgSource()
    const { lyric } = await getSource('kg').getLyric(handleKgSearchItem(REAL_ITEM)!)
    expect(lyric.startsWith('[ti:')).toBe(true)   // BOM 已被去掉
    expect(lyric).toContain('[00:00.00]第一行')
    expect(lyric).toContain('第二行')
  })

  it('歌词：没有候选时抛「暂无歌词」', async () => {
    setPlatform(fakeHttp(() => ({ candidates: [] })))
    installKgSource()
    await expect(getSource('kg').getLyric(handleKgSearchItem(REAL_ITEM)!)).rejects.toThrow(/暂无歌词/)
  })

  it('歌词：download 返回空 content 时也抛「暂无歌词」', async () => {
    setPlatform(fakeHttp(o => String(o.url).includes('/search')
      ? { candidates: [{ id: '1', accesskey: 'k' }] }
      : { status: 200, content: '' }))
    installKgSource()
    await expect(getSource('kg').getLyric(handleKgSearchItem(REAL_ITEM)!)).rejects.toThrow(/暂无歌词/)
  })

  it('搜索：请求参数正确，且把封面模板挂到条目上', async () => {
    setPlatform(fakeHttp(() => ({ data: { total: 191, lists: [REAL_ITEM] } })))
    installKgSource()
    const r = await getSource('kg').musicSearch('雨的印记', 1, 30)
    expect(r.source).toBe('kg')
    expect(r.total).toBe(191)
    expect(r.list).toHaveLength(1)
    expect(r.list[0]?.picUrl).toContain('imge.kugou.com')
    const u = captured[0]?.url ?? ''
    expect(u).toContain('songsearch.kugou.com')
    expect(u).toContain('keyword=')
    expect(u).toContain('pagesize=30')
  })

  it('取图：把 {size} 模板替换成真实尺寸', async () => {
    installKgSource()
    const item = handleKgSearchItem(REAL_ITEM)!
    item.picUrl = REAL_ITEM.Image
    const pic = await getSource('kg').getPic(item)
    expect(pic.url).toBe('http://imge.kugou.com/stdmusic/480/20250828/20250828205103283059.jpg')
    expect(pic.url).not.toContain('{size}')
  })
})
