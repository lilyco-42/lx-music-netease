import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { setPlatform, type PlatformAdapter, type HttpRequestOptions } from '@lxmn/core'
import { desktopPlatform } from '@lxmn/platform-desktop'
import { eapi, linuxapi, eapiDecrypt, WY_CONSTANTS } from '@lxmn/core'
import { wySource, installWySource, setMusicUrlProvider } from '@lxmn/core'
import { resetSources, getSource, hasSource, listSources, getSupportQuality } from '@lxmn/core'
import { createHash, createCipheriv, createDecipheriv } from 'node:crypto'

/**
 * 证明「移植后的网易云签名算法与上游字节一致」。
 *
 * 参考实现是上游 crypto.js 的**逐字转写**（用 node:crypto + Buffer），
 * 独立于 packages/core 的 PlatformAdapter 路径。两者输出必须完全相同。
 */
const REF = {
  IV: Buffer.from('0102030405060708'),
  PRESET_KEY: Buffer.from('0CoJUm6Qyw8W8jud'),
  LINUXAPI_KEY: Buffer.from('rFgB&h#%2?^eDg:Q'),
  EAPI_KEY: 'e82ckenh8dichen8',
}

const refAes = (buf: Buffer, mode: 'aes-128-cbc' | 'aes-128-ecb', key: Buffer, iv: Buffer) => {
  const cipher = createCipheriv(mode, key, iv)
  return Buffer.concat([cipher.update(buf), cipher.final()])
}

/** 上游 linuxapi 的逐字转写 */
const refLinuxapi = (object: unknown) => {
  const text = JSON.stringify(object)
  return {
    eparams: refAes(Buffer.from(text), 'aes-128-ecb', REF.LINUXAPI_KEY, Buffer.alloc(0))
      .toString('hex').toUpperCase(),
  }
}

/** 上游 eapi 的逐字转写 */
const refEapi = (url: string, object: unknown) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : String(object)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = createHash('md5').update(message).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: refAes(Buffer.from(data), 'aes-128-ecb', Buffer.from(REF.EAPI_KEY), Buffer.alloc(0))
      .toString('hex').toUpperCase(),
  }
}

beforeAll(() => {
  setPlatform(desktopPlatform)
})

describe('NetEase signing algorithm is byte-identical to upstream', () => {
  it('linuxapi matches the reference transcription', () => {
    const payload = { method: 'POST', url: 'https://music.163.com/api/linux/forward' }
    const mine = linuxapi(payload)
    const ref = refLinuxapi(payload)
    expect(mine.eparams).toBe(ref.eparams)
    expect(mine.eparams.length).toBeGreaterThan(0)
  })

  it('eapi matches the reference transcription', () => {
    const url = '/api/song/enhance/player/url/v1'
    const payload = { ids: '[1]', level: 'standard', encodeType: 'flac' }
    const mine = eapi(url, payload)
    const ref = refEapi(url, payload)
    expect(mine.params).toBe(ref.params)
  })

  it('eapi params decrypt back to the upstream data layout', () => {
    const url = '/api/song/lyric'
    const payload = { id: 123, lv: -1, kv: -1, tv: -1 }
    const { params } = eapi(url, payload)
    const plain = eapiDecrypt(Buffer.from(params, 'hex'))
    const text = JSON.stringify(payload)
    const digest = createHash('md5').update(`nobody${url}use${text}md5forencrypt`).digest('hex')
    expect(plain).toBe(`${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`)
  })

  it('keeps the upstream constants unchanged', () => {
    expect(WY_CONSTANTS.EAPI_KEY).toBe('e82ckenh8dichen8')
    expect(WY_CONSTANTS.IV).toBe('0102030405060708')
    expect(WY_CONSTANTS.PRESET_KEY).toBe('0CoJUm6Qyw8W8jud')
    expect(WY_CONSTANTS.LINUXAPI_KEY).toBe('rFgB&h#%2?^eDg:Q')
  })
})

describe('eapiDecrypt round-trips through the platform adapter', () => {
  it('decrypts what eapi produced', () => {
    const { params } = eapi('/api/test', { a: 1 })
    expect(eapiDecrypt(Buffer.from(params, 'hex'))).toContain('36cd479b6b5')
  })
})

describe('wy source drives the shared kernel end-to-end', () => {
  let captured: HttpRequestOptions[] = []

  const fakeHttp = (respond: (o: HttpRequestOptions) => unknown): PlatformAdapter => ({
    ...desktopPlatform,
    http: {
      async request(o: HttpRequestOptions) {
        captured.push(o)
        const body = JSON.stringify(respond(o))
        return {
          statusCode: 200,
          headers: {},
          body,
          raw: new TextEncoder().encode(body),
        }
      },
    },
  })

  afterEach(() => {
    captured = []
    setMusicUrlProvider(null)
    resetSources()
  })

  it('registers and resolves the wy source through the registry', () => {
    installWySource()
    expect(hasSource('wy')).toBe(true)
    expect(getSource('wy').id).toBe('wy')
    expect(listSources()).toContain('wy')
    // 网易云支持的音质（对应原 api-source-info 的 supportQualitys）
    expect(getSupportQuality('wy')).toContain('flac24bit')
  })

  it('fetches a play url and sends a correctly signed eapi form', async () => {
    setPlatform(fakeHttp(() => ({ data: [{ url: 'https://cdn.example/song.flac', type: 'flac', size: 1234 }] })))
    installWySource()

    const info = await getSource('wy').getMusicUrl({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 42 }, 'flac')

    expect(info.url).toBe('https://cdn.example/song.flac')
    expect(info.quality).toBe('flac')

    const req = captured[0]!
    expect(req.url).toBe('http://interface.music.163.com/eapi/batch')
    expect(req.method).toBe('POST')
    // 表单里必须带 eapi 签名后的 params（hex 大写）
    expect(req.form?.params).toMatch(/^[0-9A-F]+$/)
    expect(req.headers?.origin).toBe('https://music.163.com')
  })

  /**
   * 回归测试：内核的 Quality 不能直接当 eapi 的 level 用。
   *
   * 实测（对真实接口）：level 传 '128k' / '320k' / 'flac' 都会返回 code:-110 + url:null，
   * 只有 'hires' 因为恰好与上游同名才碰巧可用。必须走 WY_LEVEL 映射。
   * 这里把发出去的 eapi 表单**解密回来**，断言里面确实是上游认识的 level 词。
   */
  it('maps internal Quality onto the level names the NetEase API accepts', async () => {
    const levels: string[] = []
    const decryptParams = (hex: string): string => {
      const decipher = createDecipheriv('aes-128-ecb', Buffer.from(REF.EAPI_KEY), Buffer.alloc(0))
      const raw = Buffer.concat([decipher.update(Buffer.from(hex, 'hex')), decipher.final()])
      return raw.toString('utf8').replace(/\x0[0-9a-f]/gi, '')
    }

    for (const quality of ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master'] as const) {
      setPlatform(fakeHttp(() => ({ data: [{ url: 'https://cdn.example/x', type: 'mp3', size: 1 }] })))
      installWySource()
      setMusicUrlProvider(null)
      await getSource('wy').getMusicUrl({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 1 }, quality)
      const params = captured[captured.length - 1]!.form!.params
      const plain = decryptParams(params)
      const m = plain.match(/"level":"([^"]+)"/)
      levels.push(m ? m[1]! : '??')
    }

    // 上游真实接受的 level 词表
    expect(levels).toEqual(['standard', 'exhigh', 'lossless', 'lossless', 'hires', 'jyeffect', 'jymaster'])
    // 绝不能把内部 Quality 名直接透传
    expect(levels).not.toContain('128k')
    expect(levels).not.toContain('320k')
  })

  it('honours a host-injected url provider (keeps lx-music custom-source ability)', async () => {
    setPlatform(fakeHttp(() => ({ data: [] })))
    installWySource()
    setMusicUrlProvider(async (_song, quality) => ({ url: 'https://custom.example/x.mp3', quality }))

    const info = await getSource('wy').getMusicUrl({ id: 1, name: 'n', singer: 's', source: 'wy' }, '320k')
    expect(info.url).toBe('https://custom.example/x.mp3')
    expect(captured.length).toBe(0) // 自定义 provider 生效，未走内置请求
  })

  it('parses lyrics including translation', async () => {
    setPlatform(fakeHttp(() => ({ lrc: { lyric: '[00:01]원문' }, tlyric: { lyric: '[00:01]译文' } })))
    installWySource()

    const lrc = await getSource('wy').getLyric({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 7 })
    expect(lrc.lyric).toContain('원문')
    expect(lrc.tlyric).toContain('译文')
  })

  it('parses the cover url out of song detail', async () => {
    setPlatform(fakeHttp(() => ({ songs: [{ al: { picUrl: 'https://img.example/cover.jpg' } }] })))
    installWySource()

    const pic = await getSource('wy').getPic({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 7 })
    expect(pic.url).toBe('https://img.example/cover.jpg')
  })

  it('builds the desktop detail page url', () => {
    installWySource()
    expect(wySource.getMusicDetailPageUrl?.({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 99 }))
      .toBe('https://music.163.com/#/song?id=99')
  })
})