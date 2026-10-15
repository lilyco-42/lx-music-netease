/**
 * 咪咕（mg）音源。
 *
 * 与 kw 一样，上游的取流端点（ts.tempmusics.tk）早已 DNS 失效，
 * 桌面端 api-source.js 里的内置 getMusicUrl 也被注释掉了 —— 上游自己不能播咪咕。
 *
 * 这里改用咪咕自家仍在服务的三个端点，**并且按真实返回的形状重写了解析**
 * （上游 musicSearch.js 解析的是 jadeite v3 的字段，与 v1 完全不同）：
 *
 *   搜索  app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do
 *   详情  c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do   （取时长）
 *   取流  app.c.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do
 *
 * 两个实测出来的关键坑：
 *  1. listenSong.do 必须传 **contentId**（形如 600913000002601091），
 *     传搜索结果里的 id 会返回 {"code":"299999"}。
 *  2. 搜索接口不返回时长，只有 resourceinfo.do 的 length 字段有（"00:05:25"）。
 */
import type { MusicSource, MusicItem, LyricInfo, PicInfo, MusicUrlInfo, Quality, SearchResult } from '../../types'
import { registerSource, setSupportQuality } from '../registry'
import { getPlatform } from '../../registry'
import { formatSingerName } from '../../sign'

const SEARCH_API = 'https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do'
const INFO_API = 'https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do'
const LISTEN_API = 'https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do'

/** 咪咕要求这几个头，否则会被当作非法客户端 */
const MG_HEADERS = {
  channel: '0146921',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
}

/** searchSwitch：只开单曲，其余全关（与上游一致） */
const SEARCH_SWITCH = JSON.stringify({
  song: 1, album: 0, singer: 0, tagSong: 0, mvSong: 0, songlist: 0, bestShow: 0,
})

/**
 * formatType -> 内核音质。
 *
 * 真实返回里出现的是 PQ/HQ/SQ，newRateFormats 里无损24bit 记作 ZQ。
 * 上游写的 ZQ24 在 v1 响应里没出现过，但一并认下以防接口换名。
 */
const FORMAT_TO_QUALITY: Record<string, Quality> = {
  LQ: '128k',
  PQ: '128k',
  HQ: '320k',
  SQ: 'flac',
  ZQ: 'flac24bit',
  ZQ24: 'flac24bit',
}

interface MgFormat {
  formatType?: string
  size?: string | number
  androidSize?: string | number
  isize?: string | number
  asize?: string | number
}

function parseQualitys(formats: MgFormat[] | undefined): Partial<Record<Quality, unknown>> {
  const out: Partial<Record<Quality, unknown>> = {}
  for (const f of formats ?? []) {
    const q = FORMAT_TO_QUALITY[String(f.formatType ?? '')]
    if (!q || out[q]) continue
    const size = Number(f.size ?? f.androidSize ?? f.isize ?? f.asize ?? 0)
    out[q] = { size: size > 0 ? `${(size / 1024 / 1024).toFixed(1)}MB` : null }
  }
  return out
}

/** 从 imgItems / albumImgs 里挑一张图（优先尺寸最大的 03） */
function pickImg(items: unknown): string {
  if (!Array.isArray(items)) return ''
  const bySize = new Map<string, string>()
  for (const it of items) {
    const o = it as { imgSizeType?: string; img?: string }
    if (o?.img && o.imgSizeType) bySize.set(o.imgSizeType, o.img)
  }
  return bySize.get('03') ?? bySize.get('02') ?? bySize.get('01') ?? ''
}

/**
 * 搜索结果一条 -> MusicItem。
 *
 * 注意 songmid 用 id（数字型 id），而 contentId 另存 ——
 * 取流必须用 contentId，两者不能混。
 */
export function handleMgSearchItem(raw: unknown): MusicItem | null {
  const d = raw as Record<string, unknown>
  const songId = d?.id ?? d?.songId
  if (!songId) return null

  const albums = Array.isArray(d.albums) ? d.albums : []
  const firstAlbum = (albums[0] ?? {}) as { id?: string; name?: string }

  return {
    id: String(songId),
    name: String(d.name ?? ''),
    singer: formatSingerName(Array.isArray(d.singers) ? d.singers : []),
    albumName: String(firstAlbum.name ?? ''),
    albumId: String(firstAlbum.id ?? ''),
    source: 'mg',
    songmid: String(songId),
    // 取流用，必须保留
    contentId: String(d.contentId ?? ''),
    copyrightId: String(d.copyrightId ?? ''),
    picUrl: pickImg(d.imgItems),
    lrcUrl: typeof d.lyricUrl === 'string' ? d.lyricUrl : '',
    trcUrl: typeof d.trcUrl === 'string' ? d.trcUrl : '',
    // 搜索接口不返回时长，先留空，由 fillDurations() 补
    interval: '',
    qualitys: parseQualitys(
      (Array.isArray(d.rateFormats) ? d.rateFormats : d.newRateFormats) as MgFormat[] | undefined,
    ),
  }
}

/**
 * 批量补时长。
 *
 * 搜索接口不返回时长，只有 resourceinfo.do 有，且支持一次传多个 id（用 | 分隔）。
 * 这里一次请求补齐整页，失败不影响搜索结果 —— 时长只是展示用。
 */
async function fillDurations(list: MusicItem[]): Promise<void> {
  if (!list.length) return
  const { http } = getPlatform()
  const form = new URLSearchParams({ resourceId: list.map(i => String(i.songmid)).join('|') })
  try {
    const res = await http.request({
      url: `${INFO_API}?resourceType=2`,
      method: 'POST',
      headers: { ...MG_HEADERS, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (res.statusCode !== 200) return
    const parsed = JSON.parse(res.body) as { resource?: Array<{ songId?: string; length?: string }> }
    const byId = new Map<string, string>()
    for (const r of parsed.resource ?? []) {
      if (r.songId && r.length) byId.set(String(r.songId), r.length)
    }
    for (const item of list) {
      const len = byId.get(String(item.songmid))
      // length 已经是 "00:05:25" 格式，直接采用
      if (len) item.interval = len
    }
  } catch {
    // 时长可选，拿不到就算了
  }
}

/**
 * 取流。
 *
 * **刻意不预检**：listenSong.do 直接把音频字节吐出来，想判断「是不是音频」
 * 就得把整个文件读进内存（无损档 40MB+），而播放器随后还会再拉一次。
 * 所以直接返回地址，不可播时交给 <audio> 的 error 事件提示用户。
 */
async function getMusicUrl(songInfo: MusicItem, quality: Quality): Promise<MusicUrlInfo> {
  const contentId = String(songInfo.contentId ?? '')
  const copyrightId = String(songInfo.copyrightId ?? '')
  if (!contentId) throw new Error('[lxmn/mg] 缺少 contentId，无法取流')
  if (!copyrightId) throw new Error('[lxmn/mg] 缺少 copyrightId，无法取流')

  const toneFlag = quality === 'flac24bit' ? 'ZQ24'
    : quality === 'flac' ? 'SQ'
      : quality === '320k' ? 'HQ' : 'LQ'

  const url = `${LISTEN_API}?toneFlag=${toneFlag}&netType=00&userId=&ua=Android_migu&version=5.0.1`
    + `&copyrightId=${copyrightId}&contentId=${contentId}&resourceType=2&channel=0`

  return { url, quality, type: 'mp3' }
}

/** 歌词：搜索结果直接给出 lrcUrl，取文本即可 */
async function getLyric(songInfo: MusicItem): Promise<LyricInfo> {
  const lrcUrl = typeof songInfo.lrcUrl === 'string' ? songInfo.lrcUrl : ''
  if (!lrcUrl) throw new Error('[lxmn/mg] 该歌曲暂无歌词')

  const { http } = getPlatform()
  const res = await http.request({
    url: lrcUrl,
    method: 'GET',
    headers: { ...MG_HEADERS, Referer: 'https://app.c.nf.migu.cn/' },
  })
  if (res.statusCode !== 200) throw new Error(`[lxmn/mg] lyric HTTP ${res.statusCode}`)

  const lyric = res.body.trim()
  if (!lyric) throw new Error('[lxmn/mg] 该歌曲暂无歌词')

  const tlyricUrl = typeof songInfo.trcUrl === 'string' ? songInfo.trcUrl : ''
  let tlyric = ''
  if (tlyricUrl) {
    try {
      const t = await http.request({
        url: tlyricUrl, method: 'GET',
        headers: { ...MG_HEADERS, Referer: 'https://app.c.nf.migu.cn/' },
      })
      if (t.statusCode === 200) tlyric = t.body.trim()
    } catch { /* 翻译可选 */ }
  }
  return { lyric, tlyric }
}

async function getPic(songInfo: MusicItem): Promise<PicInfo> {
  return { url: typeof songInfo.picUrl === 'string' ? songInfo.picUrl : '' }
}

export const mgSource: MusicSource = {
  id: 'mg',
  name: '咪咕音乐',
  getMusicUrl,
  getLyric,
  getPic,

  async musicSearch(keyword: string, page: number, limit: number): Promise<SearchResult> {
    const { http } = getPlatform()
    const query = new URLSearchParams({
      isCopyright: '1',
      isCorrect: '1',
      pageNo: String(page),
      pageSize: String(limit),
      searchSwitch: SEARCH_SWITCH,
      sort: '0',
      text: keyword,
    })
    const res = await http.request({ url: `${SEARCH_API}?${query.toString()}`, method: 'GET', headers: MG_HEADERS })
    if (res.statusCode !== 200) throw new Error(`[lxmn/mg] search HTTP ${res.statusCode}`)

    const parsed = JSON.parse(res.body) as {
      code?: string
      info?: string
      songResultData?: { resultList?: unknown[][]; totalCount?: string }
    }
    if (parsed.code !== '000000') throw new Error(`[lxmn/mg] 搜索失败：${parsed.info ?? parsed.code}`)

    const list: MusicItem[] = []
    const seen = new Set<string>()
    for (const group of parsed.songResultData?.resultList ?? []) {
      for (const raw of group) {
        const item = handleMgSearchItem(raw)
        // 同一首歌会在多个分组里重复出现，按 copyrightId 去重（与上游一致）
        if (!item || seen.has(String(item.copyrightId))) continue
        seen.add(String(item.copyrightId))
        list.push(item)
      }
    }
    await fillDurations(list)

    const total = parseInt(parsed.songResultData?.totalCount ?? '0', 10) || list.length
    return {
      list,
      total,
      limit,
      page,
      source: 'mg',
      allPage: limit > 0 ? Math.ceil(total / limit) : 1,
    }
  },
}

export function installMgSource(): void {
  registerSource('mg', mgSource)
  setSupportQuality('mg', ['flac24bit', 'flac', '320k', '128k'])
}

export { SEARCH_API as MG_SEARCH_API, INFO_API as MG_INFO_API, LISTEN_API as MG_LISTEN_API }
