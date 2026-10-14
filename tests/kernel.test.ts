import { describe, it, expect, beforeAll } from 'vitest'
import { setPlatform, getPlatform, hasPlatform, buildHeaders, pickBestQuality, qualityOrder, formatSingerName } from '@lxmn/core'
import { installDesktopPlatform, desktopPlatform } from '@lxmn/platform-desktop'

/**
 * 这个测试是「共享内核可行」的最小证明：
 * 同一个 @lxmn/core，只要注入不同 PlatformAdapter，就能在两端复用。
 */

describe('platform adapter registry', () => {
  it('throws a clear error before registration', () => {
    expect(hasPlatform()).toBe(false)
    expect(() => getPlatform()).toThrow(/Platform adapter not registered/)
  })

  it('returns the adapter after registration', () => {
    installDesktopPlatform()
    expect(hasPlatform()).toBe(true)
    expect(getPlatform().name).toBe('desktop')
  })
})

describe('desktop crypto adapter', () => {
  it('computes md5', () => {
    expect(desktopPlatform.crypto.md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
  })

  it('round-trips AES-128-CBC', () => {
    const key = '1234567890123456'
    const plain = 'lx-music'
    const enc = desktopPlatform.crypto.aesEncryptSync(plain, key, key)
    const dec = desktopPlatform.crypto.aesDecryptSync(enc, key, key)
    expect(dec.startsWith(plain)).toBe(true)
  })
})

describe('desktop compress adapter', () => {
  it('round-trips deflate/inflate', async () => {
    const data = '网易云音乐风格 UI 重制版'
    const packed = await desktopPlatform.compress.deflate(data)
    const out = await desktopPlatform.compress.inflateToString(packed)
    expect(out).toBe(data)
  })
})

describe('sign helpers', () => {
  it('builds the lx-music header set', () => {
    const h = buildHeaders({ 'X-Test': '1' })
    expect(h['User-Agent']).toBe('lx-music request')
    expect(h['X-Test']).toBe('1')
    expect(Object.keys(h)).toContain('624868746c')
  })

  it('falls back to the best available quality', () => {
    expect(pickBestQuality('flac', { flac: true })).toBe('flac')
    expect(pickBestQuality('flac', { '320k': true })).toBe('320k')
    expect(pickBestQuality('flac', {})).toBeNull()
    expect(qualityOrder[0]).toBe('master')
  })

  it('formats singer names', () => {
    expect(formatSingerName([{ name: 'A' }, { name: 'B' }])).toBe('A、B')
    expect(formatSingerName('Solo')).toBe('Solo')
  })
})
