/**
 * 好友（移动端）
 *
 * 和桌面端同一套协议；身份复用会员令牌（license.ts 里的 subscription）。
 * Hermes 没有 fetch 的问题不存在 —— RN 自带 fetch。
 */
import { useState } from 'react'
import { DEFAULT_SYNC_BASE } from '@lxmn/core'
import { subscription } from './license'

export interface FriendView {
  friendCode: string
  nickname: string
  online: boolean
  lastActiveAt: number
  friendsSince: number
}

export interface FriendPendingIn {
  id: number
  friendCode: string
  nickname: string
  createdAt: number
}

export interface FriendsState {
  me: { friendCode: string; nickname: string; online: boolean } | null
  friends: FriendView[]
  pendingIn: FriendPendingIn[]
  pendingOut: { friendCode: string; nickname: string; createdAt: number }[]
}

const OFFICIAL = DEFAULT_SYNC_BASE

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await subscription.token()
  if (!token) throw new Error('需要先开通会员')
  const r = await fetch(OFFICIAL + '/api/friends' + path, {
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

export function useFriendsApi() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true)
    setError('')
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
      return null
    } finally {
      setBusy(false)
    }
  }

  return {
    busy, error,
    refresh: () => run(async () => {
      const [mine, list] = await Promise.all([
        api<NonNullable<FriendsState['me']>>('GET', '/me'),
        api<{}>('GET', ''),
      ])
      return { mine, list: list as unknown as FriendsState }
    }),
    addByCode: (code: string) => run(() => api('POST', '/requests', { friendCode: code.trim().toUpperCase() })),
    accept: (id: number) => run(() => api('POST', '/requests/' + id + '/accept')),
    decline: (id: number) => run(() => api('POST', '/requests/' + id + '/decline')),
    remove: (code: string) => run(() => api('DELETE', '/' + code)),
    rename: (nickname: string) => run(() => api('POST', '/nickname', { nickname })),
  }
}
