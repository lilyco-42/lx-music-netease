/**
 * 基于 Web Storage (localStorage) 的 StorageAdapter。
 *
 * 浏览器与 Electron 渲染进程可用。React Native 没有 localStorage，
 * 所以移动端传 AsyncStorage（见 @lxmn/platform-mobile）。
 */
import type { StorageAdapter } from '../platform'

export interface WebStorageOptions {
  /** 键前缀，避免与页面其它数据冲突 */
  prefix?: string
  /** 自定义后端（测试用） */
  backend?: Storage
}

export function createWebStorage(options: WebStorageOptions = {}): StorageAdapter {
  const prefix = options.prefix ?? ''
  const backend: Storage | undefined = options.backend ??
    (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined)

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
