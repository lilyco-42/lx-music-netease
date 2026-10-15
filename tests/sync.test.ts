/**
 * 云同步的合并逻辑测试。
 *
 * 合并是纯函数，所以能被穷举验证。这里重点验三件事：
 *   1. 交换律 —— merge(a,b) 必须等于 merge(b,a)，否则两台设备会来回覆盖对方
 *   2. 幂等 —— merge(a,a) 必须等于 a，否则每同步一次数据就膨胀一点
 *   3. 不丢数据 —— 任何一边独有的条目都必须出现在结果里
 */
import { describe, it, expect } from 'vitest'
import {
  mergePayload,
  mergeFavorites,
  mergeHistory,
  mergePlaylists,
  mergeSettings,
  trackKey,
  isEmptyPayload,
  payloadSize,
  emptyPayload,
  type SyncFavorite,
  type SyncHistoryEntry,
  type SyncPlaylist,
} from '@lxmn/core'

function fav(source: string, songmid: string, name: string, addedAt: number): SyncFavorite {
  return { source, songmid, name, singer: 'x', addedAt }
}
function hist(source: string, songmid: string, playedAt: number, playCount: number): SyncHistoryEntry {
  return { source, songmid, name: 'n', singer: 'x', playedAt, playCount }
}
function pl(id: string, name: string, updatedAt: number, mids: string[]): SyncPlaylist {
  return {
    id, name, createdAt: 1, updatedAt,
    items: mids.map(m => ({ source: 'wy', songmid: m, name: 'n', singer: 'x' })),
  }
}

describe('trackKey', () => {
  it('把 source 和 songmid 拼成稳定的键', () => {
    expect(trackKey({ source: 'wy', songmid: '123' })).toBe('wy::123')
  })
  it('跨音源的同一首歌算两条 —— songmid 不通用', () => {
    expect(trackKey({ source: 'wy', songmid: '1' })).not.toBe(trackKey({ source: 'kg', songmid: '1' }))
  })
  it('数字和字符串 songmid 视为同一个', () => {
    expect(trackKey({ source: 'wy', songmid: 123 })).toBe(trackKey({ source: 'wy', songmid: '123' }))
  })
})

describe('mergeFavorites', () => {
  it('并集去重', () => {
    const a = [fav('wy', '1', 'A', 100)]
    const b = [fav('kg', '2', 'B', 200)]
    expect(mergeFavorites(a, b)).toHaveLength(2)
  })

  it('重复条目保留较新的字段，但 addedAt 取更早的（首次收藏时间更真实）', () => {
    const a = [fav('wy', '1', '旧名', 500)]
    const b = [fav('wy', '1', '新名', 900)]
    const out = mergeFavorites(a, b)
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('新名')
    expect(out[0]!.addedAt).toBe(500)
  })

  it('交换律：merge(a,b) === merge(b,a)', () => {
    const a = [fav('wy', '1', 'A', 100), fav('wy', '2', 'B', 300)]
    const b = [fav('wy', '2', 'B2', 500), fav('kg', '3', 'C', 200)]
    expect(JSON.stringify(mergeFavorites(a, b))).toBe(JSON.stringify(mergeFavorites(b, a)))
  })

  it('幂等：merge(a,a) === a', () => {
    const a = [fav('wy', '1', 'A', 100), fav('kg', '2', 'B', 200)]
    expect(mergeFavorites(a, a)).toEqual(mergeFavorites(a, []))
  })

  it('按收藏时间倒序', () => {
    const out = mergeFavorites([fav('wy', '1', 'A', 100)], [fav('wy', '2', 'B', 900)])
    expect(out.map(x => x.name)).toEqual(['B', 'A'])
  })

  it('空输入不炸', () => {
    expect(mergeFavorites([], [])).toEqual([])
  })
})

describe('mergeHistory', () => {
  it('播放次数取最大值而不是相加 —— 两台机器各听 3 次不是 6 次', () => {
    const a = [hist('wy', '1', 100, 3)]
    const b = [hist('wy', '1', 200, 3)]
    const out = mergeHistory(a, b)
    expect(out).toHaveLength(1)
    expect(out[0]!.playCount).toBe(3)
    expect(out[0]!.playedAt).toBe(200)
  })

  it('取较新的播放时间', () => {
    const out = mergeHistory([hist('wy', '1', 900, 1)], [hist('wy', '1', 100, 5)])
    expect(out[0]!.playedAt).toBe(900)
    expect(out[0]!.playCount).toBe(5)
  })

  it('交换律', () => {
    const a = [hist('wy', '1', 100, 1), hist('wy', '2', 700, 2)]
    const b = [hist('kg', '3', 300, 4), hist('wy', '2', 700, 9)]
    expect(JSON.stringify(mergeHistory(a, b))).toBe(JSON.stringify(mergeHistory(b, a)))
  })

  it('按最近播放倒序', () => {
    const out = mergeHistory([hist('wy', '1', 100, 1)], [hist('wy', '2', 900, 1)])
    expect(out.map(x => x.songmid)).toEqual(['2', '1'])
  })
})

describe('mergePlaylists', () => {
  it('updatedAt 新的一方条目顺序胜出', () => {
    const a = pl('p1', 'A', 100, ['1', '2'])
    const b = pl('p1', 'A', 500, ['2', '1'])
    const out = mergePlaylists([a], [b])
    expect(out).toHaveLength(1)
    expect(out[0]!.items.map(i => i.songmid)).toEqual(['2', '1'])
  })

  it('条目做并集，独有条目追加到末尾，不打乱手排顺序', () => {
    const a = pl('p1', 'A', 100, ['1', '2'])
    const b = pl('p1', 'A', 500, ['2', '3'])
    const out = mergePlaylists([a], [b])
    expect(out[0]!.items.map(i => i.songmid)).toEqual(['2', '3', '1'])
  })

  it('createdAt 取更早的（首次创建时间）', () => {
    const a = { ...pl('p1', 'A', 100, []), createdAt: 50 }
    const b = { ...pl('p1', 'A', 500, []), createdAt: 80 }
    expect(mergePlaylists([a], [b])[0]!.createdAt).toBe(50)
  })

  it('不同 id 的歌单都保留', () => {
    const out = mergePlaylists([pl('p1', 'A', 100, [])], [pl('p2', 'B', 200, [])])
    expect(out.map(p => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('交换律', () => {
    const a = [pl('p1', 'A', 100, ['1', '2'])]
    const b = [pl('p1', 'A', 500, ['3']), pl('p2', 'B', 200, ['9'])]
    expect(JSON.stringify(mergePlaylists(a, b))).toBe(JSON.stringify(mergePlaylists(b, a)))
  })
})

describe('mergeSettings', () => {
  it('远端更新则远端整份取胜', () => {
    expect(mergeSettings({ quality: '128k' }, { quality: '320k' }, 100, 200))
      .toEqual({ quality: '320k' })
  })
  it('本地更新则本地整份取胜', () => {
    expect(mergeSettings({ quality: '128k' }, { quality: '320k' }, 200, 100))
      .toEqual({ quality: '128k' })
  })
  it('时间戳相同偏向本地，保证结果确定', () => {
    expect(mergeSettings({ quality: '128k' }, { quality: '320k' }, 100, 100))
      .toEqual({ quality: '128k' })
  })
  it('交换律：谁新谁赢，与参数顺序无关', () => {
    const a = { quality: '128k' }
    const b = { quality: '320k' }
    expect(mergeSettings(a, b, 100, 200)).toEqual(mergeSettings(b, a, 200, 100))
  })
})

describe('mergePayload 整体性质', () => {
  const A = {
    settings: { quality: '320k', volume: 0.5 },
    settingsUpdatedAt: 100,
    favorites: [fav('wy', '1', 'A', 100)],
    playlists: [pl('p1', 'L1', 100, ['1'])],
    history: [hist('wy', '1', 100, 1)],
  }
  const B = {
    settings: { quality: 'flac' },
    settingsUpdatedAt: 200,
    favorites: [fav('kg', '2', 'B', 200)],
    playlists: [pl('p1', 'L1', 200, ['1', '2'])],
    history: [hist('wy', '1', 300, 5)],
  }

  it('交换律 —— 谁先同步不影响最终状态', () => {
    expect(JSON.stringify(mergePayload(A, B))).toBe(JSON.stringify(mergePayload(B, A)))
  })
  it('幂等 —— 反复同步不会让数据膨胀', () => {
    const once = mergePayload(A, B)
    expect(mergePayload(once, once)).toEqual(once)
  })
  it('不丢数据 —— 两边独有的条目都在结果里', () => {
    const out = mergePayload(A, B)
    expect(out.favorites).toHaveLength(2)
    expect(out.playlists[0]!.items).toHaveLength(2)
  })
  it('缺字段的载荷按空处理，不炸', () => {
    const sparse = { settings: {} } as never
    expect(() => mergePayload(sparse, A)).not.toThrow()
    expect(mergePayload(sparse, A).favorites).toHaveLength(1)
  })
})

describe('emptyPayload / isEmptyPayload / payloadSize', () => {
  it('空载荷被识别为空', () => {
    expect(isEmptyPayload(emptyPayload())).toBe(true)
  })
  it('有收藏就不算空', () => {
    expect(isEmptyPayload({ ...emptyPayload(), favorites: [fav('wy', '1', 'A', 1)] })).toBe(false)
  })
  it('有设置就不算空', () => {
    expect(isEmptyPayload({ ...emptyPayload(), settings: { volume: 0.5 } })).toBe(false)
  })
  it('payloadSize 返回 JSON 长度', () => {
    expect(payloadSize(emptyPayload())).toBeGreaterThan(0)
  })
})