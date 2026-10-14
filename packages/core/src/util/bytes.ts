/**
 * 字节工具 —— 纯 TypeScript 实现，不依赖 Node Buffer。
 *
 * 原 lx-music 的 crypto.js 大量使用 Buffer.concat / Buffer.from(x, 'base64') /
 * .toString('hex')。为了让移植后的签名算法保持原样可读，这里提供等价原语，
 * 且因为是纯 JS，React Native 无需 polyfill 即可运行。
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

export function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b)
}

export function concat(arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

export function alloc(size: number): Uint8Array {
  return new Uint8Array(size)
}

export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    const triplet = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0)
    out += B64_CHARS[(triplet >> 18) & 63]
    out += B64_CHARS[(triplet >> 12) & 63]
    out += b1 === undefined ? '=' : B64_CHARS[(triplet >> 6) & 63]
    out += b2 === undefined ? '=' : B64_CHARS[triplet & 63]
  }
  return out
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '')
  const len = Math.floor((clean.length * 3) / 4)
  const out = new Uint8Array(len)
  let p = 0
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i] ?? 'A')
    const c1 = B64_CHARS.indexOf(clean[i + 1] ?? 'A')
    const c2 = B64_CHARS.indexOf(clean[i + 2] ?? 'A')
    const c3 = B64_CHARS.indexOf(clean[i + 3] ?? 'A')
    const triplet = (c0 << 18) | (c1 << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3)
    if (p < len) out[p++] = (triplet >> 16) & 255
    if (p < len) out[p++] = (triplet >> 8) & 255
    if (p < len) out[p++] = triplet & 255
  }
  return out
}

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(Math.floor(s.length / 2))
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/** 逆序（weapi 会把 secretKey reverse 后交给 RSA） */
export function reverseBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes).reverse()
}

/** 左侧补零到指定长度（rsaEncrypt 的 Buffer.alloc(128 - len) 前置填充） */
export function leftPad(bytes: Uint8Array, size: number): Uint8Array {
  if (bytes.length >= size) return bytes
  const out = new Uint8Array(size)
  out.set(bytes, size - bytes.length)
  return out
}
