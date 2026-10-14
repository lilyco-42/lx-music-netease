/**
 * 纯 JavaScript 摘要算法（MD5 / SHA-1）
 *
 * 为什么不用 node:crypto 或 react-native-quick-md5：
 * 目标是「一份代码全平台」——React Native 上 node:crypto 不存在，
 * 而原生模块需要 iOS/Android 分别编译、无法在 Web 与测试环境运行。
 * 纯 JS 实现零依赖、零原生编译，在 Node / RN / Web / 小程序 都能跑。
 *
 * 正确性由 tests/crypto-parity.test.ts 与 node:crypto 逐一比对保证。
 */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const K = (() => {
  const k = new Uint32Array(64)
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
  return k
})()

/** MD5，返回 16 字节摘要 */
export function md5Bytes(input: Uint8Array): Uint8Array {
  const len = input.length
  const withOne = len + 1
  const padLen = ((56 - (withOne % 64)) + 64) % 64
  const total = withOne + padLen + 8

  const msg = new Uint8Array(total)
  msg.set(input)
  msg[len] = 0x80

  const dv = new DataView(msg.buffer)
  const bitLen = len * 8
  dv.setUint32(total - 8, bitLen >>> 0, true)
  dv.setUint32(total - 4, Math.floor(bitLen / 4294967296), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const M = new Uint32Array(16)

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true)

    let A = a0
    let B = b0
    let C = c0
    let D = d0

    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i]! + M[g]!) >>> 0
      A = D
      D = C
      C = B
      const s = S[i]!
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const out = new Uint8Array(16)
  const odv = new DataView(out.buffer)
  odv.setUint32(0, a0, true)
  odv.setUint32(4, b0, true)
  odv.setUint32(8, c0, true)
  odv.setUint32(12, d0, true)
  return out
}

/** SHA-1，返回 20 字节摘要 */
export function sha1Bytes(input: Uint8Array): Uint8Array {
  const len = input.length
  const withOne = len + 1
  const padLen = ((56 - (withOne % 64)) + 64) % 64
  const total = withOne + padLen + 8

  const msg = new Uint8Array(total)
  msg.set(input)
  msg[len] = 0x80

  const dv = new DataView(msg.buffer)
  const bitLen = len * 8
  dv.setUint32(total - 8, Math.floor(bitLen / 4294967296), false)
  dv.setUint32(total - 4, bitLen >>> 0, false)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const w = new Uint32Array(80)

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false)
    for (let i = 16; i < 80; i++) {
      const v = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!
      w[i] = ((v << 1) | (v >>> 31)) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = ((((a << 5) | (a >>> 27)) >>> 0) + f + e + k + w[i]!) >>> 0
      e = d
      d = c
      c = ((b << 30) | (b >>> 2)) >>> 0
      b = a
      a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const out = new Uint8Array(20)
  const odv = new DataView(out.buffer)
  odv.setUint32(0, h0, false)
  odv.setUint32(4, h1, false)
  odv.setUint32(8, h2, false)
  odv.setUint32(12, h3, false)
  odv.setUint32(16, h4, false)
  return out
}
