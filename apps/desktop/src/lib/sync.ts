/**
 * 云同步（桌面端）
 *
 * 默认服务器就是我们的 lain42.top —— 用户什么都不用填。
 * 填了订阅链接后，同步令牌自动复用订阅令牌（会员身份即同步身份），
 * 所以「激活会员」的同时就把同步一起开通了。
 *
 * 也允许手动填自建地址：那时用独立的同步令牌。
 */
import { computed, ref } from 'vue'
import { Library, DEFAULT_SYNC_BASE, type SyncOutcome } from '@lxmn/core'
import { subscription } from './subscription'

const library = new Library()
const favorites = ref<Awaited<ReturnType<Library['snapshot']>>['favorites']>([])
const playlists = ref<Awaited<ReturnType<Library['snapshot']>>['playlists']>([])
const history = ref<Awaited<ReturnType<Library['snapshot']>>['history']>([])

const configured = ref(false)
const tokenMask = ref('')
const baseUrl = ref(DEFAULT_SYNC_BASE)
const busy = ref(false)
const error = ref('')
const lastSyncedAt = ref(0)
const lastMessage = ref('')

let wired = false

function pull(): void {
  const s = library.snapshot()
  favorites.value = s.favorites
  playlists.value = s.playlists
  history.value = s.history
}

export function useSync() {
  if (!wired) {
    wired = true
    library.subscribe(pull)
  }

  const server = computed(() => library.syncServer)

  /** 掩码显示令牌，避免在界面上明文暴露订阅链接 */
  function mask(t: string): string {
    if (!t) return ''
    if (t.length <= 8) return t[0] + '****'
    return t.slice(0, 4) + '****' + t.slice(-4)
  }

  async function restore(): Promise<void> {
    await library.load()
    pull()
    const r = await library.restoreSync()
    configured.value = r.configured
    lastSyncedAt.value = r.syncedAt
    pull()
    const t = await library.syncToken()
    tokenMask.value = mask(t)
    if (r.configured) {
      const s = library.snapshot()
      favorites.value = s.favorites
      playlists.value = s.playlists
      history.value = s.history
    }
  }

  /** 用订阅令牌（或自建令牌）开启同步 */
  async function connect(token: string, base?: string): Promise<void> {
    const t = token.trim()
    if (!t) {
      error.value = '请先填入订阅链接或同步令牌'
      return
    }
    busy.value = true
    error.value = ''
    lastMessage.value = ''
    try {
      if (base && base.trim() && base.trim() !== DEFAULT_SYNC_BASE) {
        baseUrl.value = base.trim()
      }
      await library.configureSync(t, baseUrl.value)
      configured.value = true
      tokenMask.value = mask(t)
      await syncNow()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      busy.value = false
    }
  }

  /**
   * 用当前会员的订阅令牌一键开通同步。
   *
   * 令牌从共享的 SubscriptionClient 缓存里取 —— 用户已经为了音源填过
   * 一次链接，不该再让他为同步填第二次。
   */
  async function connectWithMembership(): Promise<void> {
    const t = await subscription.token()
    if (!t) {
      error.value = '没有找到订阅令牌，请先到「音乐会员」页激活订阅链接'
      return
    }
    await connect(t, baseUrl.value)
  }

  async function disconnect(): Promise<void> {
    await library.disableSync()
    configured.value = false
    tokenMask.value = ''
    lastMessage.value = '已关闭云同步（本地收藏保留）'
  }

  /** 同步一次，并把结果翻译成人话 */
  async function syncNow(): Promise<SyncOutcome | null> {
    busy.value = true
    error.value = ''
    try {
      const r = await library.syncNow()
      pull()
      switch (r.state) {
        case 'ok':
          lastSyncedAt.value = Date.now()
          lastMessage.value = r.pushed ? '已上传本机改动' : '已是最新'
          break
        case 'conflict':
          lastMessage.value = '另一台设备也在改，已合并，稍后再同步一次即可'
          break
        case 'disabled':
          configured.value = false
          lastMessage.value = r.reason
          break
        case 'error':
          error.value = r.reason
          break
      }
      return r
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return null
    } finally {
      busy.value = false
    }
  }

  return {
    library, favorites, playlists, history,
    configured, tokenMask, baseUrl, busy, error, lastSyncedAt, lastMessage, server,
    restore, connect, connectWithMembership, disconnect, syncNow, pull,
    DEFAULT_SYNC_BASE,
  }
}

export { library }
