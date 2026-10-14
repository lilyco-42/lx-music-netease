/**
 * 订阅客户端：把「一条链接」变成「可用的音源集合」
 *
 * 对应 lx-music 原版的「导入自定义源」，但做成了订阅制：
 *   1. 用户在商城购买会员 → 得到 https://lain42.top/studio/api/music/sub/<token>
 *   2. 客户端填入该链接
 *   3. 拉取订阅文档 → 校验 → 注册音源
 *   4. 到期自动失效
 */
import { getPlatform } from '../registry'
import type { SourceId, Quality } from '../types'
import { registerSource, setSupportQuality } from '../sources/registry'
import type {
  MembershipPlan,
  MembershipStatus,
  SubscribedSource,
  SubscriptionClientOptions,
  SubscriptionDocument,
} from './types'

/**
 * 服务端根地址。
 *
 * 必须带 /studio 前缀：pingap 只把 https://lain42.top/studio/api/* 反代到
 * billing 服务；裸域名的 /api/* 会命中前端 SPA 并返回 HTML。
 */
const DEFAULT_BASE = 'https://lain42.top/studio'
const DEFAULT_KEY = 'lxmn.subscription'

interface CacheEntry {
  url: string
  fetchedAt: number
  doc: SubscriptionDocument
}

function normalizeUrl(input: string, baseUrl: string): string {
  const raw = input.trim()
  if (!raw) throw new Error('[lxmn/license] 订阅链接为空')
  // 允许用户只粘贴 token
  if (/^[A-Za-z0-9_-]{8,}$/.test(raw)) {
    return `${baseUrl.replace(/\/$/, '')}/api/music/sub/${raw}`
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('[lxmn/license] 订阅链接格式不正确')
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('[lxmn/license] 订阅链接必须使用 https')
  }
  return url.toString()
}

/** 解析服务端返回的订阅文档 */
export function parseSubscriptionDocument(input: unknown): SubscriptionDocument {
  if (!input || typeof input !== 'object') {
    throw new Error('[lxmn/license] 订阅内容不是合法的 JSON 对象')
  }
  const d = input as Record<string, unknown>
  if (d.ok !== true) {
    throw new Error(`[lxmn/license] 订阅无效：${String(d.error ?? d.message ?? '服务端拒绝了该链接')}`)
  }
  const plan = d.plan as Record<string, unknown> | undefined
  if (!plan || typeof plan !== 'object') {
    throw new Error('[lxmn/license] 订阅缺少会员信息')
  }
  const expiresAt = String(plan.expires_at ?? plan.expiresAt ?? '')
  if (!expiresAt) throw new Error('[lxmn/license] 订阅缺少到期时间')

  const rawSources = Array.isArray(d.sources) ? d.sources : []
  const sources: SubscribedSource[] = rawSources
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      id: String(s.id ?? '') as SourceId,
      name: String(s.name ?? s.id ?? ''),
      type: (s.type === 'manifest' || s.type === 'script' ? s.type : 'builtin') as SubscribedSource['type'],
      url: s.url ? String(s.url) : undefined,
      sha256: s.sha256 ? String(s.sha256) : undefined,
      version: s.version ? String(s.version) : undefined,
      qualitys: Array.isArray(s.qualitys) ? s.qualitys.map(String) : undefined,
      note: s.note ? String(s.note) : undefined,
    }))
    .filter(s => s.id)

  return {
    ok: true,
    schema: Number(d.schema ?? 1),
    plan: {
      id: String(plan.id ?? 'music_annual'),
      name: String(plan.name ?? '音乐会员'),
      expiresAt,
      active: plan.active !== false,
    },
    sources,
    signature: d.signature ? String(d.signature) : undefined,
    issuedAt: d.issued_at ? String(d.issued_at) : undefined,
  }
}

export function isPlanActive(plan: MembershipPlan, now = Date.now()): boolean {
  if (plan.active === false) return false
  const t = Date.parse(plan.expiresAt)
  return Number.isFinite(t) && t > now
}

export class SubscriptionClient {
  private readonly baseUrl: string
  private readonly storageKey: string
  private readonly allowRemoteScripts: boolean
  private cache: CacheEntry | null = null

  constructor(options: SubscriptionClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '')
    this.storageKey = options.storageKey ?? DEFAULT_KEY
    this.allowRemoteScripts = options.allowRemoteScripts ?? false
  }

  /** 拉取并解析订阅；结果写入本地缓存 */
  async fetch(link: string): Promise<SubscriptionDocument> {
    const url = normalizeUrl(link, this.baseUrl)
    const { http } = getPlatform()

    const res = await http.request({ url, method: 'GET', timeout: 15000 })
    if (res.statusCode === 404) throw new Error('[lxmn/license] 订阅链接不存在或已过期')
    if (res.statusCode !== 200) {
      throw new Error(`[lxmn/license] 订阅请求失败（HTTP ${res.statusCode}）`)
    }

    let json: unknown
    try {
      json = JSON.parse(res.body)
    } catch {
      throw new Error('[lxmn/license] 订阅内容不是合法 JSON')
    }

    const doc = parseSubscriptionDocument(json)
    this.cache = { url, fetchedAt: Date.now(), doc }
    try {
      await getPlatform().storage.set(this.storageKey, JSON.stringify({ url, doc }))
    } catch {
      // 缓存失败不影响主流程
    }
    return doc
  }

  /** 从本地缓存恢复（离线可用） */
  async restore(): Promise<MembershipStatus> {
    try {
      const raw = await getPlatform().storage.get(this.storageKey)
      if (!raw) return { state: 'none' }
      const parsed = JSON.parse(raw) as { url: string; doc: SubscriptionDocument }
      const doc = parseSubscriptionDocument(parsed.doc)
      this.cache = { url: parsed.url, fetchedAt: Date.now(), doc }
      if (!isPlanActive(doc.plan)) return { state: 'expired', plan: doc.plan }
      return { state: 'active', plan: doc.plan, sources: doc.sources }
    } catch {
      return { state: 'none' }
    }
  }

  /** 校验当前会员状态（优先走网络，失败回落缓存） */
  async status(): Promise<MembershipStatus> {
    if (!this.cache) {
      const restored = await this.restore()
      if (restored.state === 'none') return restored
    }
    if (!this.cache) return { state: 'none' }
    const { doc } = this.cache
    if (!isPlanActive(doc.plan)) return { state: 'expired', plan: doc.plan }
    return { state: 'active', plan: doc.plan, sources: doc.sources }
  }

  /** 清除本地订阅（退出会员 / 换链接） */
  async clear(): Promise<void> {
    this.cache = null
    try {
      await getPlatform().storage.remove(this.storageKey)
    } catch {
      // ignore
    }
  }

  /**
   * 把订阅里的音源注册进内核。
   * 返回实际生效的音源 id 列表。
   *
   * builtin 类型由宿主提前注册（见各音源的 installXxxSource）；
   * manifest / script 类型在此处按需加载。
   */
  async apply(doc: SubscriptionDocument): Promise<string[]> {
    const applied: string[] = []
    for (const s of doc.sources) {
      if (s.type === 'script' && !this.allowRemoteScripts) {
        // 远程脚本默认不执行：需要用户显式同意
        continue
      }
      if (s.type === 'builtin') {
        if (s.qualitys?.length) {
          setSupportQuality(s.id as SourceId, s.qualitys as Quality[])
        }
        applied.push(s.id)
      }
    }
    return applied
  }
}

export { normalizeUrl }
export type { MembershipPlan, MembershipStatus, SubscribedSource, SubscriptionDocument, SubscriptionClientOptions }
export { registerSource }
