import { describe, it, expect, beforeEach } from 'vitest'
import {
  setPlatform, getPlatform, hasPlatform, buildHeaders, pickBestQuality, qualityOrder,
  formatSingerName, utf8Encode, toBase64, fromBase64, toHex, fromHex, concat, leftPad,
  reverseBytes,
} from '@lxmn/core'
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
    const key = utf8Encode('1234567890123456')
    const iv = utf8Encode('0102030405060708')
    const plain = utf8Encode('lx-music')
    const enc = desktopPlatform.crypto.aesEncrypt(plain, 'aes-128-cbc', key, iv)
    const dec = desktopPlatform.crypto.aesDecrypt(enc, 'aes-128-cbc', key, iv)
    expect(new TextDecoder().decode(dec)).toBe('lx-music')
  })

  it('produces cryptographically random bytes of the requested size', () => {
    const a = desktopPlatform.crypto.randomBytes(16)
    const b = desktopPlatform.crypto.randomBytes(16)
    expect(a.length).toBe(16)
    expect(toHex(a)).not.toBe(toHex(b))
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

describe('byte utilities (Buffer-free, so React Native can run them)', () => {
  it('base64 round-trips', () => {
    const src = utf8Encode('网易云音乐 lx-music')
    expect(new TextDecoder().decode(fromBase64(toBase64(src)))).toBe('网易云音乐 lx-music')
  })

  it('hex round-trips', () => {
    const src = Uint8Array.from([0, 1, 15, 16, 255])
    expect(toHex(src)).toBe('00010f10ff')
    expect(Array.from(fromHex('00010f10ff'))).toEqual([0, 1, 15, 16, 255])
  })

  it('concatenates and left-pads like Buffer.concat / Buffer.alloc', () => {
    expect(Array.from(concat([Uint8Array.from([1, 2]), Uint8Array.from([3])]))).toEqual([1, 2, 3])
    expect(Array.from(leftPad(Uint8Array.from([9]), 3))).toEqual([0, 0, 9])
  })

  it('reverses bytes like Buffer.reverse', () => {
    expect(Array.from(reverseBytes(Uint8Array.from([1, 2, 3])))).toEqual([3, 2, 1])
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
