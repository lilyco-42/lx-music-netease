/**
 * 歌单分享 + 好友动态（移动端）
 */
import { DEFAULT_SYNC_BASE } from '@lxmn/core'
import { subscription } from './license'

export interface FeedItem {
  kind: 'share_playlist'
  payload: { shareCode: string; name: string; count: number }
  nickname: string
  friendCode: string
  createdAt: number
}

export interface SharedPlaylist {
  shareCode: string
  name: string
  tracks: { name: string; singer: string; source: string; songmid: string; picUrl?: string }[]
  trackCount: number
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

export async function pullFeed(): Promise<{ items: FeedItem[]; unread: number } | null> {
  try {
    return await api<{ items: FeedItem[]; unread: number }>('GET', '/api/feed')
  } catch {
    return null
  }
}

export async function getShared(code: string): Promise<SharedPlaylist | null> {
  try {
    return await api<SharedPlaylist>('GET', '/api/share/' + code.trim().toUpperCase())
  } catch {
    return null
  }
}

export async function sharePlaylist(name: string, tracks: SharedPlaylist['tracks']): Promise<string | null> {
  try {
    const r = await api<{ shareCode: string }>('POST', '/api/share/playlist', { name, tracks })
    return r.shareCode
  } catch {
    return null
  }
}
