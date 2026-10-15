/**
 * 移动端平台装配。
 *
 * 关键点：加密完全走 @lxmn/core 的纯 JS 实现，
 * 因此这里**不需要** react-native-quick-md5 / CryptoModule 等原生模块，
 * 也就不用为 iOS / Android 各维护一套加密代码。
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { installMobilePlatform } from '@lxmn/platform-mobile'
import {
  installWySource,
  installKwSource,
  installMgSource,
  installKgSource,
  hasSource,
  type SourceId,
  type StorageAdapter,
} from '@lxmn/core'

/** 内核里已经移植完成的音源（与桌面端保持同一份清单） */
const BUILTIN: { id: SourceId; install: () => void }[] = [
  { id: 'wy', install: installWySource },
  { id: 'kw', install: installKwSource },
  { id: 'mg', install: installMgSource },
  { id: 'kg', install: installKgSource },
]

/** 把 AsyncStorage 适配成内核的 StorageAdapter */
const storage: StorageAdapter = {
  async get(key) {
    return AsyncStorage.getItem(key)
  },
  async set(key, value) {
    await AsyncStorage.setItem(key, value)
  },
  async remove(key) {
    await AsyncStorage.removeItem(key)
  },
  async keys() {
    return [...(await AsyncStorage.getAllKeys())]
  },
}

let installed = false

/** 在 App 启动时调用一次 */
export function ensurePlatform() {
  if (installed) return
  installMobilePlatform({ storage })
  for (const s of BUILTIN) {
    if (!hasSource(s.id)) s.install()
  }
  installed = true
}

export { storage, BUILTIN }
