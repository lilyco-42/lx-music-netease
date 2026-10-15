/**
 * 会员 / 音源订阅（桌面端）
 *
 * 流程：用户在 https://lain42.top/studio/shop/ 用积分购买「音乐会员 · 年卡」，
 * 在「我的账户」复制订阅链接，粘进客户端即可补全全部第三方音源。
 *
 * 这是响应式的薄封装：SubscriptionClient 负责协议与缓存，这里只把它接到 Vue。
 */
import { computed, ref } from 'vue'
import { SubscriptionClient, SHOP_URL, ANNUAL_PRICE_CNY } from '@lxmn/core'
import type { MembershipStatus, ApplyResult } from '@lxmn/core'

const client = new SubscriptionClient()
const status = ref<MembershipStatus>({ state: 'none' })
const busy = ref(false)
const error = ref('')

/** 上次 apply() 的结果：可用 / 未实现 / 跳过 */
const applyResult = ref<ApplyResult>({ applied: [], unavailable: [], skipped: [] })

export function useMembership() {
  const isActive = computed(() => status.value.state === 'active')
  const plan = computed(() => (status.value.state === 'active' ? status.value.plan : null))
  const sources = computed(() => (status.value.state === 'active' ? status.value.sources : []))

  /** 启动时从本地缓存恢复（离线可用） */
  async function restore(): Promise<void> {
    status.value = await client.restore()
    if (status.value.state === 'active') {
      applyResult.value = await client.apply({ ok: true, schema: 1, plan: status.value.plan, sources: status.value.sources })
    }
  }

  /** 激活订阅链接 */
  async function activate(link: string): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      const doc = await client.fetch(link.trim())
      applyResult.value = await client.apply(doc)
      status.value = { state: 'active', plan: doc.plan, sources: doc.sources }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      busy.value = false
    }
  }

  /** 刷新状态 */
  async function refresh(): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      status.value = await client.status()
    } finally {
      busy.value = false
    }
  }

  /** 退出会员 */
  async function clear(): Promise<void> {
    await client.clear()
    applyResult.value = { applied: [], unavailable: [], skipped: [] }
    status.value = { state: 'none' }
    error.value = ''
  }

  /** 打开购买页（Electron 下由主进程交给系统浏览器） */
  function openShop(): void {
    const bridge = (window as unknown as { lxmnNative?: { openExternal?: (u: string) => void } }).lxmnNative
    if (bridge?.openExternal) bridge.openExternal(SHOP_URL)
    else window.open(SHOP_URL, '_blank', 'noopener')
  }

  return {
    status, busy, error, applyResult, isActive, plan, sources,
    restore, activate, refresh, clear, openShop,
    SHOP_URL, ANNUAL_PRICE_CNY,
  }
}
