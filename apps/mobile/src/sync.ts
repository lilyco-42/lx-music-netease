/**
 * 云同步（移动端）
 *
 * 与桌面端共用 @lxmn/core 的 Library + SyncClient，因此两端的合并规则、
 * 去重规则、上限完全一致 —— 同步才不会因为两端规则不同而互相覆盖。
 *
 * 默认服务器就是 lain42.top，用户什么都不用填。
 */
import { Library, DEFAULT_SYNC_BASE } from '@lxmn/core'
import type { SyncOutcome } from '@lxmn/core'
import { subscription } from './license'

export const library = new Library()

/** 订阅客户端暴露出来，供「用会员订阅一键开通」取令牌 */
export { subscription }

export function snapshot() {
  return library.snapshot()
}

export async function loadLibrary(): Promise<void> {
  await library.load()
}

/** 恢复上次同步的数据（离线也能用） */
export async function restoreSync(): Promise<{ configured: boolean; syncedAt: number }> {
  await library.load()
  const r = await library.restoreSync()
  return { configured: r.configured, syncedAt: r.syncedAt }
}

export async function syncConfigured(): Promise<boolean> {
  return library.syncConfigured()
}

export async function syncToken(): Promise<string> {
  return library.syncToken()
}

/** 用会员订阅令牌开通同步（会员身份即同步身份） */
export async function connectWithMembership(): Promise<SyncOutcome | null> {
  const t = await subscription.token()
  if (!t) throw new Error('没有找到订阅令牌，请先激活订阅链接')
  await library.configureSync(t, DEFAULT_SYNC_BASE)
  return library.syncNow()
}

/** 用自建服务器 + 独立令牌开通同步 */
export async function connectCustom(base: string, token: string): Promise<SyncOutcome | null> {
  const t = token.trim()
  if (!t) throw new Error('请填入同步令牌')
  await library.configureSync(t, base.trim() || DEFAULT_SYNC_BASE)
  return library.syncNow()
}

export async function disconnectSync(): Promise<void> {
  await library.disableSync()
}

export async function syncNow(): Promise<SyncOutcome> {
  return library.syncNow()
}

export const syncServer = DEFAULT_SYNC_BASE
