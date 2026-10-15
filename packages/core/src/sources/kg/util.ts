/**
 * kg（酷狗）辅助函数。
 *
 * 和酷我不同，酷狗的 Singers 是**结构化数组**（[{name,id},...]）而不是
 * 一个用 '&' 分隔的字符串，所以要单独拼。上游 formatSingerName 还兼容
 * 纯字符串形态，这里同样两种都吃。
 */

/** 秒 -> mm:ss（与 kw/wy 保持同一实现） */
export function formatPlayTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 字节数 -> "11.9MB"（搜索结果里 FileSize 是字节） */
export function sizeFormate(bytes: number): string | null {
  if (!bytes || bytes <= 0) return null
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
}

/**
 * 歌手名：酷狗两种形态都出现过 ——
 *   数组  [{name:'周杰伦',id:...},{name:'费玉清',id:...}]
 *   字符串 '周杰伦、费玉清' / '周杰伦&费玉清'
 * 统一成中文顿号分隔。
 */
export function formatSinger(raw: unknown): string {
  if (Array.isArray(raw)) {
    const names = raw
      .map(s => (s && typeof s === 'object' ? (s as { name?: unknown }).name : s))
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
    return names.join('、')
  }
  if (typeof raw === 'string') return raw.replace(/&/g, '、')
  return ''
}

/**
 * 酷狗部分字段会带 HTML 实体（如 &nbsp;、&amp;）—— 上游用 decodeName 处理。
 * 这里只处理最常见的几个，避免引入完整 HTML 解码。
 */
export function decodeName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
