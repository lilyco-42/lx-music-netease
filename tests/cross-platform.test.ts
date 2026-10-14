import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import {
  setPlatform, getPlatform, installWySource, getSource, eapi, eapiDecrypt,
  createPortablePlatform, portableCrypto, utf8Encode, toHex, type StorageAdapter,
} from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'
import { createMobilePlatform, createRnTimer, createRnHttp } from '@lxmn/platform-mobile'

/**
 * 「全平台兼容」的最终证明：
 * **同一份 @lxmn/core 业务代码**，分别在桌面适配器与移动适配器上运行，
 * 得到**完全相同**的结果。
 *
 * 这直接回应了原始问题「能做一个全平台兼容么」。
 */

const fakeStorage = (): StorageAdapter => {
  const m = new Map<string, string>()
  return {
    async get(k) { return m.get(k) ?? null },
    async set(k, v) { m.set(k, v) },
    async remove(k) { m.delete(k) },
    async keys() { return [...m.keys()] },
  }
}

/** 用固定随机源构造移动适配器，使签名结果可确定复现 */
const mobilePlatform = createMobilePlatform({
  storage: fakeStorage(),
  fetchImpl: (async () => { throw new Error('network disabled in test') }) as unknown as typeof fetch,
})

describe('one core, two platforms', () => {
  it('desktop and mobile adapters expose the same interface shape', () => {
    const keys: Array<keyof typeof desktopPlatform> = [
      'name', 'crypto', 'compress', 'http', 'timer', 'storage', 'codec', 'version',
    ]
    for (const k of keys) expect(mobilePlatform[k]).toBeDefined()
    expect(desktopPlatform.name).toBe('desktop')
    expect(mobilePlatform.name).toBe('mobile')
  })

  it('both compute identical digests for the same input', () => {
    const samples = ['', 'abc', '网易云音乐', 'x'.repeat(200)]
    for (const s of samples) {
      const ref = createHash('md5').update(s).digest('hex')
      expect(desktopPlatform.crypto.md5(s)).toBe(ref)
      expect(mobilePlatform.crypto.md5(s)).toBe(ref)

      const refSha = createHash('sha1').update(s).digest('hex')
      expect(desktopPlatform.crypto.sha1(s)).toBe(refSha)
      expect(mobilePlatform.crypto.sha1(s)).toBe(refSha)
    }
  })

  it('both encrypt AES identically', () => {
    const key = utf8Encode('1234567890123456')
    const iv = utf8Encode('0102030405060708')
    const data = utf8Encode('同一份内核，两端复用')

    const a = desktopPlatform.crypto.aesEncrypt(data, 'aes-128-cbc', key, iv)
    const b = mobilePlatform.crypto.aesEncrypt(data, 'aes-128-cbc', key, iv)

    expect(toHex(a)).toBe(toHex(b))
    // 且都能被对方解开
    expect(new TextDecoder().decode(mobilePlatform.crypto.aesDecrypt(a, 'aes-128-cbc', key, iv)))
      .toBe('同一份内核，两端复用')
  })

  it('mobile adapter needs no native crypto module', () => {
    // 移动端 crypto 就是纯 JS 实现本身
    expect(mobilePlatform.crypto.md5).toBe(portableCrypto.md5)
    expect(mobilePlatform.crypto.sha1).toBe(portableCrypto.sha1)
  })

  it('the wy source produces identical eapi signatures on both platforms', async () => {
    const FIXED = Uint8Array.from({ length: 16 }, (_, i) => (i * 5 + 1) & 0xff)
    const payload = { ids: '[42]', level: 'exhigh', encodeType: 'flac' }
    const url = '/api/song/enhance/player/url/v1'

    setPlatform(desktopPlatform)
    const onDesktop = eapi(url, payload)

    setPlatform({ ...mobilePlatform, crypto: { ...portableCrypto, randomBytes: () => FIXED } })
    const onMobile = eapi(url, payload)

    setPlatform({ ...desktopPlatform, crypto: { ...desktopPlatform.crypto, randomBytes: () => FIXED } })
    const onDesktopFixed = eapi(url, payload)

    // 固定随机源后，两端签名必须逐字节相同
    expect(onMobile.params).toBe(onDesktopFixed.params)
    // 且都能解回同样的明文结构
    const plain = eapiDecrypt(Buffer.from(onMobile.params, 'hex'))
    expect(plain).toContain(url)
    expect(plain).toContain(JSON.stringify(payload))
  })

  it('the wy source runs end-to-end on the mobile adapter', async () => {
    const calls: string[] = []
    const platform = createMobilePlatform({
      storage: fakeStorage(),
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(String(input))
        return new Response(
          JSON.stringify({ data: [{ url: 'https://cdn.example/m.flac', type: 'flac', size: 999 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }) as unknown as typeof fetch,
    })

    setPlatform(platform)
    installWySource()

    const info = await getSource('wy').getMusicUrl(
      { id: 1, name: 'n', singer: 's', source: 'wy', songmid: 42 }, 'flac',
    )

    expect(info.url).toBe('https://cdn.example/m.flac')
    expect(calls[0]).toContain('interface.music.163.com/eapi/batch')
  })

  it('mobile timer normalizes RN handle types to numbers', () => {
    const timer = createRnTimer()
    const id = timer.setTimeout(() => {}, 1)
    expect(typeof id).toBe('number')
    timer.clearTimeout(id)
    const iv = timer.setInterval(() => {}, 1000)
    expect(typeof iv).toBe('number')
    timer.clearInterval(iv)
  })

  it('mobile timer exposes background timers when provided', () => {
    const calls: number[] = []
    const timer = createRnTimer({
      setTimeout: (_fn, ms) => { calls.push(ms); return 7 },
      clearTimeout: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
    })
    expect(timer.setBackgroundTimeout).toBeDefined()
    expect(timer.setBackgroundTimeout!(() => {}, 500)).toBe(7)
    expect(calls).toContain(500)
  })

  it('portable platform can be assembled for a third target (web)', () => {
    const web = createPortablePlatform({
      name: 'web',
      http: { request: async () => { throw new Error('n/a') } },
    })
    expect(web.name).toBe('web')
    expect(web.crypto.md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
    // 默认存储是内存实现
    expect(web.storage).toBeDefined()
  })
})

describe('HttpAdapter form encoding is consistent across platforms', () => {
  it('both encode form bodies the same way', async () => {
    let desktopBody = ''
    let mobileBody = ''

    setPlatform({
      ...desktopPlatform,
      http: {
        async request(o) {
          desktopBody = new URLSearchParams(o.form).toString()
          return { statusCode: 200, headers: {}, body: '{}', raw: new Uint8Array() }
        },
      },
    })
    await getPlatform().http.request({ url: 'x', method: 'POST', form: { a: '1', b: '中文' } })

    setPlatform(createMobilePlatform({
      storage: fakeStorage(),
      fetchImpl: (async (_u: unknown, init: RequestInit) => {
        mobileBody = String(init.body)
        return new Response('{}', { status: 200 })
      }) as unknown as typeof fetch,
    }))
    await getPlatform().http.request({ url: 'x', method: 'POST', form: { a: '1', b: '中文' } })

    expect(mobileBody).toBe(desktopBody)
  })
})
