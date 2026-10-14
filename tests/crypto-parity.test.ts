import { describe, it, expect, beforeAll } from 'vitest'
import {
  createHash, createCipheriv, createDecipheriv, publicEncrypt, constants,
  generateKeyPairSync, privateDecrypt,
} from 'node:crypto'
import {
  md5Bytes, sha1Bytes, portableCrypto, aesEncrypt, aesDecrypt, expandKey, SBOX,
  parseRsaPublicKey, utf8Encode, toHex, WY_CONSTANTS, createPortablePlatform,
} from '@lxmn/core'

/**
 * 「全平台兼容」的核心证据：
 * 纯 JS 实现（可在 React Native / Web 运行，零原生模块）
 * 与 node:crypto（桌面端）**逐字节一致**。
 */

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

describe('pure-JS MD5 matches node:crypto', () => {
  const cases = ['', 'a', 'abc', 'message digest', 'hello', '网易云音乐',
    'The quick brown fox jumps over the lazy dog',
    'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000),
    '아주 긴 문자열 테스트 🎵 中文字符 ' + 'y'.repeat(200)]

  for (const c of cases) {
    it(`md5(${JSON.stringify(c.slice(0, 24))}${c.length > 24 ? '…' : ''}) len=${c.length}`, () => {
      const mine = toHex(md5Bytes(utf8Encode(c)))
      const ref = createHash('md5').update(Buffer.from(c, 'utf8')).digest('hex')
      expect(mine).toBe(ref)
    })
  }

  it('handles multi-block boundary lengths 63/64/65', () => {
    for (const n of [63, 64, 65, 127, 128, 129]) {
      const s = 'z'.repeat(n)
      expect(toHex(md5Bytes(utf8Encode(s)))).toBe(createHash('md5').update(s).digest('hex'))
    }
  })
})

describe('pure-JS SHA-1 matches node:crypto', () => {
  const cases = ['', 'abc', 'hello', '网易云音乐', 'a'.repeat(1000), 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65)]
  for (const c of cases) {
    it(`sha1 len=${c.length}`, () => {
      expect(toHex(sha1Bytes(utf8Encode(c)))).toBe(createHash('sha1').update(c).digest('hex'))
    })
  }
})

describe('pure-JS AES-128 matches node:crypto', () => {
  const key = utf8Encode('1234567890123456')
  const iv = utf8Encode('0102030405060708')

  const cases = ['', 'a', 'hello', 'lx-music', '网易云音乐风格 UI 重制版',
    'x'.repeat(15), 'x'.repeat(16), 'x'.repeat(17), 'x'.repeat(31), 'x'.repeat(32),
    'block-boundary-'.repeat(10)]

  for (const mode of ['aes-128-cbc', 'aes-128-ecb'] as const) {
    for (const c of cases) {
      it(`${mode} round-trip len=${c.length}`, () => {
        const data = utf8Encode(c)
        const mine = aesEncrypt(data, mode, key, iv)
        const ref = (() => {
          const cipher = createCipheriv(mode, Buffer.from(key), mode === 'aes-128-cbc' ? Buffer.from(iv) : null)
          return Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()])
        })()
        expect(hex(mine)).toBe(hex(new Uint8Array(ref)))

        // 反向：用 node 解我加密的，再用我解 node 加密的
        const nodeDec = (() => {
          const d = createDecipheriv(mode, Buffer.from(key), mode === 'aes-128-cbc' ? Buffer.from(iv) : null)
          return Buffer.concat([d.update(Buffer.from(mine)), d.final()]).toString('utf8')
        })()
        expect(nodeDec).toBe(c)

        const mineDec = aesDecrypt(new Uint8Array(ref), mode, key, iv)
        expect(Buffer.from(mineDec).toString('utf8')).toBe(c)
      })
    }
  }

  it('generates the standard AES S-box (FIPS-197 reference values)', () => {
    // FIPS-197 标准 S-box 的前 16 个值与若干典型值
    expect(Array.from(SBOX.slice(0, 16))).toEqual([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76])
    expect(SBOX[0x00]).toBe(0x63)
    expect(SBOX[0x53]).toBe(0xed)
    expect(SBOX[0xff]).toBe(0x16)
  })

  it('expands a 16-byte key into 176 bytes (11 round keys)', () => {
    expect(expandKey(key).length).toBe(176)
  })
})

describe('pure-JS RSA matches node:crypto', () => {
  const pem = WY_CONSTANTS.PUBLIC_KEY

  it('parses the NetEase public key', () => {
    const { n, e, size } = parseRsaPublicKey(pem)
    expect(e).toBe(65537n)
    expect(size).toBe(128) // 1024-bit
    expect(n > 0n).toBe(true)
  })

  it('matches node publicEncrypt with RSA_NO_PADDING', () => {
    const data = Uint8Array.from({ length: 128 }, (_, i) => (i * 7 + 3) & 0xff)
    const mine = portableCrypto.rsaEncrypt(data, pem, 'none')
    const ref = publicEncrypt(
      { key: pem, padding: constants.RSA_NO_PADDING },
      Buffer.from(data),
    )
    expect(hex(mine)).toBe(hex(new Uint8Array(ref)))
    expect(mine.length).toBe(128)
  })

  it('PKCS#1 v1.5 output is decryptable by node privateDecrypt', () => {
    // PKCS#1 填充含随机字节，无法逐字节比对；改为用 node 生成的密钥对做私钥还原。
    //
    // 注意：Node >= 20.11 / 22 出于 CVE-2023-46809 已禁用
    // privateDecrypt(RSA_PKCS1_PADDING)，所以这里用 NO_PADDING 取出原始分组，
    // 再自行校验 PKCS#1 v1.5 的结构。这比依赖 OpenSSL 的填充检查更严格，
    // 而且不会随 Node 版本失效。
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })

    const raw = (buf: Uint8Array) => new Uint8Array(
      privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.from(buf)),
    )

    /** 校验 EMSA-PKCS1-v1_5 结构并取出消息 */
    const unwrap = (block: Uint8Array, size: number): Uint8Array => {
      expect(block.length).toBe(size)
      expect(block[0]).toBe(0x00)
      expect(block[1]).toBe(0x02)
      let i = 2
      // 填充串：至少 8 字节非零，以 0x00 结束
      while (i < block.length && block[i] !== 0) {
        expect(block[i]).not.toBe(0)
        i++
      }
      expect(i - 2).toBeGreaterThanOrEqual(8)
      expect(i).toBeLessThan(block.length)
      return block.slice(i + 1)
    }

    const data = utf8Encode('lx-music netease')
    const mine = portableCrypto.rsaEncrypt(data, publicKey, 'pkcs1')
    expect(mine.length).toBe(128)
    expect(Buffer.from(unwrap(raw(mine), 128)).toString('utf8')).toBe('lx-music netease')

    // 交叉验证：node 自己加密的结果，结构必须与我的一致
    const ref = new Uint8Array(publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(data),
    ))
    expect(Buffer.from(unwrap(raw(ref), 128)).toString('utf8')).toBe('lx-music netease')
  })

  it('NO_PADDING output is decryptable by node privateDecrypt', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    const data = Uint8Array.from({ length: 128 }, (_, i) => (i * 3 + 1) & 0xff)
    const mine = portableCrypto.rsaEncrypt(data, publicKey, 'none')
    const recovered = privateDecrypt(
      { key: privateKey, padding: constants.RSA_NO_PADDING },
      Buffer.from(mine),
    )
    expect(hex(new Uint8Array(recovered))).toBe(hex(data))
  })
})

describe('portable adapter: the same core runs with zero native modules', () => {
  it('exposes the full CryptoAdapter surface', () => {
    expect(portableCrypto.md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
    expect(portableCrypto.sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(portableCrypto.randomBytes(16).length).toBe(16)
  })

  it('md5 matches node for binary input', () => {
    const bin = Uint8Array.from({ length: 300 }, (_, i) => (i * 13) & 0xff)
    expect(portableCrypto.md5(bin)).toBe(createHash('md5').update(Buffer.from(bin)).digest('hex'))
  })

  it('produces different random bytes each call', () => {
    expect(toHex(portableCrypto.randomBytes(32))).not.toBe(toHex(portableCrypto.randomBytes(32)))
  })
})

describe('real NetEase weapi works with the pure-JS crypto', () => {
  it('byte-matches a node:crypto reference implementation', async () => {
    const { weapi, setPlatform } = await import('@lxmn/core')

    // 用固定随机源，使输出可确定复现
    const FIXED = Uint8Array.from({ length: 16 }, (_, i) => (i * 11 + 5) & 0xff)
    setPlatform({
      ...createPortablePlatform({
        name: 'web',
        http: { request: async () => { throw new Error('not used') } },
      }),
      crypto: { ...portableCrypto, randomBytes: () => FIXED },
    })

    const payload = { ids: '[1]', level: 'standard' }
    const mine = weapi(payload)

    // ---- 上游 crypto.js 的逐字转写（node:crypto + Buffer） ----
    const iv = Buffer.from('0102030405060708')
    const presetKey = Buffer.from('0CoJUm6Qyw8W8jud')
    const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const publicKeyPem = WY_CONSTANTS.PUBLIC_KEY
    const refAes = (buf: Buffer, mode: 'aes-128-cbc' | 'aes-128-ecb', key: Buffer, ivBuf: Buffer) => {
      const c = createCipheriv(mode, key, ivBuf)
      return Buffer.concat([c.update(buf), c.final()])
    }
    const text = JSON.stringify(payload)
    const secretKey = Buffer.from(FIXED.map(n => base62.charCodeAt(n % 62)))
    const ref = {
      params: refAes(
        Buffer.from(refAes(Buffer.from(text), 'aes-128-cbc', presetKey, iv).toString('base64')),
        'aes-128-cbc', secretKey, iv,
      ).toString('base64'),
      encSecKey: publicEncrypt(
        { key: publicKeyPem, padding: constants.RSA_NO_PADDING },
        Buffer.concat([Buffer.alloc(128 - 16), secretKey.slice().reverse()]),
      ).toString('hex'),
    }

    expect(mine.params).toBe(ref.params)
    expect(mine.encSecKey).toBe(ref.encSecKey)
    expect(mine.encSecKey.length).toBe(256)
  })

  it('the outer AES layer decrypts back to a base64 string', async () => {
    const { weapi, setPlatform } = await import('@lxmn/core')
    const FIXED = Uint8Array.from({ length: 16 }, (_, i) => (i * 7 + 2) & 0xff)
    setPlatform({
      ...createPortablePlatform({
        name: 'web',
        http: { request: async () => { throw new Error('not used') } },
      }),
      crypto: { ...portableCrypto, randomBytes: () => FIXED },
    })

    const { params } = weapi({ a: 1 })
    const secretKey = Uint8Array.from(FIXED, n => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charCodeAt(n % 62))
    const inner = aesDecrypt(
      Buffer.from(params, 'base64'),
      'aes-128-cbc',
      secretKey,
      utf8Encode('0102030405060708'),
    )
    // 内层应是一个 base64 字符串，再解一层即得原文
    const text = Buffer.from(
      aesDecrypt(
        Buffer.from(Buffer.from(inner).toString('utf8'), 'base64'),
        'aes-128-cbc',
        utf8Encode('0CoJUm6Qyw8W8jud'),
        utf8Encode('0102030405060708'),
      ),
    ).toString('utf8')
    expect(text).toBe('{"a":1}')
  })
})