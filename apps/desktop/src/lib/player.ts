/**
 * 播放器状态（桌面端）
 *
 * 把 @lxmn/core 的音源能力接到 Vue 的响应式系统上：
 *   search() -> getMusicUrl() -> <audio> 播放 -> getLyric() 取词
 *
 * 设计上刻意**不把 <audio> 放进这个模块**：内核要保持零 DOM 依赖
 * （移动端 tsconfig 里 types: []，连 DOM lib 都没有），
 * 所以这里只维护数据，真正的播放元素由组件持有并回灌进度。
 */
import { computed, reactive, readonly } from 'vue'
import {
  getSource,
  hasSource,
  listSources,
  qualityOrder,
  type MusicItem,
  type Quality,
} from '@lxmn/core'

export interface PlayerState {
  /** 当前播放列表 */
  queue: MusicItem[]
  /** 当前索引 */
  index: number
  playing: boolean
  /** 秒 */
  currentTime: number
  duration: number
  volume: number
  quality: Quality
  loading: boolean
  error: string
  /** 当前曲目的歌词行（原始 LRC） */
  lyric: string
  tlyric: string
  picUrl: string
  url: string
}

const state = reactive<PlayerState>({
  queue: [],
  index: -1,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  quality: '320k',
  loading: false,
  error: '',
  lyric: '',
  tlyric: '',
  picUrl: '',
  url: '',
})

/** 播放地址的获取方式由组件注入（内核不认识 <audio>） */
let playUrl: ((url: string) => Promise<void>) | null = null
export function setPlaybackHandler(fn: ((url: string) => Promise<void>) | null): void {
  playUrl = fn
}

/** 跳转播放位置的方式同样由组件注入（内核不认识 <audio>） */
let seekHandler: ((time: number) => void) | null = null
export function setSeekHandler(fn: ((time: number) => void) | null): void {
  seekHandler = fn
}

const current = computed<MusicItem | null>(() => state.queue[state.index] ?? null)

/** 已安装的音源里，哪个能搜（用于提示用户当前可用范围） */
export const availableSources = computed(() => listSources().filter(id => hasSource(id)))

/**
 * 取流并交给宿主播放。
 *
 * 内核的 getMusicUrl 已经内置降档回退（高音质被锁时自动往低试），
 * 这里只负责把最终结果交给 <audio> 并回填封面。
 */
async function resolveAndPlay(item: MusicItem): Promise<void> {
  state.loading = true
  state.error = ''
  state.url = ''
  try {
    const source = getSource(item.source)
    const info = await source.getMusicUrl(item, state.quality)
    state.url = info.url
    // 实际拿到的音质可能与请求的不同（降档了），如实回填
    state.quality = info.quality
    if (!state.picUrl && item.picUrl) state.picUrl = item.picUrl
    if (playUrl) await playUrl(info.url)
    state.playing = true
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e)
    state.playing = false
  } finally {
    state.loading = false
  }
}

/** 取歌词（失败不阻断播放：没有歌词也应该能听） */
async function loadLyric(item: MusicItem): Promise<void> {
  state.lyric = ''
  state.tlyric = ''
  try {
    const info = await getSource(item.source).getLyric(item)
    state.lyric = info.lyric ?? ''
    state.tlyric = info.tlyric ?? ''
  } catch {
    // 歌词是可选的，静默失败
  }
}

/** 取封面（同样不阻断） */
async function loadPic(item: MusicItem): Promise<void> {
  state.picUrl = item.picUrl ?? ''
  if (state.picUrl) return
  try {
    const info = await getSource(item.source).getPic(item)
    state.picUrl = info.url ?? ''
  } catch {
    // 忽略
  }
}

export function usePlayer() {
  /** 搜索：直接透传给内核，各音源的实现差异由内核吸收 */
  async function search(keyword: string, page = 1, limit = 30) {
    if (!keyword.trim()) return { list: [], total: 0, page, limit, source: 'wy' as const }
    const source = getSource('wy')
    if (!source.musicSearch) throw new Error('当前音源不支持搜索')
    return source.musicSearch(keyword.trim(), page, limit)
  }

  /** 播放指定曲目：把它插入队列并立即播放 */
  async function play(item: MusicItem, queue?: MusicItem[]): Promise<void> {
    if (queue?.length) {
      state.queue = queue
      state.index = queue.findIndex(x => x.songmid === item.songmid && x.source === item.source)
      if (state.index < 0) {
        state.queue = [item, ...queue]
        state.index = 0
      }
    } else {
      const at = state.queue.findIndex(x => x.songmid === item.songmid && x.source === item.source)
      if (at >= 0) state.index = at
      else {
        state.queue = [...state.queue, item]
        state.index = state.queue.length - 1
      }
    }
    state.currentTime = 0
    state.duration = 0
    await Promise.all([resolveAndPlay(item), loadLyric(item), loadPic(item)])
  }

  async function next(): Promise<void> {
    if (!state.queue.length) return
    state.index = (state.index + 1) % state.queue.length
    const item = state.queue[state.index]
    if (item) await play(item)
  }

  async function prev(): Promise<void> {
    if (!state.queue.length) return
    state.index = (state.index - 1 + state.queue.length) % state.queue.length
    const item = state.queue[state.index]
    if (item) await play(item)
  }

  /**
   * 播放 / 暂停。
   *
   * 关键点：**不要在这里直接翻转 state.playing**，而是只在"当前没有曲目"时
   * 才需要真正去取流播放。有曲目时交给 <audio> 的 play/pause 事件回灌，
   * 否则会和 AudioHost 的 watch 形成互相打架的两个真相来源 ——
   * 点了暂停、watch 又看到 playing=true 把音频播回去。
   */
  function toggle(): void {
    const item = current.value
    if (!item) return
    if (!state.url) {
      // 还没取到地址（比如首次点播放），走完整的取流流程
      void play(item)
      return
    }
    state.playing = !state.playing
  }

  /** 跳转到指定秒数；由 <audio> 宿主真正执行 */
  function seek(time: number): void {
    const t = Math.max(0, Number(time) || 0)
    state.currentTime = t
    if (seekHandler) seekHandler(t)
  }

  /** 切换音质后立刻用新音质重取当前曲目 */
  async function setQuality(q: Quality): Promise<void> {
    state.quality = q
    const item = current.value
    if (item) await resolveAndPlay(item)
  }

  return {
    state: readonly(state) as Readonly<PlayerState>,
    current,
    availableSources,
    qualityOrder,
    search, play, next, prev, toggle, seek, setQuality,
    /** 组件回灌：<audio> 的进度/时长 */
    reportTime: (t: number) => { state.currentTime = t },
    reportDuration: (d: number) => { state.duration = d },
    setVolume: (v: number) => { state.volume = v },
    setPlaying: (p: boolean) => { state.playing = p },
    setError: (msg: string) => { state.error = msg },
    clearError: () => { state.error = '' },
  }
}
