/**
 * 基于标准 fetch 的 HttpAdapter。
 *
 * 桌面 Electron 渲染进程、浏览器、React Native 都能直接用。
 * 只有 Node 端（无 DOM）才需要 node:http 版本，见 @lxmn/platform-desktop。
 */
import type { HttpAdapter, HttpRequestOptions, HttpResponse } from '../platform'
import { utf8Decode } from '../util/bytes'

/** 把 form 对象编码成 application/x-www-form-urlencoded */
export function encodeForm(form: Record<string, string>): string {
  return Object.entries(form)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}

export interface FetchHttpOptions {
  /** 自定义 fetch（测试 / 代理） */
  fetchImpl?: typeof fetch
  /** 默认超时毫秒 */
  timeout?: number
}

/**
 * 注意：Electron 渲染进程直接 fetch 会被 CORS 拦住（音乐接口不返回 CORS 头）。
 * 桌面端因此通过 preload 注入的 `lxmnNative.request` 走主进程；
 * 见 apps/desktop/src/lib/platform.ts。这个 fetch 版本用于浏览器 / 测试 / RN。
 */
export function createFetchHttp(options: FetchHttpOptions = {}): HttpAdapter {
  const doFetch = options.fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new Error('[lxmn/http] 当前环境没有 fetch，请注入 fetchImpl')
  }
  const defaultTimeout = options.timeout ?? 15000

  return {
    async request(o: HttpRequestOptions): Promise<HttpResponse> {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = controller ? setTimeout(() => controller.abort(), o.timeout ?? defaultTimeout) : null

      try {
        const headers: Record<string, string> = { ...o.headers }
        let body: string | undefined

        if (o.form) {
          headers['content-type'] = 'application/x-www-form-urlencoded'
          body = encodeForm(o.form)
        } else if (o.body !== undefined) {
          body = typeof o.body === 'string' ? o.body : utf8Decode(o.body)
        }

        const res = await doFetch(o.url, {
          method: o.method ?? 'GET',
          headers,
          body,
          signal: controller?.signal ?? undefined,
        })

        const buf = new Uint8Array(await res.arrayBuffer())
        const resHeaders: Record<string, string> = {}
        res.headers.forEach((v, k) => {
          resHeaders[k] = v
        })

        return {
          statusCode: res.status,
          headers: resHeaders,
          body: o.binary ? '' : utf8Decode(buf),
          raw: buf,
        }
      } finally {
        if (timer) clearTimeout(timer)
      }
    },
  }
}
