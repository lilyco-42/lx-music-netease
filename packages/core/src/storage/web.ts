/**
 * 基于 Web Storage (localStorage) 的 StorageAdapter。
 *
 * 浏览器与 Electron 渲染进程可用。React Native 没有 localStorage，
 * 所以移动端传 AsyncStorage（见 @lxmn/platform-mobile）。
 *
 * 注意：这里刻意不引用 DOM 的 `Storage` 类型 —— 移动端 tsconfig 的 lib 里
 * 没有 DOM，而本文件会经由 @lxmn/core 的入口被移动端编译到。
 * 用结构化接口描述所需能力，两端都能过。
 */
import type { StorageAdapter } from '../platform'

/** localStorage 的最小结构（等价于 DOM 的 Storage，但不需要 DOM lib） */
export interface WebStorageLike {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface WebStorageOptions {
  /** 键前缀，避免与页面其它数据冲突 */
  prefix?: string
  /** 自定义后端（测试 / 非浏览器环境） */
  backend?: WebStorageLike
}

/** 从 globalThis 上安全地取 localStorage（不使用 DOM 类型） */
function detectLocalStorage(): WebStorageLike | undefined {
  const g = globalThis as unknown as { localStorage?: WebStorageLike }
  const ls = g.localStorage
  // 有些环境（如 SSR）会暴露一个不可用的占位对象
  return ls && typeof ls.getItem === 'function' ? ls : undefined
}

export function createWebStorage(options: WebStorageOptions = {}): StorageAdapter {
  const prefix = options.prefix ?? ''
  const backend = options.backend ?? detectLocalStorage()

  if (!backend) {
    throw new Error('[lxmn/storage] 当前环境没有 localStorage，请注入 backend')
  }

  return {
    async get(key) {
      return backend.getItem(prefix + key)
    },
    async set(key, value) {
      backend.setItem(prefix + key, value)
    },
    async remove(key) {
      backend.removeItem(prefix + key)
    },
    async keys() {
      const out: string[] = []
      for (let i = 0; i < backend.length; i++) {
        const k = backend.key(i)
        if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length))
      }
      return out
    },
  }
}
