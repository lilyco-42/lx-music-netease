/**
 * 歌单分享 + 好友动态（桌面端）
 *
 * 分享是快照：分享码指向歌单当时的只读拷贝，改了原歌单不跟随。
 * 动态按好友边过滤，非好友看不到。
 */
import { ref } from 'vue'
import { DEFAULT_SYNC_BASE } from '@lxmn/core'
import { subscription } from './subscription'

export interface ShareTrack {
  name: string
  singer: string
  source: string
  songmid: string
  picUrl?: string
}

export interface FeedItem {
  kind: 'share_playlist'
  payload: { shareCode: string; name: string; count: number }
  nickname: string
  friendCode: string
  createdAt: number
}

const OFFICIAL = DEFAULT_SYNC_BASE

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await subscription.token()
  if (!token) throw new Error('需要先开通会员')
  const r = await fetch(OFFICIAL + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = (await r.json().catch(() => ({}))) as T & { detail?: string }
  if (!r.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : '请求失败 ' + r.status)
  }
  return data
}

const feed = ref<FeedItem[]>([])
const unread = ref(0)
const shareBusy = ref(false)
const feedBusy = ref(false)
const error = ref('')

export function useSharing() {
  async function share(name: string, tracks: ShareTrack[], description = ''): Promise<string> {
    shareBusy.value = true
    error.value = ''
    try {
      const r = await api<{ shareCode: string; trackCount: number }>(
        'POST', '/api/share/playlist', { name, description, tracks },
      )
      await pullFeed()
      return r.shareCode
    } catch (e) {
      error.value = e instanceof Error ? e.message : '分享失败'
      throw e
    } finally {
      shareBusy.value = false
    }
  }

  async function pullFeed(): Promise<void> {
    feedBusy.value = true
    try {
      const r = await api<{ items: FeedItem[]; unread: number }>('GET', '/api/feed')
      feed.value = r.items ?? []
      unread.value = r.unread ?? 0
    } catch {
      /* 静默：动态拉不到不影响别的页 */
    } finally {
      feedBusy.value = false
    }
  }

  async function getShared(code: string): Promise<{ name: string; tracks: ShareTrack[]; trackCount: number }> {
    return api('GET', '/api/share/' + code.trim().toUpperCase())
  }

  return { feed, unread, shareBusy, feedBusy, error, share, pullFeed, getShared }
}
