
import { describe, it, expect, beforeAll } from 'vitest'
import { setPlatform, installWySource, installKwSource, installMgSource, installKgSource,
         listSources, hasSource, getSource, type MusicItem } from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'

const live = process.env.LIVE === '1'

// 联网测试：CI 里默认跳过（网络不稳会让构建无故变红），
// 本地用 LIVE=1 pnpm vitest run tests/multi-source.test.ts 跑。
describe.skipIf(!live)('多音源聚合搜索（联网）', () => {
  beforeAll(() => {
    setPlatform(desktopPlatform)
    for (const f of [installWySource, installKwSource, installMgSource, installKgSource]) f()
  })

  it('并发查所有音源并去重合并', async () => {
    const ids = listSources().filter(id => hasSource(id) && Boolean(getSource(id).musicSearch))
    console.log('  registered sources:', listSources().join(', '))
    expect(ids.length).toBeGreaterThanOrEqual(4)

    const results = await Promise.all(
      ids.map(id => getSource(id).musicSearch!('起风了', 1, 10).catch(() => null)),
    )
    const seen = new Set<string>()
    const merged: MusicItem[] = []
    let sum = 0
    for (const r of results) {
      if (!r) { console.log('  (one source failed)'); continue }
      console.log('  ' + r.source.padEnd(4), 'total=' + String(r.total).padEnd(8), 'returned=' + r.list.length)
      sum += r.total
      for (const it of r.list) {
        const k = it.source + '-' + String(it.songmid)
        if (!seen.has(k)) { seen.add(k); merged.push(it) }
      }
    }
    console.log('  MERGED total=' + sum, 'unique=' + merged.length)
    console.log('  sample:', merged.slice(0, 6).map(x => x.source + ':' + x.name).join(' | '))

    // 至少两个源返回了结果，且合并后覆盖多个 source
    const srcs = new Set(merged.map(x => x.source))
    console.log('  sources in merged:', [...srcs].join(', '))
    expect(srcs.size).toBeGreaterThanOrEqual(2)
    expect(merged.length).toBeGreaterThan(10)
  }, 120000)
})
