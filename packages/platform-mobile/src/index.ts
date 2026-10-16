/**
 * React Native 平台实现
 *
 * 与 lx-music-mobile 原方案的关键区别：**不需要任何加密原生模块**。
 * 加密走 @lxmn/core 的纯 JS 实现（已用测试与 node:crypto 比对通过），
 * 因此移动端不再需要 react-native-quick-md5 / CryptoModule 这类需要
 * iOS + Android 各写一遍的原生代码。
 *
 * 仍然需要宿主注入的能力（RN 无法从 core 直接拿到）：
 *   - fetch：RN 内置，直接传
 *   - AsyncStorage：由宿主传入，避免把存储方案写死
 *   - 后台定时器：可选，用于保持播放不被系统挂起
 */
import {
  setPlatform,
  createPortablePlatform,
  utf8Decode,
  type PlatformAdapter,
  type HttpRequestOptions,
  type HttpResponse,
  type StorageAdapter,
  type TimerAdapter,
  APP_VERSION,
} from '@lxmn/core'

export interface RnBackgroundTimer {
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
  setInterval(fn: () => void, ms: number): number
  clearInterval(id: number): void
}

/** 把 lx-music-mobile 的 request 语义映射到 RN fetch */
export function createRnHttp(fetchImpl: typeof fetch = fetch) {
  return {
    async request(options: HttpRequestOptions): Promise<HttpResponse> {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer: ReturnType<typeof setTimeout> | null = controller
        ? setTimeout(() => controller.abort(), options.timeout ?? 15000)
        : null

      try {
        const headers: Record<string, string> = { ...options.headers }
        let body: string | undefined

        if (options.form) {
          headers['content-type'] = 'application/x-www-form-urlencoded'
          body = Object.entries(options.form)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join('&')
        } else if (options.body) {
          body = typeof options.body === 'string' ? options.body : utf8Decode(options.body)
        }

        const res = await fetchImpl(options.url, {
          method: options.method ?? 'GET',
          headers,
          body,
          signal: controller?.signal,
        })

        const buf = new Uint8Array(await res.arrayBuffer())
        const resHeaders: Record<string, string> = {}
        res.headers.forEach((v: string, k: string) => { resHeaders[k] = v })

        return {
          statusCode: res.status,
          headers: resHeaders,
          body: options.binary ? '' : utf8Decode(buf),
          raw: buf,
        }
      } finally {
        if (timer) clearTimeout(timer)
      }
    },
  }
}

/** RN 的 setTimeout 返回对象而非 number，这里统一成 number */
export function createRnTimer(backgroundTimer?: RnBackgroundTimer): TimerAdapter {
  const ids = new Map<number, ReturnType<typeof setTimeout>>()
  let next = 1

  const timer: TimerAdapter = {
    setTimeout(fn: () => void, ms: number): number {
      const id = next++
      ids.set(id, setTimeout(fn, ms))
      return id
    },
    clearTimeout(id: number): void {
      const real = ids.get(id)
      if (real !== undefined) clearTimeout(real)
      ids.delete(id)
    },
    setInterval(fn: () => void, ms: number): number {
      const id = next++
      ids.set(id, setInterval(fn, ms) as unknown as ReturnType<typeof setTimeout>)
      return id
    },
    clearInterval(id: number): void {
      const real = ids.get(id)
      if (real !== undefined) clearInterval(real as unknown as ReturnType<typeof setTimeout>)
      ids.delete(id)
    },
  }

  if (backgroundTimer) {
    // 播放期间系统可能挂起 JS 定时器，用后台定时器维持
    timer.setBackgroundTimeout = (fn: () => void, ms: number): number =>
      backgroundTimer.setTimeout(fn, ms)
    timer.clearBackgroundTimeout = (id: number): void => backgroundTimer.clearTimeout(id)
  }

  return timer
}

export interface MobilePlatformOptions {
  /** AsyncStorage 或任何等价实现 */
  storage: StorageAdapter
  /** 可选：后台定时器（react-native-background-timer） */
  backgroundTimer?: RnBackgroundTimer
  /** 可选：自定义 fetch（测试 / 代理） */
  fetchImpl?: typeof fetch
  /** 可选：GBK 等名称解码（iconv-lite） */
  decodeName?: (s: string | Uint8Array) => string
}

/** 组装 RN 平台适配器 */
export function createMobilePlatform(options: MobilePlatformOptions): PlatformAdapter {
  return createPortablePlatform({
    name: 'mobile',
    http: createRnHttp(options.fetchImpl),
    timer: createRnTimer(options.backgroundTimer),
    storage: options.storage,
    decodeName: options.decodeName,
    version: APP_VERSION,
  })
}

/** RN 启动时调用一次 */
export function installMobilePlatform(options: MobilePlatformOptions): PlatformAdapter {
  const platform = createMobilePlatform(options)
  setPlatform(platform)
  return platform
}

export default installMobilePlatform
