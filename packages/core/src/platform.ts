/**
 * 平台能力抽象层 (Platform Adapter)
 *
 * 这是桌面端 (Electron/Node) 与移动端 (React Native) 唯一的差异边界。
 * 实测证据：desktop 与 mobile 的 musicSdk 中 34 个文件字节级完全相同，
 * 18 个不同的文件其差异 100% 集中在 crypto / zlib / 定时器 / 网络 的调用方式上。
 *
 * 把「能力」声明成接口，两端各提供一份实现，业务逻辑即可真正一份代码。
 */

/**
 * 加解密能力。
 *
 * 刻意暴露「原语」而不是「业务函数」：lx-music 的音源签名算法
 * （如网易 eapi 的 AES-128-ECB、weapi 的 RSA 无填充）在两端完全一致，
 * 差异只在 createCipheriv/publicEncrypt 的调用方式上。
 * 把原语抽出来，签名算法本身就能 100% 共用。
 */
export interface CryptoAdapter {
  /** 原始 AES 分组加密，支持 CBC / ECB，返回原始字节（不自动 base64/hex） */
  aesEncrypt(
    data: Uint8Array,
    mode: 'aes-128-cbc' | 'aes-128-ecb',
    key: Uint8Array,
    iv?: Uint8Array,
  ): Uint8Array

  /** 原始 AES 分组解密 */
  aesDecrypt(
    data: Uint8Array,
    mode: 'aes-128-cbc' | 'aes-128-ecb',
    key: Uint8Array,
    iv?: Uint8Array,
  ): Uint8Array

  /** RSA 公钥加密；网易 weapi 需要 RSA_NO_PADDING */
  rsaEncrypt(data: Uint8Array, publicKey: string, padding?: 'none' | 'pkcs1'): Uint8Array

  /** 密码学安全随机字节（weapi 的 secretKey 用） */
  randomBytes(size: number): Uint8Array

  /** MD5 十六进制摘要 */
  md5(data: string | Uint8Array): string
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
  /** 表单（application/x-www-form-urlencoded） */
  form?: Record<string, string>
  body?: string | Uint8Array
  timeout?: number
  binary?: boolean
  rejectUnauthorized?: boolean
  lookup?: (
    hostname: string,
    options: unknown,
    cb: (err: Error | null, address?: string, family?: number) => void,
  ) => void
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
  /** 处理 lx-music 的 HTML 实体 / 名称转义 */
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
