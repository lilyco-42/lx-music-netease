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

/** 把发出去的 eapi 表单解密回明文，用于断言请求里到底写了什么 */
const decryptForm = (hex: string): string => {
  const decipher = createDecipheriv('aes-128-ecb', Buffer.from(REF.EAPI_KEY), Buffer.alloc(0))
  const raw = Buffer.concat([decipher.update(Buffer.from(hex, 'hex')), decipher.final()])
  // 去掉 PKCS#7 填充（上游是手写 padding，直接 strip 控制字符更稳）
  return raw.toString('utf8').replace(/\x0[0-9a-f]/gi, '')
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

    for (const quality of ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master'] as const) {
      setPlatform(fakeHttp(() => ({ data: [{ url: 'https://cdn.example/x', type: 'mp3', size: 1 }] })))
      installWySource()
      setMusicUrlProvider(null)
      await getSource('wy').getMusicUrl({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 1 }, quality)
      const params = captured[captured.length - 1]!.form!.params
      const plain = decryptForm(params)
      const m = plain.match(/"level":"([^"]+)"/)
      levels.push(m ? m[1]! : '??')
    }

    // 上游真实接受的 level 词表
    expect(levels).toEqual(['standard', 'exhigh', 'lossless', 'lossless', 'hires', 'jyeffect', 'jymaster'])
    // 绝不能把内部 Quality 名直接透传
    expect(levels).not.toContain('128k')
    expect(levels).not.toContain('320k')
  })

  /**
   * 降档回退：高音质被锁、低音质仍可播时应当自动降档，而不是直接失败。
   * 实测存在这种曲目（同一首歌 standard 有 url、lossless 为 null）。
   */
  it('falls back to a lower quality when the requested one is not playable', async () => {
    const levels: string[] = []
    let call = 0
    setPlatform({
      ...desktopPlatform,
      http: {
        async request(o: HttpRequestOptions) {
          const plain = decryptForm(o.form!.params)
          const m = plain.match(/"level":"([^"]+)"/)
          levels.push(m ? m[1]! : '??')
          call++
          // 第一次（lossless）返回 url:null + fee:1，第二次（exhigh）才给 url
          if (call < 2) {
            return { statusCode: 200, headers: {}, body: JSON.stringify({ code: 200, data: [{ url: null, fee: 1 }] }), raw: new Uint8Array() }
          }
          return { statusCode: 200, headers: {}, body: JSON.stringify({ code: 200, data: [{ url: 'https://cdn.example/ok.mp3', type: 'mp3', size: 1 }] }), raw: new Uint8Array() }
        },
      },
    })
    installWySource()
    setMusicUrlProvider(null)

    const info = await getSource('wy').getMusicUrl({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 1 }, 'flac')
    expect(info.url).toBe('https://cdn.example/ok.mp3')
    // 请求档位应当是 高 -> 低，且不含重复的 level
    expect(levels).toEqual(['lossless', 'exhigh'])
  })

  it('explains that a VIP-only song cannot be played instead of a generic error', async () => {
    setPlatform({
      ...desktopPlatform,
      http: {
        async request() {
          return { statusCode: 200, headers: {}, body: JSON.stringify({ code: 200, data: [{ url: null, fee: 1 }] }), raw: new Uint8Array() }
        },
      },
    })
    installWySource()
    setMusicUrlProvider(null)
    await expect(getSource('wy').getMusicUrl({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 1 }, '320k'))
      .rejects.toThrow(/VIP 专享/)
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

  it('searches songs and maps the raw payload into MusicItem', async () => {
    // 形状取自真实接口 /api/search/song/list/page 的实际返回
    const payload = {
      code: 200,
      data: {
        totalCount: 274,
        resources: [{
          baseInfo: {
            simpleSongData: {
              id: 509781655,
              name: '想你就写信 (Live)',
              dt: 238698,
              ar: [{ name: '周杰伦' }, { name: '李硕' }],
              al: { id: 123, name: '中国新歌声第二季 第13期', picUrl: 'http://p2.music.126.net/x.jpg' },
              privilege: { maxbr: 999000, maxBrLevel: 'hires' },
              hr: { size: 40000000 },
              sq: { size: 20000000 },
              h: { size: 9000000 },
              l: { size: 3800000 },
            },
          },
        }],
      },
    }
    setPlatform(fakeHttp(() => payload))
    installWySource()

    const r = await getSource('wy').musicSearch!('周杰伦', 1, 30)
    expect(r.total).toBe(274)
    expect(r.allPage).toBe(Math.ceil(274 / 30))
    expect(r.source).toBe('wy')

    const s = r.list[0]!
    expect(s.name).toBe('想你就写信 (Live)')
    expect(s.singer).toBe('周杰伦、李硕')
    expect(s.albumName).toBe('中国新歌声第二季 第13期')
    expect(s.songmid).toBe(509781655)
    expect(s.picUrl).toBe('http://p2.music.126.net/x.jpg')
    // 238698ms -> 03:58
    expect(s.interval).toBe('03:58')
    // hires 档位应同时给出 flac24bit 与 flac
    expect(s.qualitys).toHaveProperty('flac24bit')
    expect(s.qualitys).toHaveProperty('flac')
    expect(s.qualitys).toHaveProperty('320k')
    expect(s.qualitys).toHaveProperty('128k')

    // 请求必须带上分页参数
    const req = captured[captured.length - 1]!
    expect(req.method).toBe('POST')
    expect(req.form?.params).toMatch(/^[0-9A-F]+$/)
  })

  it('rejects a search whose body carries a non-200 code', async () => {
    setPlatform(fakeHttp(() => ({ code: 400 })))
    installWySource()
    await expect(getSource('wy').musicSearch!('x', 1, 30)).rejects.toThrow(/code 400/)
  })

  it('builds the desktop detail page url', () => {
    installWySource()
    expect(wySource.getMusicDetailPageUrl?.({ id: 1, name: 'n', singer: 's', source: 'wy', songmid: 99 }))
      .toBe('https://music.163.com/#/song?id=99')
  })
})