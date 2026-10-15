/**
 * 云同步的联网测试（默认跳过）。
 *
 * 运行方式：
 *   LIVE=1 pnpm vitest run tests/live-sync.test.ts
 *   LIVE=1 SYNC_TOKEN=<真实会员令牌> pnpm vitest run tests/live-sync.test.ts
 *
 * 分两层，故意的：
 *   1. 不需要令牌也能跑 —— 验证服务端对无效令牌的拒绝行为。
 *      这部分只要 LIVE=1 就会跑，因为它验证的是「不能被人白嫖」。
 *   2. 完整往返 —— 需要 SYNC_TOKEN 指向一个真实有效的音乐会员令牌。
 *      没有就跳过这层，而不是伪造一个通过的测试。
 *
 * 不把会员令牌写进仓库：它等同于账号凭证。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { setPlatform, SyncClient, DEFAULT_SYNC_BASE } from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'

const live = process.env.LIVE === '1'
const token = process.env.SYNC_TOKEN ?? ''

const EMPTY = { settings: {}, settingsUpdatedAt: 0, favorites: [], playlists: [], history: [] }

describe.skipIf(!live)('云同步服务端（联网）', () => {
  beforeAll(() => setPlatform(desktopPlatform))

  it('默认服务器是 lain42.top，且带 /studio 前缀', () => {
    // 不带 /studio 会打到前端 SPA 上返回 HTML，而不是 API
    expect(DEFAULT_SYNC_BASE).toBe('https://lain42.top/studio')
  })

  it('无效令牌被拒绝，拿不到任何数据', async () => {
    const client = new SyncClient({ baseUrl: DEFAULT_SYNC_BASE })
    await client.configure('THIS-TOKEN-DOES-NOT-EXIST-1234')
    const r = await client.sync(EMPTY)
    expect(r.state).toBe('error')
    if (r.state === 'error') {
      console.log('  rejected with:', r.reason)
      expect(r.reason).toMatch(/令牌无效|会员|HTTP 40[13]/)
    }
  }, 60000)

  describe.skipIf(!token)('完整往返（需要 SYNC_TOKEN）', () => {
    it('写入后能读回，且 revision 递增', async () => {
      const client = new SyncClient({ baseUrl: DEFAULT_SYNC_BASE, deviceName: 'vitest' })
      await client.configure(token)

      const before = await client.sync(EMPTY)
      expect(before.state).toBe('ok')
      const revBefore = before.state === 'ok' ? before.document.revision : 0
      console.log('  revision before:', revBefore)

      const marker = 'live-test-' + Date.now()
      const payload = {
        settings: { volume: 0.42 },
        settingsUpdatedAt: Date.now(),
        favorites: [{ source: 'wy', songmid: marker, name: '往返测试', singer: 'vitest', addedAt: Date.now() }],
        playlists: [],
        history: [],
      }
      const pushed = await client.sync(payload)
      expect(pushed.state).toBe('ok')
      if (pushed.state === 'ok') {
        console.log('  revision after:', pushed.document.revision)
        expect(pushed.document.revision).toBeGreaterThan(revBefore)
        expect(pushed.document.payload.favorites.some(f => f.songmid === marker)).toBe(true)
      }

      // 换一个新实例重新拉，确认真的落到服务端了而不是内存缓存
      const fresh = new SyncClient({ baseUrl: DEFAULT_SYNC_BASE })
      await fresh.configure(token)
      const pulled = await fresh.sync(EMPTY)
      expect(pulled.state).toBe('ok')
      if (pulled.state === 'ok') {
        expect(pulled.document.payload.favorites.some(f => f.songmid === marker)).toBe(true)
        console.log('  read back from server, favorites =', pulled.document.payload.favorites.length)
      }
    }, 90000)

    it('合并而非覆盖：本机独有的收藏不会被服务端抹掉', async () => {
      const client = new SyncClient({ baseUrl: DEFAULT_SYNC_BASE, deviceName: 'vitest-2' })
      await client.configure(token)
      const local = 'local-only-' + Date.now()
      const r = await client.sync({
        settings: {},
        settingsUpdatedAt: 0,
        favorites: [{ source: 'kg', songmid: local, name: '本机独有', singer: 'vitest', addedAt: Date.now() }],
        playlists: [],
        history: [],
      })
      expect(r.state).toBe('ok')
      if (r.state === 'ok') {
        expect(r.document.payload.favorites.some(f => f.songmid === local)).toBe(true)
      }
    }, 90000)
  })
})