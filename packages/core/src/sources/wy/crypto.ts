/**
 * 网易云音乐 签名算法 —— 逐行移植自 lx-music-desktop
 *   src/renderer/utils/musicSdk/wy/utils/crypto.js
 * 上游注释指向 https://github.com/Binaryify/NeteaseCloudMusicApi/blob/master/util/crypto.js
 *
 * 移植说明：
 * 原文件用 node:crypto 的 createCipheriv / createDecipheriv / publicEncrypt /
 * randomBytes / createHash，这里全部改为通过 PlatformAdapter.crypto 调用。
 * 算法、密钥、常量、字符串拼接顺序 **完全未改动**，因此输出字节与上游一致。
 */
import { getPlatform } from '../../registry'
import {
  alloc, concat, fromBase64, toBase64, toHex, reverseBytes, leftPad, utf8Encode, utf8Decode,
} from '../../util/bytes'

const IV = utf8Encode('0102030405060708')
const PRESET_KEY = utf8Encode('0CoJUm6Qyw8W8jud')
const LINUXAPI_KEY = utf8Encode('rFgB&h#%2?^eDg:Q')
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----'
// 上游把该字符串直接交给 createCipheriv（Node 按 utf8 处理），这里显式编码
const EAPI_KEY = utf8Encode('e82ckenh8dichen8')

const aesEncrypt = (buffer: Uint8Array, mode: 'aes-128-cbc' | 'aes-128-ecb', key: Uint8Array, iv: Uint8Array) =>
  getPlatform().crypto.aesEncrypt(buffer, mode, key, iv)

const aesDecrypt = (cipherBuffer: Uint8Array, mode: 'aes-128-cbc' | 'aes-128-ecb', key: Uint8Array, iv: Uint8Array) =>
  getPlatform().crypto.aesDecrypt(cipherBuffer, mode, key, iv)

const rsaEncrypt = (buffer: Uint8Array, key: string) =>
  getPlatform().crypto.rsaEncrypt(leftPad(buffer, 128), key, 'none')

/** weapi：网页端接口签名（AES-128-CBC 两层 + RSA） */
export const weapi = (object: unknown) => {
  const text = JSON.stringify(object)
  const { randomBytes } = getPlatform().crypto
  const secretKey = Uint8Array.from(
    randomBytes(16),
    n => BASE62.charCodeAt(n % 62),
  )
  return {
    params: toBase64(
      aesEncrypt(
        utf8Encode(toBase64(aesEncrypt(utf8Encode(text), 'aes-128-cbc', PRESET_KEY, IV))),
        'aes-128-cbc',
        secretKey,
        IV,
      ),
    ),
    encSecKey: toHex(rsaEncrypt(reverseBytes(secretKey), PUBLIC_KEY)),
  }
}

/** linuxapi：Linux 客户端接口签名（AES-128-ECB） */
export const linuxapi = (object: unknown) => {
  const text = JSON.stringify(object)
  return {
    eparams: toHex(aesEncrypt(utf8Encode(text), 'aes-128-ecb', LINUXAPI_KEY, alloc(0))).toUpperCase(),
  }
}

/** eapi：移动端接口签名（AES-128-ECB + md5 校验段） */
export const eapi = (url: string, object: unknown) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : String(object)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = getPlatform().crypto.md5(message)
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: toHex(aesEncrypt(utf8Encode(data), 'aes-128-ecb', EAPI_KEY, alloc(0))).toUpperCase(),
  }
}

export const eapiDecrypt = (cipherBuffer: Uint8Array) =>
  utf8Decode(aesDecrypt(cipherBuffer, 'aes-128-ecb', EAPI_KEY, alloc(0)))

/** 供测试与调用方使用的常量导出 */
export const WY_CONSTANTS = {
  IV: '0102030405060708',
  PRESET_KEY: '0CoJUm6Qyw8W8jud',
  LINUXAPI_KEY: 'rFgB&h#%2?^eDg:Q',
  EAPI_KEY: 'e82ckenh8dichen8',
  PUBLIC_KEY,
} as const
