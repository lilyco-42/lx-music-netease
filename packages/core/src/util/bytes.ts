/**
 * 字节工具 —— 纯 TypeScript 实现，不依赖 Node Buffer，也不依赖 TextEncoder/TextDecoder。
 *
 * 原 lx-music 的 crypto.js 大量使用 Buffer.concat / Buffer.from(x, 'base64') /
 * .toString('hex')。为了让移植后的签名算法保持原样可读，这里提供等价原语。
 *
 * 刻意不使用 TextEncoder/TextDecoder：Hermes（React Native 的 JS 引擎）
 * 默认没有这两个全局对象，用了就得在移动端额外装 polyfill。
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** UTF-8 编码：与 TextEncoder 输出逐字节一致（含代理对 / 4 字节码点） */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i)
    // 代理对：合成真实码点
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const low = s.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = ((cp - 0xd800) << 10) + (low - 0xdc00) + 0x10000
        i++
      }
    }
    if (cp < 0x80) {
      out.push(cp)
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63))
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63))
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      )
    }
  }
  return Uint8Array.from(out)
}

/** UTF-8 解码：与 TextDecoder 输出一致；非法字节按 U+FFFD 处理 */
export function utf8Decode(b: Uint8Array): string {
  let out = ''
  let i = 0
  while (i < b.length) {
    const c = b[i]!
    if (c < 0x80) {
      out += String.fromCharCode(c)
      i++
    } else if (c >= 0xc0 && c < 0xe0) {
      const c1 = b[i + 1]
      if (c1 === undefined || (c1 & 0xc0) !== 0x80) { out += '\uFFFD'; i++; continue }
      out += String.fromCharCode(((c & 31) << 6) | (c1 & 63))
      i += 2
    } else if (c >= 0xe0 && c < 0xf0) {
      const c1 = b[i + 1], c2 = b[i + 2]
      if (c1 === undefined || c2 === undefined || (c1 & 0xc0) !== 0x80 || (c2 & 0xc0) !== 0x80) {
        out += '\uFFFD'; i++; continue
      }
      out += String.fromCharCode(((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63))
      i += 3
    } else if (c >= 0xf0) {
      const c1 = b[i + 1], c2 = b[i + 2], c3 = b[i + 3]
      if (c1 === undefined || c2 === undefined || c3 === undefined ||
          (c1 & 0xc0) !== 0x80 || (c2 & 0xc0) !== 0x80 || (c3 & 0xc0) !== 0x80) {
        out += '\uFFFD'; i++; continue
      }
      let cp = ((c & 7) << 18) | ((c1 & 63) << 12) | ((c2 & 63) << 6) | (c3 & 63)
      cp -= 0x10000
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023))
      i += 4
    } else {
      out += '\uFFFD'
      i++
    }
  }
  return out
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
