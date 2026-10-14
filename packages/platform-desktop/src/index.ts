/**
 * 桌面端 (Electron / Node) 平台实现
 *
 * 只实现「能力」，不含任何业务逻辑 —— 业务逻辑全部在 @lxmn/core。
 * 这是 34 个字节级相同文件的复用基础。
 */
import {
  createCipheriv, createDecipheriv, createHash, publicEncrypt, randomBytes, constants,
} from 'node:crypto'
import { inflate, deflate } from 'node:zlib'
import { promisify } from 'node:util'
import {
  setPlatform, type PlatformAdapter, type HttpRequestOptions, type HttpResponse,
} from '@lxmn/core'

const inflateAsync = promisify(inflate)
const deflateAsync = promisify(deflate)

const cryptoAdapter = {
  aesEncrypt(data: Uint8Array, mode: 'aes-128-cbc' | 'aes-128-ecb', key: Uint8Array, iv?: Uint8Array): Uint8Array {
    const cipher = createCipheriv(mode, Buffer.from(key), iv && iv.length ? Buffer.from(iv) : null)
    return new Uint8Array(Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]))
  },

  aesDecrypt(data: Uint8Array, mode: 'aes-128-cbc' | 'aes-128-ecb', key: Uint8Array, iv?: Uint8Array): Uint8Array {
    const decipher = createDecipheriv(mode, Buffer.from(key), iv && iv.length ? Buffer.from(iv) : null)
    return new Uint8Array(Buffer.concat([decipher.update(Buffer.from(data)), decipher.final()]))
  },

  rsaEncrypt(data: Uint8Array, publicKey: string, padding: 'none' | 'pkcs1' = 'none'): Uint8Array {
    const p = padding === 'none' ? constants.RSA_NO_PADDING : constants.RSA_PKCS1_PADDING
    return new Uint8Array(publicEncrypt({ key: publicKey, padding: p }, Buffer.from(data)))
  },

  randomBytes(size: number): Uint8Array {
    return new Uint8Array(randomBytes(size))
  },

  md5(data: string | Uint8Array): string {
    return createHash('md5')
      .update(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data))
      .digest('hex')
  },

  sha1(data: string | Uint8Array): string {
    return createHash('sha1')
      .update(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data))
      .digest('hex')
  },
}

const compressAdapter = {
  async inflateToString(data: Uint8Array): Promise<string> {
    return (await inflateAsync(Buffer.from(data))).toString()
  },
  async inflate(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await inflateAsync(Buffer.from(data)))
  },
  async deflate(data: Uint8Array | string): Promise<Uint8Array> {
    return new Uint8Array(await deflateAsync(Buffer.from(data)))
  },
}

const codecAdapter = {
  utf8Encode: (s: string) => new Uint8Array(Buffer.from(s, 'utf8')),
  utf8Decode: (b: Uint8Array) => Buffer.from(b).toString('utf8'),
  base64Encode: (b: Uint8Array | string) =>
    Buffer.from(typeof b === 'string' ? b : Buffer.from(b)).toString('base64'),
  base64Decode: (s: string) => new Uint8Array(Buffer.from(s, 'base64')),
  // 桌面端 Node 原生支持 GBK；移动端需 iconv 实现
  decodeName: (s: string | Uint8Array) => (typeof s === 'string' ? s : Buffer.from(s).toString()),
}

const timerAdapter = {
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id: number) => clearTimeout(id),
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
  clearInterval: (id: number) => clearInterval(id),
  setBackgroundTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
  clearBackgroundTimeout: (id: number) => clearTimeout(id),
}

const memory = new Map<string, string>()
const storageAdapter = {
  async get(key: string) { return memory.get(key) ?? null },
  async set(key: string, value: string) { memory.set(key, value) },
  async remove(key: string) { memory.delete(key) },
  async keys() { return [...memory.keys()] },
}

/** 用 Node 18+ 内置 fetch；form 按 x-www-form-urlencoded 编码（网易 eapi 需要） */
async function request(options: HttpRequestOptions): Promise<HttpResponse> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), options.timeout ?? 15000)
  try {
    const headers: Record<string, string> = { ...options.headers }
    let body = options.body as BodyInit | undefined

    if (options.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(options.form).toString()
    }

    const res = await fetch(options.url, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
    })
    const buf = new Uint8Array(await res.arrayBuffer())
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    return {
      statusCode: res.status,
      headers: resHeaders,
      body: options.binary ? '' : Buffer.from(buf).toString('utf8'),
      raw: buf,
    }
  } finally {
    clearTimeout(t)
  }
}

export const desktopPlatform: PlatformAdapter = {
  name: 'desktop',
  crypto: cryptoAdapter,
  compress: compressAdapter,
  http: { request },
  timer: timerAdapter,
  storage: storageAdapter,
  codec: codecAdapter,
  version: '0.1.0',
}

/** 桌面端启动时调用一次即可 */
export function installDesktopPlatform(): void {
  setPlatform(desktopPlatform)
}

export default installDesktopPlatform
