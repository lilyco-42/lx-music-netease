/**
 * 纯 JavaScript 可移植加密实现
 *
 * 这是「全平台兼容」的关键：把 CryptoAdapter 用纯 JS 实现，
 * 于是同一份 @lxmn/core 在 Node / React Native / 浏览器 / 测试环境
 * 都能直接运行，**不需要任何原生模块**。
 *
 * 对比 lx-music-mobile 原本的做法：
 *   - react-native-quick-md5（原生模块，需 iOS/Android 分别编译）
 *   - NativeModules.CryptoModule（原生 AES/RSA，需 Android/iOS 各写一遍）
 * 换成纯 JS 后，移动端不再需要为加密单独维护两套原生代码。
 */
import type { CryptoAdapter } from '../platform'
import { md5Bytes, sha1Bytes } from './hash'
import { aesEncrypt as aesEnc, aesDecrypt as aesDec } from './aes'
import { rsaEncrypt as rsaEnc } from './rsa'
import { utf8Encode, toHex } from '../util/bytes'

const toBytes = (d: string | Uint8Array): Uint8Array =>
  typeof d === 'string' ? utf8Encode(d) : d

/** 密码学安全随机数；无 crypto 时退化为 Math.random（仅用于非安全场景） */
function randomBytes(size: number): Uint8Array {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
  if (g.crypto?.getRandomValues) return g.crypto.getRandomValues(new Uint8Array(size))
  return Uint8Array.from({ length: size }, () => Math.floor(Math.random() * 256))
}

export const portableCrypto: CryptoAdapter = {
  aesEncrypt(data, mode, key, iv) {
    return aesEnc(data, mode, key, iv ?? new Uint8Array(16))
  },

  aesDecrypt(data, mode, key, iv) {
    return aesDec(data, mode, key, iv ?? new Uint8Array(16))
  },

  rsaEncrypt(data, publicKey, padding = 'none') {
    return rsaEnc(data, publicKey, padding)
  },

  randomBytes,

  md5(data) {
    return toHex(md5Bytes(toBytes(data)))
  },

  sha1(data) {
    return toHex(sha1Bytes(toBytes(data)))
  },
}

export { md5Bytes, sha1Bytes, randomBytes }
