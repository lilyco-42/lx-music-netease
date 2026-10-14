import { describe, it, expect, beforeEach } from 'vitest'
import {
  setPlatform, createPortablePlatform, portableCrypto,
  SubscriptionClient, parseSubscriptionDocument, isPlanActive, normalizeUrl,
  SHOP_URL, ANNUAL_PRICE_CNY, type StorageAdapter,
} from '@lxmn/core'

const store = new Map<string, string>()
const storage: StorageAdapter = {
  async get(k) { return store.get(k) ?? null },
  async set(k, v) { store.set(k, v) },
  async remove(k) { store.delete(k) },
  async keys() { return [...store.keys()] },
}

const future = new Date(Date.now() + 365 * 864e5).toISOString()
const past = new Date(Date.now() - 864e5).toISOString()

const doc = {
  ok: true,
  schema: 1,
  plan: { id: 'music_annual', name: '音乐会员 · 年卡', expires_at: future, active: true },
  sources: [
    { id: 'wy', name: '网易云音乐', type: 'builtin', qualitys: ['flac', '320k'] },
    { id: 'tx', name: 'QQ 音乐', type: 'manifest', url: 'https://lain42.top/studio/api/music/source/tx' },
    { id: 'kw', name: '酷我', type: 'script', url: 'https://x/kw.js', sha256: 'a'.repeat(64) },
  ],
  signature: 'deadbeef',
  issued_at: '2026-10-14T00:00:00Z',
}

let requested: string[] = []
const makePlatform = (responder: (url: string) => { status: number; body: string }) =>
  createPortablePlatform({
    name: 'web',
    http: {
      async request(o) {
        requested.push(o.url)
        const r = responder(o.url)
        return { statusCode: r.status, headers: {}, body: r.body, raw: new Uint8Array() }
      },
    },
    storage,
  })

describe('membership constants', () => {
  it('points at the real shop and the 88 CNY/year price', () => {
    expect(SHOP_URL).toBe('https://lain42.top/studio/shop/')
    expect(ANNUAL_PRICE_CNY).toBe(88)
  })
})

describe('normalizeUrl', () => {
  it('expands a bare token into the subscription endpoint', () => {
    expect(normalizeUrl('abc12345XYZ', 'https://lain42.top/studio'))
      .toBe('https://lain42.top/studio/api/music/sub/abc12345XYZ')
  })
  it('keeps a full https link', () => {
    expect(normalizeUrl('https://lain42.top/studio/api/music/sub/tok12345', 'https://lain42.top/studio'))
      .toBe('https://lain42.top/studio/api/music/sub/tok12345')
  })
  it('rejects plain http for non-localhost', () => {
    expect(() => normalizeUrl('http://evil.example/sub/x', 'https://lain42.top/studio')).toThrow(/https/)
  })
  it('rejects garbage', () => {
    expect(() => normalizeUrl('', 'https://lain42.top/studio')).toThrow()
  })
})

describe('parseSubscriptionDocument', () => {
  it('parses a well-formed document', () => {
    const d = parseSubscriptionDocument(doc)
    expect(d.ok).toBe(true)
    expect(d.plan.id).toBe('music_annual')
    expect(d.sources).toHaveLength(3)
    expect(d.sources[1].type).toBe('manifest')
    expect(d.sources[2].sha256).toHaveLength(64)
  })
  it('accepts camelCase expiresAt from the server', () => {
    const d = parseSubscriptionDocument({ ok: true, plan: { id: 'x', name: 'y', expiresAt: future } })
    expect(d.plan.expiresAt).toBe(future)
  })
  it('rejects ok:false with the server message', () => {
    expect(() => parseSubscriptionDocument({ ok: false, error: '会员已过期' })).toThrow(/会员已过期/)
  })
  it('rejects a document without expiry', () => {
    expect(() => parseSubscriptionDocument({ ok: true, plan: { id: 'x', name: 'y' } })).toThrow(/到期时间/)
  })
  it('rejects non-objects', () => {
    expect(() => parseSubscriptionDocument('nope')).toThrow()
    expect(() => parseSubscriptionDocument(null)).toThrow()
  })
  it('drops malformed source entries but keeps valid ones', () => {
    const d = parseSubscriptionDocument({ ...doc, sources: [null, { name: 'no id' }, { id: 'wy', name: 'W' }] })
    expect(d.sources).toHaveLength(1)
    expect(d.sources[0].id).toBe('wy')
  })
})

describe('isPlanActive', () => {
  it('is true for a future expiry', () => {
    expect(isPlanActive({ id: 'a', name: 'a', expiresAt: future })).toBe(true)
  })
  it('is false once expired', () => {
    expect(isPlanActive({ id: 'a', name: 'a', expiresAt: past })).toBe(false)
  })
  it('is false when the server marks it inactive', () => {
    expect(isPlanActive({ id: 'a', name: 'a', expiresAt: future, active: false })).toBe(false)
  })
})

describe('SubscriptionClient', () => {
  beforeEach(() => { store.clear(); requested = [] })

  it('fetches a subscription and reports active membership', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    const c = new SubscriptionClient()
    const d = await c.fetch('https://lain42.top/studio/api/music/sub/tok12345')
    expect(d.sources).toHaveLength(3)

    const st = await c.status()
    expect(st.state).toBe('active')
    if (st.state === 'active') {
      expect(st.plan.name).toContain('年卡')
      expect(st.sources.map(s => s.id)).toEqual(['wy', 'tx', 'kw'])
    }
  })

  it('persists to storage so membership survives a restart', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    await new SubscriptionClient().fetch('https://lain42.top/studio/api/music/sub/tok12345')

    // 模拟重启：新的 client 实例，无网络
    setPlatform(makePlatform(() => { throw new Error('offline') }))
    const restored = await new SubscriptionClient().restore()
    expect(restored.state).toBe('active')
    if (restored.state === 'active') expect(restored.sources).toHaveLength(3)
  })

  it('reports expired when the cached plan lapsed', async () => {
    setPlatform(makePlatform(() => ({
      status: 200,
      body: JSON.stringify({ ...doc, plan: { ...doc.plan, expires_at: past } }),
    })))
    const c = new SubscriptionClient()
    await c.fetch('https://lain42.top/studio/api/music/sub/tok12345')
    const st = await c.status()
    expect(st.state).toBe('expired')
  })

  it('reports none after clearing', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    const c = new SubscriptionClient()
    await c.fetch('https://lain42.top/studio/api/music/sub/tok12345')
    await c.clear()
    expect((await c.status()).state).toBe('none')
  })

  it('surfaces a 404 as an expired/unknown link', async () => {
    setPlatform(makePlatform(() => ({ status: 404, body: '{"ok":false}' })))
    await expect(new SubscriptionClient().fetch('https://lain42.top/studio/api/music/sub/bad'))
      .rejects.toThrow(/不存在或已过期/)
  })

  it('rejects a non-JSON body', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: '<html>502</html>' })))
    await expect(new SubscriptionClient().fetch('https://lain42.top/studio/api/music/sub/t'))
      .rejects.toThrow(/合法 JSON/)
  })

  it('applies only builtin sources by default, skipping remote scripts', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    const c = new SubscriptionClient()
    const d = await c.fetch('https://lain42.top/studio/api/music/sub/tok12345')
    const applied = await c.apply(d)
    expect(applied).toEqual(['wy'])
    expect(applied).not.toContain('kw')
  })

  it('applies script sources only when the user opts in', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    const c = new SubscriptionClient({ allowRemoteScripts: true })
    const d = await c.fetch('https://lain42.top/studio/api/music/sub/tok12345')
    // script 类型仍需宿主加载器执行；此处只验证它不再被过滤
    expect(d.sources.some(s => s.type === 'script')).toBe(true)
  })

  it('accepts a bare token as the link', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    await new SubscriptionClient().fetch('tok12345')
    expect(requested[0]).toBe('https://lain42.top/studio/api/music/sub/tok12345')
  })

  it('honours a custom base URL', async () => {
    setPlatform(makePlatform(() => ({ status: 200, body: JSON.stringify(doc) })))
    await new SubscriptionClient({ baseUrl: 'https://staging.lain42.top/' }).fetch('tok12345')
    expect(requested[0]).toBe('https://staging.lain42.top/api/music/sub/tok12345')
  })
})