/**
 * kw（酷我）辅助函数。
 *
 * 上游 util.js 里的 formatSinger 就是把 '&' 换成中文顿号 ——
 * 酷我用 '&' 分隔合唱歌手，直接显示会很怪。
 */
export const formatSinger = (raw: string): string => raw.replace(/&/g, '、')

/** 秒 -> mm:ss（与 wy 保持同一实现，上游也是同一个 formatPlayTime） */
export function formatPlayTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 字节数 -> "11.94MB"（酷我 N_MINFO 里给的是 "11.94Mb" 这种字符串，这里只做展示用换算） */
export function sizeFormate(bytes: number): string | null {
  if (!bytes || bytes <= 0) return null
  const mb = bytes / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
}
