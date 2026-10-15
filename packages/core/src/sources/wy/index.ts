/**
 * 网易云音源 —— 结构对应 lx-music-desktop
 *   src/renderer/utils/musicSdk/wy/index.js
 *
 * 原文件通过 `apis('wy')` 间接取 getMusicUrl（为了支持用户自定义接口）。
 * 这里改为显式的 `setMusicUrlProvider`，用户自定义音源能力因此得以保留且更清晰。
 */
import type { MusicSource, MusicItem, LyricInfo, PicInfo, MusicUrlInfo, Quality } from '../../types'
import { registerSource, setSupportQuality } from '../registry'
import { eapiRequest } from './utils'
import { eapi } from './crypto'

/** 取播放地址 —— 允许宿主注入用户自定义实现（保留 lx-music 的自定义音源能力） */
export type MusicUrlProvider = (songInfo: MusicItem, quality: Quality) => Promise<MusicUrlInfo>

let urlProvider: MusicUrlProvider | null = null

export function setMusicUrlProvider(provider: MusicUrlProvider | null): void {
  urlProvider = provider
}

const WY_SONG_URL = '/api/song/enhance/player/url/v1'

/**
 * 内核的 Quality 是**跨音源统一**的命名（128k/320k/flac/...），
 * 而网易 eapi 的 level 参数用的是另一套专有词（standard/higher/exhigh/lossless/hires）。
 *
 * 直接传 Quality 会被服务端判为非法 level，返回 code:-110 + url:null —— 实测
 * 'hires' 恰好与上游同名才碰巧能用，'128k' / '320k' / 'flac' 全部失败。
 * 这里做显式映射。
 */
const WY_LEVEL: Record<Quality, string> = {
  '128k': 'standard',
  '320k': 'exhigh',
  flac: 'lossless',
  flac24bit: 'lossless',
  hires: 'hires',
  atmos: 'jyeffect',
  master: 'jymaster',
}

/** 默认实现：走 eapi 取播放地址（与原接口同路径、同参数） */
const defaultGetMusicUrl: MusicUrlProvider = async (songInfo, quality) => {
  const { statusCode, body } = await eapiRequest(WY_SONG_URL, {
    ids: JSON.stringify([songInfo.songmid]),
    level: WY_LEVEL[quality] ?? 'exhigh',
    encodeType: 'flac',
    header: { osver: '', deviceId: '', appver: '', versioncode: '', mobilename: '', buildver: '', resolution: '', __csrf: '', os: 'pc', channel: '', requestId: String(Date.now()) },
  })
  if (statusCode !== 200) throw new Error(`[lxmn/wy] HTTP ${statusCode}`)
  const parsed = JSON.parse(body) as { data?: Array<{ url?: string; type?: string; size?: number }> }
  const item = parsed.data?.[0]
  if (!item?.url) throw new Error('[lxmn/wy] No playable url')
  return { url: item.url, quality, type: item.type ?? '', size: item.size }
}

export const wySource: MusicSource = {
  id: 'wy',
  name: '网易云音乐',

  async getMusicUrl(songInfo: MusicItem, quality: Quality): Promise<MusicUrlInfo> {
    const provider = urlProvider ?? defaultGetMusicUrl
    return provider(songInfo, quality)
  },

  /** 对应原 getLyric(songInfo.songmid) */
  async getLyric(songInfo: MusicItem): Promise<LyricInfo> {
    const { body } = await eapiRequest('/api/song/lyric', {
      id: songInfo.songmid,
      lv: -1,
      kv: -1,
      tv: -1,
    })
    const parsed = JSON.parse(body) as {
      lrc?: { lyric?: string }
      tlyric?: { lyric?: string }
      romalrc?: { lyric?: string }
    }
    return {
      lyric: parsed.lrc?.lyric ?? '',
      tlyric: parsed.tlyric?.lyric ?? '',
      romalrc: parsed.romalrc?.lyric ?? '',
    }
  },

  /** 对应原 getPic：先取 musicInfo 再读 al.picUrl */
  async getPic(songInfo: MusicItem): Promise<PicInfo> {
    const { body } = await eapiRequest('/api/v3/song/detail', {
      c: JSON.stringify([{ id: songInfo.songmid, v: 0 }]),
    })
    const parsed = JSON.parse(body) as { songs?: Array<{ al?: { picUrl?: string } }> }
    return { url: parsed.songs?.[0]?.al?.picUrl ?? '' }
  },

  /** 对应原 getMusicDetailPageUrl */
  getMusicDetailPageUrl(songInfo: MusicItem): string {
    return `https://music.163.com/#/song?id=${songInfo.songmid}`
  },
}

/** 注册到全局注册表（幂等） */
export function installWySource(): void {
  registerSource('wy', wySource)
  setSupportQuality('wy', ['master', 'atmos', 'hires', 'flac24bit', 'flac', '320k', '128k'])
}

export { WY_SONG_URL, defaultGetMusicUrl }
export { eapi, linuxapi, weapi, eapiDecrypt, WY_CONSTANTS } from './crypto'
export { eapiRequest, EAPI_BATCH_URL, EAPI_UA } from './utils'
