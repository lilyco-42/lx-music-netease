/**
 * 好友（桌面端）
 *
 * 身份即订阅：好友身份直接复用会员令牌，界面里只展示好友码。
 * 所有请求走 https://lain42.top/studio，自建同步服务器不带好友功能
 * （好友是官方服务端的语义，不是同步文档的一部分）。
 */
import { computed, ref } from 'vue'
import { DEFAULT_SYNC_BASE } from '@lxmn/core'
import { subscription } from './subscription'

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

export interface FriendPendingOut {
  friendCode: string
  nickname: string
  createdAt: number
}

export interface FriendsState {
  me: { friendCode: string; nickname: string; online: boolean } | null
  friends: FriendView[]
  pendingIn: FriendPendingIn[]
  pendingOut: FriendPendingOut[]
}

const OFFICIAL = DEFAULT_SYNC_BASE

const me = ref<FriendsState['me']>(null)
const friends = ref<FriendView[]>([])
const pendingIn = ref<FriendPendingIn[]>([])
const pendingOut = ref<FriendPendingOut[]>([])
const busy = ref(false)
const error = ref('')
const loaded = ref(false)

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

/** 拉取我的身份 + 好友列表 + 待处理请求 */
async function refresh(force = false): Promise<void> {
  if (loaded.value && !force) return
  busy.value = true
  error.value = ''
  try {
    const [mine, list] = await Promise.all([
      api<NonNullable<FriendsState['me']>>('GET', '/me'),
      api<{}>('GET', ''),
    ])
    me.value = mine
    const l = list as unknown as FriendsState
    friends.value = l.friends ?? []
    pendingIn.value = l.pendingIn ?? []
    pendingOut.value = l.pendingOut ?? []
    loaded.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    busy.value = false
  }
}

async function addByCode(code: string): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    await api('POST', '/requests', { friendCode: code.trim().toUpperCase() })
    await refresh(true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
    throw e
  } finally {
    busy.value = false
  }
}

async function accept(id: number): Promise<void> {
  await api('POST', '/requests/' + id + '/accept')
  await refresh(true)
}

async function decline(id: number): Promise<void> {
  await api('POST', '/requests/' + id + '/decline')
  await refresh(true)
}

async function remove(code: string): Promise<void> {
  await api('DELETE', '/' + code)
  await refresh(true)
}

async function rename(nickname: string): Promise<void> {
  await api('POST', '/nickname', { nickname })
  await refresh(true)
}

export function useFriends() {
  return {
    me, friends, pendingIn, pendingOut, busy, error, loaded,
    refresh, addByCode, accept, decline, remove, rename,
  }
}
