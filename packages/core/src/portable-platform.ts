/**
 * 可移植平台工厂
 *
 * 用纯 JS 的 crypto / compress 组装出一个 PlatformAdapter。
 * 只要宿主提供 http / timer / storage，就能在任意 JS 运行时跑起来：
 *   - Node / Electron：直接用（见 @lxmn/platform-desktop）
 *   - React Native：fetch + AsyncStorage
 *   - 浏览器：fetch + localStorage
 */
import type { PlatformAdapter, HttpAdapter, TimerAdapter, StorageAdapter } from './platform'
import { portableCrypto } from './crypto/portable'
import { utf8Encode, utf8Decode, toBase64, fromBase64 } from './util/bytes'

export interface PortablePlatformOptions {
  name: PlatformAdapter['name']
  http: HttpAdapter
  timer?: TimerAdapter
  storage?: StorageAdapter
  /** 名称解码：默认原样返回；中文站源可注入 iconv-lite 实现 */
  decodeName?: (s: string | Uint8Array) => string
  version?: string
}

/** 基于 DecompressionStream 的纯 Web 解压（Node 18+ 与浏览器均支持） */
async function inflateWithStream(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: new (f: string) => unknown }).DecompressionStream
  if (!DS) throw new Error('[lxmn] DecompressionStream unavailable; inject a compress adapter')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS('deflate') as never)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function deflateWithStream(data: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as { CompressionStream?: new (f: string) => unknown }).CompressionStream
  if (!CS) throw new Error('[lxmn] CompressionStream unavailable; inject a compress adapter')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CS('deflate') as never)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const defaultTimer: TimerAdapter = {
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: id => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms) as unknown as number,
  clearInterval: id => clearInterval(id),
}

const memory = new Map<string, string>()
const defaultStorage: StorageAdapter = {
  async get(k) { return memory.get(k) ?? null },
  async set(k, v) { memory.set(k, v) },
  async remove(k) { memory.delete(k) },
  async keys() { return [...memory.keys()] },
}

export function createPortablePlatform(options: PortablePlatformOptions): PlatformAdapter {
  return {
    name: options.name,
    crypto: portableCrypto,
    compress: {
      async inflate(data) { return inflateWithStream(data) },
      async inflateToString(data) { return utf8Decode(await inflateWithStream(data)) },
      async deflate(data) { return deflateWithStream(typeof data === 'string' ? utf8Encode(data) : data) },
    },
    http: options.http,
    timer: options.timer ?? defaultTimer,
    storage: options.storage ?? defaultStorage,
    codec: {
      utf8Encode,
      utf8Decode,
      base64Encode: (b) => toBase64(typeof b === 'string' ? utf8Encode(b) : b),
      base64Decode: (s) => fromBase64(s),
      decodeName: options.decodeName ?? ((s) => (typeof s === 'string' ? s : utf8Decode(s))),
    },
    version: options.version ?? '0.1.0',
  }
}
