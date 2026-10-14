/**
 * 平台能力抽象层 (Platform Adapter)
 *
 * 这是桌面端 (Electron/Node) 与移动端 (React Native) 唯一的差异边界。
 * 实测证据：desktop 与 mobile 的 musicSdk 中 34 个文件字节级完全相同，
 * 18 个不同的文件其差异 100% 集中在 crypto / zlib / 定时器 / 网络 的调用方式上。
 *
 * 把「能力」声明成接口，两端各提供一份实现，业务逻辑即可真正一份代码。
 */

/** 加解密能力：桌面用 node:crypto，移动端用 nativeModules/crypto */
export interface CryptoAdapter {
  aesEncryptSync(data: string | Uint8Array, key: string | Uint8Array, iv?: string | Uint8Array): string
  aesDecryptSync(data: string, key: string | Uint8Array, iv?: string | Uint8Array): string
  md5(data: string | Uint8Array): string
  rsaEncrypt?(data: string, key: string): string
}

/** 压缩能力：桌面用 node:zlib，移动端用 pako */
export interface CompressAdapter {
  inflateToString(data: Uint8Array): Promise<string>
  inflate(data: Uint8Array): Promise<Uint8Array>
  deflate(data: Uint8Array | string): Promise<Uint8Array>
}

/** 网络能力：桌面用 needle/undici，移动端用 fetch + 原生模块 */
export interface HttpAdapter {
  request(options: HttpRequestOptions): Promise<HttpResponse>
}

export interface HttpRequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'
  headers?: Record<string, string>
  body?: string | Uint8Array
  timeout?: number
  binary?: boolean
  rejectUnauthorized?: boolean
  lookup?: (hostname: string, options: unknown, cb: (err: Error | null, address?: string, family?: number) => void) => void
  follow_max?: number
}

export interface HttpResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
  raw: Uint8Array
}

/** 定时器能力：移动端需要后台定时器以维持播放 */
export interface TimerAdapter {
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
  setInterval(fn: () => void, ms: number): number
  clearInterval(id: number): void
  setBackgroundTimeout?(fn: () => void, ms: number): number
  clearBackgroundTimeout?(id: number): void
}

/** 持久化能力：桌面用 better-sqlite3，移动用 AsyncStorage */
export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  keys(): Promise<string[]>
}

/** 文本/编码能力 */
export interface CodecAdapter {
  utf8Encode(s: string): Uint8Array
  utf8Decode(b: Uint8Array): string
  base64Encode(b: Uint8Array | string): string
  base64Decode(s: string): Uint8Array
  decodeName(s: string | Uint8Array): string
}

export interface PlatformAdapter {
  name: 'desktop' | 'mobile' | 'web'
  crypto: CryptoAdapter
  compress: CompressAdapter
  http: HttpAdapter
  timer: TimerAdapter
  storage: StorageAdapter
  codec: CodecAdapter
  version: string
}
