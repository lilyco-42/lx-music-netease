import { describe, it, expect } from 'vitest'
import { parseLrc, parseLyric, findLineIndex, mergeTranslation } from '../packages/core/src/lyric'

describe('LRC 解析', () => {
  it('解析标准时间戳并按时间排序', () => {
    const r = parseLrc('[00:12.34]第二行\n[00:01.00]第一行')
    expect(r.lines.map(l => l.text)).toEqual(['第一行', '第二行'])
    expect(r.lines[1].time).toBeCloseTo(12.34, 2)
  })

  it('毫秒位数 1/2/3 位都按左对齐补齐', () => {
    const r = parseLrc('[00:01.5]a\n[00:02.34]b\n[00:03.340]c')
    expect(r.lines[0].time).toBeCloseTo(1.5, 3)
    expect(r.lines[1].time).toBeCloseTo(2.34, 3)
    expect(r.lines[2].time).toBeCloseTo(3.34, 3)
  })

  it('一行多个时间戳会展开成多行（副歌复用）', () => {
    const r = parseLrc('[00:10.00][01:20.00]副歌')
    expect(r.lines.length).toBe(2)
    expect(r.lines.map(l => l.text)).toEqual(['副歌', '副歌'])
    expect(r.lines[1].time).toBeCloseTo(80, 2)
  })

  it('没有小数的时间戳可用', () => {
    expect(parseLrc('[00:12]文本').lines[0].time).toBe(12)
  })

  it('offset 生效：正值让歌词提前', () => {
    // offset:-500 表示歌词整体延后 0.5s
    expect(parseLrc('[offset:-500]\n[00:10.00]a').lines[0].time).toBeCloseTo(10.5, 3)
    expect(parseLrc('[offset:500]\n[00:10.00]a').lines[0].time).toBeCloseTo(9.5, 3)
  })

  it('忽略元信息标签，不会当成歌词', () => {
    const r = parseLrc('[ti:歌名]\n[ar:歌手]\n[00:01.00]真的歌词')
    expect(r.lines.length).toBe(1)
    expect(r.lines[0].text).toBe('真的歌词')
  })

  it('空文本行保留，用于间奏占位', () => {
    const r = parseLrc('[00:01.00]a\n[00:05.00]\n[00:09.00]b')
    expect(r.lines.length).toBe(3)
    expect(r.lines[1].text).toBe('')
  })

  it('行首不是时间标签的方括号不误判', () => {
    const r = parseLrc('[00:01.00]这句里有 [00:02.00] 字样')
    expect(r.lines.length).toBe(1)
    expect(r.lines[0].text).toBe('这句里有 [00:02.00] 字样')
  })

  it('空输入与 null 安全', () => {
    expect(parseLrc('').lines).toEqual([])
    expect(parseLrc(null).lines).toEqual([])
    expect(parseLrc(undefined).lines).toEqual([])
  })

  it('CRLF 与空行不影响解析', () => {
    const r = parseLrc('\r\n[00:01.00]a\r\n\r\n[00:02.00]b\r\n')
    expect(r.lines.length).toBe(2)
  })

  it('翻译按时间戳对齐合并', () => {
    const r = parseLyric('[00:01.00]hello\n[00:05.00]world', '[00:01.00]你好\n[00:05.00]世界')
    expect(r.hasTranslation).toBe(true)
    expect(r.lines[0].translation).toBe('你好')
    expect(r.lines[1].translation).toBe('世界')
  })

  it('翻译时间戳偏差在容差内仍能对上', () => {
    const r = parseLyric('[00:10.00]hello', '[00:10.20]你好')
    expect(r.lines[0].translation).toBe('你好')
  })

  it('翻译时间戳偏差过大时宁可丢弃，也不硬塞错位翻译', () => {
    const r = parseLyric('[00:10.00]hello', '[00:30.00]完全对不上')
    expect(r.lines[0].translation).toBeUndefined()
    expect(r.hasTranslation).toBe(false)
  })

  it('翻译行数少于原文时，只有匹配上的才有翻译', () => {
    const r = parseLyric('[00:01.00]a\n[00:05.00]b\n[00:09.00]c', '[00:05.00]B')
    expect(r.lines[0].translation).toBeUndefined()
    expect(r.lines[1].translation).toBe('B')
    expect(r.lines[2].translation).toBeUndefined()
  })

  it('没有翻译歌词时 hasTranslation 为 false', () => {
    expect(parseLyric('[00:01.00]a').hasTranslation).toBe(false)
    expect(parseLyric('[00:01.00]a', '').hasTranslation).toBe(false)
  })

  it('findLineIndex 二分定位当前行', () => {
    const { lines } = parseLrc('[00:01.00]a\n[00:05.00]b\n[00:09.00]c')
    expect(findLineIndex(lines, 0)).toBe(-1)     // 前奏
    expect(findLineIndex(lines, 1)).toBe(0)
    expect(findLineIndex(lines, 4.99)).toBe(0)
    expect(findLineIndex(lines, 5)).toBe(1)
    expect(findLineIndex(lines, 100)).toBe(2)    // 最后一行一直保持
  })

  it('findLineIndex 对空歌词安全', () => {
    expect(findLineIndex([], 10)).toBe(-1)
  })

  it('mergeTranslation 不改动原数组引用以外的东西，且幂等', () => {
    const base = parseLrc('[00:01.00]a')
    const once = mergeTranslation(base, '[00:01.00]A')
    const twice = mergeTranslation(once, '[00:01.00]A')
    expect(once.lines[0].translation).toBe('A')
    expect(twice.lines[0].translation).toBe('A')
  })
})
