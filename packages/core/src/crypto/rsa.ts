/**
 * 纯 JavaScript RSA 公钥加密（支持 NO_PADDING / PKCS#1 v1.5）
 *
 * 网易 weapi 需要 RSA_NO_PADDING，而 RN 上原本依赖原生 CryptoModule。
 * 这里用 BigInt 做模幂，并手写最小 ASN.1/DER 解析从 PEM 中取出 (n, e)，
 * 于是 RSA 也变成零依赖、零原生编译的纯 JS 实现。
 *
 * BigInt 在 Hermes (RN 0.70+)、JSC、V8 均已支持。
 */

/**
 * 取密码学安全随机数。
 * 用索引签名访问 globalThis，避免在不同 TS lib 配置下报 TS7017；
 * 找不到 crypto 时退化为 Math.random（仅 PKCS#1 填充需要，NO_PADDING 用不到）。
 */
function getRandomValues(out: Uint8Array): Uint8Array {
  const g = globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
  if (g.crypto?.getRandomValues) return g.crypto.getRandomValues(out)
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

/* ---------- 最小 ASN.1 DER 解析 ---------- */

interface DerNode {
  tag: number
  start: number
  /** 内容字节（不含 tag/length） */
  content: Uint8Array
  /** 该节点在原始缓冲区中的总长度（含 tag/length） */
  total: number
}

function readDer(buf: Uint8Array, pos: number): DerNode {
  const tag = buf[pos]!
  let len = buf[pos + 1]!
  let lenBytes = 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = (len << 8) | buf[pos + 2 + i]!
    lenBytes = 2 + n
  }
  const start = pos + lenBytes
  return { tag, start, content: buf.subarray(start, start + len), total: lenBytes + len }
}

/** 从 PEM 中剥离头尾并 base64 解码 */
export function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  return base64ToBytes(body)
}

function base64ToBytes(s: string): Uint8Array {
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '')
  const len = Math.floor((clean.length * 3) / 4)
  const out = new Uint8Array(len)
  let p = 0
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = CH.indexOf(clean[i] ?? 'A')
    const c1 = CH.indexOf(clean[i + 1] ?? 'A')
    const c2 = CH.indexOf(clean[i + 2] ?? 'A')
    const c3 = CH.indexOf(clean[i + 3] ?? 'A')
    const t = (c0 << 18) | (c1 << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3)
    if (p < len) out[p++] = (t >> 16) & 255
    if (p < len) out[p++] = (t >> 8) & 255
    if (p < len) out[p++] = t & 255
  }
  return out
}

function bytesToBigInt(b: Uint8Array): bigint {
  let v = 0n
  for (const byte of b) v = (v << 8n) | BigInt(byte)
  return v
}

function bigIntToBytes(v: bigint, size: number): Uint8Array {
  const out = new Uint8Array(size)
  let x = v
  for (let i = size - 1; i >= 0; i--) {
    out[i] = Number(x & 0xffn)
    x >>= 8n
  }
  return out
}

/**
 * 解析 SubjectPublicKeyInfo（PEM 常见形式）或裸 RSAPublicKey，
 * 返回模数 n 与指数 e。
 */
export function parseRsaPublicKey(pem: string): { n: bigint; e: bigint; size: number } {
  const der = pemToDer(pem)
  const top = readDer(der, 0)

  let rsaSeq: DerNode
  if (top.tag === 0x30) {
    // SubjectPublicKeyInfo：SEQUENCE { AlgorithmIdentifier, BIT STRING }
    const alg = readDer(der, top.start)
    const afterAlg = top.start + alg.total
    const bitString = readDer(der, afterAlg)
    if (bitString.tag === 0x03) {
      // BIT STRING 首字节为 unused-bits 计数（通常 0）
      const inner = bitString.content.subarray(1)
      rsaSeq = readDer(inner, 0)
      const nNode = readDer(inner, rsaSeq.start)
      const eNode = readDer(inner, rsaSeq.start + nNode.total)
      const n = bytesToBigInt(stripLeadingZero(nNode.content))
      const e = bytesToBigInt(stripLeadingZero(eNode.content))
      return { n, e, size: Math.ceil(n.toString(2).length / 8) }
    }
    // 裸 RSAPublicKey
    rsaSeq = top
    const nNode = readDer(der, rsaSeq.start)
    const eNode = readDer(der, rsaSeq.start + nNode.total)
    const n = bytesToBigInt(stripLeadingZero(nNode.content))
    const e = bytesToBigInt(stripLeadingZero(eNode.content))
    return { n, e, size: Math.ceil(n.toString(2).length / 8) }
  }

  throw new Error('[lxmn/rsa] Unsupported public key format')
}

function stripLeadingZero(b: Uint8Array): Uint8Array {
  return b.length > 1 && b[0] === 0 ? b.subarray(1) : b
}

/** 模幂：base^exp mod m */
export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  let b = base % mod
  let e = exp
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod
    b = (b * b) % mod
    e >>= 1n
  }
  return result
}

/** 填充至 k 字节（等价 Buffer.alloc(k - len) 前置补零） */
function leftPadTo(b: Uint8Array, size: number): Uint8Array {
  if (b.length === size) return b
  if (b.length > size) throw new Error('[lxmn/rsa] Input longer than modulus')
  const out = new Uint8Array(size)
  out.set(b, size - b.length)
  return out
}

/**
 * RSA 公钥加密。
 * @param data 待加密字节（NO_PADDING 时必须已补齐到模长）
 * @param pem 公钥（PEM 或已剥离头尾的 base64）
 */
export function rsaEncrypt(
  data: Uint8Array,
  pem: string,
  padding: 'none' | 'pkcs1' = 'none',
): Uint8Array {
  const { n, e, size } = parseRsaPublicKey(pem)

  let block: Uint8Array
  if (padding === 'none') {
    block = leftPadTo(data, size)
  } else {
    // PKCS#1 v1.5: 0x00 || 0x02 || PS(>=8 随机非零) || 0x00 || M
    const psLen = size - data.length - 3
    if (psLen < 8) throw new Error('[lxmn/rsa] Message too long for PKCS#1 padding')
    const ps = new Uint8Array(psLen)
    const rnd = getRandomValues(new Uint8Array(psLen))
    for (let i = 0; i < psLen; i++) ps[i] = rnd[i] === 0 ? 1 : rnd[i]!
    block = new Uint8Array(size)
    block[1] = 0x02
    block.set(ps, 2)
    block.set(data, 2 + psLen + 1)
  }

  const m = bytesToBigInt(block)
  const c = modPow(m, e, n)
  return bigIntToBytes(c, size)
}
