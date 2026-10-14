/**
 * 纯 JavaScript AES-128（CBC / ECB + PKCS#7）
 *
 * 与 hash.ts 同理：不依赖 node:crypto，也不依赖任何原生模块，
 * 因此同一份实现可在 Node / React Native / Web 运行。
 *
 * S-box 由 GF(2^8) 乘法逆元 + 仿射变换**现算**得出，而不是硬编码 256 个常量——
 * 后者极易打错且无法自查。正确性由 tests/crypto-parity.test.ts 与 node:crypto 比对保证。
 */

/* ---------- GF(2^8) 乘法与逆元 ---------- */

function gmul(a: number, b: number): number {
  let p = 0
  let x = a & 0xff
  let y = b & 0xff
  for (let i = 0; i < 8; i++) {
    if (y & 1) p ^= x
    const hi = x & 0x80
    x = (x << 1) & 0xff
    if (hi) x ^= 0x1b
    y >>= 1
  }
  return p & 0xff
}

const GF_INV = (() => {
  const inv = new Uint8Array(256)
  for (let i = 1; i < 256; i++) {
    for (let j = 1; j < 256; j++) {
      if (gmul(i, j) === 1) {
        inv[i] = j
        break
      }
    }
  }
  return inv
})()

const rotl8 = (v: number, n: number) => ((v << n) | (v >>> (8 - n))) & 0xff

const SBOX = (() => {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const inv = GF_INV[i]!
    s[i] = (inv ^ rotl8(inv, 1) ^ rotl8(inv, 2) ^ rotl8(inv, 3) ^ rotl8(inv, 4) ^ 0x63) & 0xff
  }
  return s
})()

const INV_SBOX = (() => {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) s[SBOX[i]!] = i
  return s
})()

/* ---------- 密钥扩展（AES-128，11 组轮密钥） ---------- */

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

export function expandKey(key: Uint8Array): Uint8Array {
  if (key.length !== 16) throw new Error(`[lxmn/aes] AES-128 requires a 16-byte key, got ${key.length}`)
  const w = new Uint8Array(176)
  w.set(key)
  for (let i = 4; i < 44; i++) {
    const off = i * 4
    let t0 = w[off - 4]!
    let t1 = w[off - 3]!
    let t2 = w[off - 2]!
    let t3 = w[off - 1]!
    if (i % 4 === 0) {
      // RotWord + SubWord + Rcon
      const tmp = t0
      t0 = SBOX[t1]! ^ RCON[i / 4]!
      t1 = SBOX[t2]!
      t2 = SBOX[t3]!
      t3 = SBOX[tmp]!
    }
    w[off] = w[off - 16]! ^ t0
    w[off + 1] = w[off - 15]! ^ t1
    w[off + 2] = w[off - 14]! ^ t2
    w[off + 3] = w[off - 13]! ^ t3
  }
  return w
}

/* ---------- 分组变换（状态按列优先：state[r + 4c]） ---------- */

const addRoundKey = (s: Uint8Array, w: Uint8Array, round: number) => {
  const base = round * 16
  for (let i = 0; i < 16; i++) s[i] = s[i]! ^ w[base + i]!
}

const subBytes = (s: Uint8Array, box: Uint8Array) => {
  for (let i = 0; i < 16; i++) s[i] = box[s[i]!]!
}

const shiftRows = (s: Uint8Array) => {
  const t = Uint8Array.from(s)
  for (let r = 1; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      s[r + 4 * c] = t[r + 4 * ((c + r) % 4)]!
    }
  }
}

const invShiftRows = (s: Uint8Array) => {
  const t = Uint8Array.from(s)
  for (let r = 1; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      s[r + 4 * c] = t[r + 4 * ((c - r + 4) % 4)]!
    }
  }
}

const mixColumns = (s: Uint8Array) => {
  for (let c = 0; c < 4; c++) {
    const i = 4 * c
    const a0 = s[i]!, a1 = s[i + 1]!, a2 = s[i + 2]!, a3 = s[i + 3]!
    s[i] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3
    s[i + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3
    s[i + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3)
    s[i + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2)
  }
}

const invMixColumns = (s: Uint8Array) => {
  for (let c = 0; c < 4; c++) {
    const i = 4 * c
    const a0 = s[i]!, a1 = s[i + 1]!, a2 = s[i + 2]!, a3 = s[i + 3]!
    s[i] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9)
    s[i + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13)
    s[i + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11)
    s[i + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14)
  }
}

/* ---------- 单分组加解密 ---------- */

export function encryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = Uint8Array.from(block)
  addRoundKey(s, w, 0)
  for (let round = 1; round <= 9; round++) {
    subBytes(s, SBOX)
    shiftRows(s)
    mixColumns(s)
    addRoundKey(s, w, round)
  }
  subBytes(s, SBOX)
  shiftRows(s)
  addRoundKey(s, w, 10)
  return s
}

export function decryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const s = Uint8Array.from(block)
  addRoundKey(s, w, 10)
  for (let round = 9; round >= 1; round--) {
    invShiftRows(s)
    subBytes(s, INV_SBOX)
    addRoundKey(s, w, round)
    invMixColumns(s)
  }
  invShiftRows(s)
  subBytes(s, INV_SBOX)
  addRoundKey(s, w, 0)
  return s
}

/* ---------- PKCS#7 填充 ---------- */

export function pkcs7Pad(data: Uint8Array): Uint8Array {
  const pad = 16 - (data.length % 16)
  const out = new Uint8Array(data.length + pad)
  out.set(data)
  out.fill(pad, data.length)
  return out
}

export function pkcs7Unpad(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data
  const pad = data[data.length - 1]!
  if (pad < 1 || pad > 16 || pad > data.length) {
    throw new Error('[lxmn/aes] Invalid PKCS#7 padding')
  }
  return data.subarray(0, data.length - pad)
}

/* ---------- 模式封装（与 Node createCipheriv 默认行为一致：自动 PKCS#7） ---------- */

export function aesEncrypt(
  data: Uint8Array,
  mode: 'aes-128-cbc' | 'aes-128-ecb',
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  const w = expandKey(key)
  const padded = pkcs7Pad(data)
  const out = new Uint8Array(padded.length)

  if (mode === 'aes-128-ecb') {
    for (let off = 0; off < padded.length; off += 16) {
      out.set(encryptBlock(padded.subarray(off, off + 16), w), off)
    }
    return out
  }

  // 显式标注：TS 5.9 的 Uint8Array 带 ArrayBufferLike 泛型，
  // 不标注会把 prev 收窄成 Uint8Array<ArrayBuffer> 而与 encryptBlock 的返回类型冲突
  let prev: Uint8Array = Uint8Array.from(iv.subarray(0, 16))
  for (let off = 0; off < padded.length; off += 16) {
    const block: Uint8Array = Uint8Array.from(padded.subarray(off, off + 16))
    for (let i = 0; i < 16; i++) block[i] = block[i]! ^ prev[i]!
    const enc: Uint8Array = encryptBlock(block, w)
    out.set(enc, off)
    prev = enc
  }
  return out
}

export function aesDecrypt(
  data: Uint8Array,
  mode: 'aes-128-cbc' | 'aes-128-ecb',
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  if (data.length % 16 !== 0) {
    throw new Error('[lxmn/aes] Ciphertext length must be a multiple of 16')
  }
  const w = expandKey(key)
  const out = new Uint8Array(data.length)

  if (mode === 'aes-128-ecb') {
    for (let off = 0; off < data.length; off += 16) {
      out.set(decryptBlock(data.subarray(off, off + 16), w), off)
    }
    return pkcs7Unpad(out)
  }

  let prev: Uint8Array = Uint8Array.from(iv.subarray(0, 16))
  for (let off = 0; off < data.length; off += 16) {
    const cipherBlock = data.subarray(off, off + 16)
    const dec: Uint8Array = decryptBlock(cipherBlock, w)
    for (let i = 0; i < 16; i++) dec[i] = dec[i]! ^ prev[i]!
    out.set(dec, off)
    prev = Uint8Array.from(cipherBlock)
  }
  return pkcs7Unpad(out)
}

/** 仅用于自检：导出 S-box 便于测试 */
export { SBOX, INV_SBOX, gmul }
