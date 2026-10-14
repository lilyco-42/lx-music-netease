/** 音乐源统一数据模型 —— 桌面/移动共用 */

export type SourceId = 'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'bd' | 'xm'

export type Quality = '128k' | '320k' | 'flac' | 'flac24bit' | 'hires' | 'atmos' | 'master'

export interface MusicSourceMeta {
  name: string
  id: SourceId
}

export interface MusicItem {
  id: string | number
  name: string
  singer: string
  albumName?: string
  albumId?: string | number
  source: SourceId
  interval?: string | number
  qualitys?: Partial<Record<Quality, unknown>>
  picUrl?: string
  songmid?: string | number
  hash?: string
  copyrightId?: string
  [k: string]: unknown
}

export interface SearchResult {
  list: MusicItem[]
  total: number
  limit: number
  page: number
  source: SourceId
  allPage?: number
}

export interface LyricInfo {
  lyric: string
  tlyric?: string
  rlyric?: string
  /** 罗马音歌词（网易接口的 romalrc） */
  romalrc?: string
  lxlyric?: string
}

export interface MusicUrlInfo {
  url: string
  quality: Quality
  type?: string
  size?: number
  urls?: string[]
}

export interface PicInfo {
  url: string
}

/**
 * 音源实现。
 *
 * 与原 lx-music 的差异：原 index.js 导出的对象里 leaderboard / songList /
 * hotSearch / comment 都是**可选**能力（各平台实现程度不同），且 getMusicUrl
 * 是通过 apis('wy') 间接取到的。这里把必需能力收窄为「取地址/取词/取图」，
 * 其余按需实现，宿主再通过 registerSource 注入。
 */
export interface MusicSource {
  id: SourceId
  name: string

  /** 取播放地址（必需） */
  getMusicUrl(item: MusicItem, quality: Quality): Promise<MusicUrlInfo>
  /** 取歌词（必需） */
  getLyric(item: MusicItem): Promise<LyricInfo>
  /** 取封面（必需） */
  getPic(item: MusicItem): Promise<PicInfo>

  /** 搜索（可选：部分音源仅支持榜单/歌单） */
  musicSearch?(keyword: string, page: number, limit: number): Promise<SearchResult>
  /** 歌曲详情页地址（可选） */
  getMusicDetailPageUrl?(item: MusicItem): string
  /** 初始化（可选） */
  init?(): Promise<void>
}
