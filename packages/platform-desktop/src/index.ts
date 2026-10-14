import { createHash, createCipheriv, createDecipheriv } from 'node:crypto'
import { inflate, deflate } from 'node:zlib'
import { promisify } from 'node:util'
import { setPlatform, type PlatformAdapter, type HttpRequestOptions, type HttpResponse } from '@lxmn/core'

const inflateAsync = promisify(inflate)
const deflateAsync = promisify(deflate)

const AES_MODE = 'aes-128-cbc' as const

const cryptoAdapter = {
  aesEncryptSync(data: string | Uint8Array, key: string | Uint8Array, iv?: string | Uint8Array): string {
    const k = typeof key === 'string' ? Buffer.from(key, 'binary') : Buffer.from(key)
    const cipher = createCipheriv(AES_MODE, k, iv ? Buffer.from(iv as string, 'binary') : k)
    return Buffer.concat([cipher.update(Buffer.from(data as string, 'binary')), cipher.final()]).toString('base64')
  },
  aesDecryptSync(data: string, key: string | Uint8Array, iv?: string | Uint8Array): string {
    const k = typeof key === 'string' ? Buffer.from(key, 'binary') : Buffer.from(key)
    const decipher = createDecipheriv(AES_MODE, k, iv ? Buffer.from(iv as string, 'binary') : k)
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString()
  },
  md5(data: string | Uint8Array): string {
    return createHash('md5').update(Buffer.from(data as string)).digest('hex')
  },
}

const compressAdapter = {
  async inflateToString(data: Uint8Array): Promise<string> {
    const out = await inflateAsync(Buffer.from(data))
    return out.toString()
  },
  async inflate(data: Uint8Array): Promise<Uint8Array> {
    const out = await inflateAsync(Buffer.from(data))
    return new Uint8Array(out)
  },
  async deflate(data: Uint8Array | string): Promise<Uint8Array> {
    const out = await deflateAsync(Buffer.from(data))
    return new Uint8Array(out)
  },
}

const codecAdapter = {
  utf8Encode: (s: string) => new Uint8Array(Buffer.from(s, 'utf8')),
  utf8Decode: (b: Uint8Array) => Buffer.from(b).toString('utf8'),
  base64Encode: (b: Uint8Array | string) => Buffer.from(b as string).toString('base64'),
  base64Decode: (s: string) => new Uint8Array(Buffer.from(s, 'base64')),
  // 桌面端原生支持 GBK，移动端需要 iconv 实现
  decodeName: (s: string | Uint8Array) => (typeof s === 'string' ? s : Buffer.from(s).toString()),
}

const timerAdapter = {
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id: number) => clearTimeout(id),
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
  clearInterval: (id: number) => clearInterval(id),
  // 桌面端后台不受限，退化为普通定时器
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

// 用 Node 18+ 内置 fetch，桌面端无需 needle 即可跑通核心测试
async function request(options: HttpRequestOptions): Promise<HttpResponse> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), options.timeout ?? 15000)
  try {
    const res = await fetch(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body as BodyInit | undefined,
      signal: controller.signal,
    })
    const buf = new Uint8Array(await res.arrayBuffer())
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    return {
      statusCode: res.status,
      headers,
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
