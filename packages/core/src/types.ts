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
  lxlyric?: string
}

export interface MusicUrlInfo {
  url: string
  quality: Quality
  urls?: string[]
}

export interface PicInfo {
  url: string
}

export interface MusicSource {
  id: SourceId
  name: string
  supportQualitys: Partial<Record<Quality, boolean>>
  musicSearch(keyword: string, page: number, limit: number): Promise<SearchResult>
  getMusicUrl(item: MusicItem, quality: Quality): Promise<MusicUrlInfo>
  getLyric(item: MusicItem): Promise<LyricInfo>
  getPic(item: MusicItem): Promise<PicInfo>
  init?(): Promise<void>
}
