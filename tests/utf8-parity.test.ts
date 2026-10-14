/**
 * 手写 UTF-8 编解码 vs Node Buffer 的逐字节比对。
 *
 * 为什么需要：Hermes (React Native) 默认没有 TextEncoder/TextDecoder，
 * 所以 core 里的 utf8Encode/utf8Decode 是自己实现的。手写的编码器最容易在
 * 代理对（emoji）和 3/4 字节边界上出错，因此这里用穷举 + 随机串来钉死。
 */
import { describe, expect, it } from 'vitest'
import { utf8Encode, utf8Decode } from '@lxmn/core'

/** 覆盖各类边界的样本 */
const SAMPLES: string[] = [
  '',
  'a',
  'abc',
  // ASCII 边界
  '\u0000\u007f',
  // 2 字节
  '\u0080\u07ff',
  'é', 'ñ', 'ß', 'Ω', 'д',
  // 3 字节（CJK 是重点）
  '\u0800\uffff',
  '中文', '网易云音乐', '你好，世界！',
  'こんにちは', '한국어', '日本語のテスト',
  // 4 字节 / 代理对
  '\u{10000}', '\u{10ffff}',
  '😀', '🎵', '🎧🎤🎸',
  '𝄞', '👨‍👩‍👧‍👦',
  // 混合
  'LX Music · 音乐 🎵 (2026)',
  'a\u00e9\u4e2d\u{1f600}z',
]

describe('utf8 与 Node Buffer 一致', () => {
  it('固定样本逐字节相同', () => {
    for (const s of SAMPLES) {
      const mine = utf8Encode(s)
      const node = new Uint8Array(Buffer.from(s, 'utf8'))
      expect(Array.from(mine), `encode mismatch for ${JSON.stringify(s)}`).toEqual(Array.from(node))
    }
  })

  it('固定样本解码回原文', () => {
    for (const s of SAMPLES) {
      expect(utf8Decode(utf8Encode(s)), `decode mismatch for ${JSON.stringify(s)}`).toBe(s)
    }
  })

  it('穷举 BMP 全部码点（跳过孤立代理）', () => {
    for (let cp = 0; cp <= 0xffff; cp++) {
      // 孤立代理不是合法字符，Buffer 也会产出替换字符
      if (cp >= 0xd800 && cp <= 0xdfff) continue
      const s = String.fromCharCode(cp)
      const mine = utf8Encode(s)
      const node = new Uint8Array(Buffer.from(s, 'utf8'))
      if (mine.length !== node.length || mine.some((b, i) => b !== node[i])) {
        throw new Error(`BMP mismatch at U+${cp.toString(16).padStart(4, '0')}`)
      }
      expect(utf8Decode(mine)).toBe(s)
    }
  })

  it('穷举全部 4 字节码点边界（步进采样）', () => {
    for (let cp = 0x10000; cp <= 0x10ffff; cp += 97) {
      const s = String.fromCodePoint(cp)
      const mine = utf8Encode(s)
      const node = new Uint8Array(Buffer.from(s, 'utf8'))
      if (mine.length !== node.length || mine.some((b, i) => b !== node[i])) {
        throw new Error(`astral mismatch at U+${cp.toString(16)}`)
      }
      expect(utf8Decode(mine)).toBe(s)
    }
  })

  it('随机串（含 CJK / emoji）与 Buffer 相同', () => {
    const pool = [
      ...Array.from({ length: 0x7f }, (_, i) => i + 1),
      ...Array.from({ length: 0x800 - 0x80 }, (_, i) => 0x80 + i),
      ...Array.from({ length: 0x2000 }, (_, i) => 0x4e00 + i),
      0x1f600, 0x1f3b5, 0x1d11e, 0x10ffff,
    ]
    for (let round = 0; round < 300; round++) {
      let s = ''
      const len = 1 + Math.floor(Math.random() * 24)
      for (let i = 0; i < len; i++) {
        s += String.fromCodePoint(pool[Math.floor(Math.random() * pool.length)]!)
      }
      const mine = utf8Encode(s)
      const node = new Uint8Array(Buffer.from(s, 'utf8'))
      expect(Array.from(mine), `random mismatch: ${JSON.stringify(s)}`).toEqual(Array.from(node))
      expect(utf8Decode(mine)).toBe(s)
    }
  })

  it('base64 编解码与 Buffer 相同', async () => {
    const { toBase64, fromBase64 } = await import('@lxmn/core')
    for (const s of SAMPLES) {
      const bytes = utf8Encode(s)
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes))
    }
    // 各种长度以覆盖 padding 分支
    for (let len = 0; len <= 20; len++) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255)
      const b64 = Buffer.from(bytes).toString('base64')
      expect(toBase64(bytes)).toBe(b64)
      expect(Array.from(fromBase64(b64))).toEqual(Array.from(bytes))
    }
  })
})
