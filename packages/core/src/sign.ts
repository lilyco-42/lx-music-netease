import { getPlatform } from './registry'
import type { Quality } from './types'

/** MD5（平台实现） */
export const toMD5 = (s: string): string => getPlatform().crypto.md5(s)

/** lx-music 的标识头，桌面/移动共用同一值 */
export const bHh = '624868746c'

export const buildHeaders = (extra?: Record<string, string>): Record<string, string> => ({
  'User-Agent': 'lx-music request',
  [bHh]: bHh,
  ...extra,
})

export const timeout = 15000

/** 音质排序：从高到低，用于降级回退 */
export const qualityOrder: Quality[] = ['master', 'atmos', 'hires', 'flac24bit', 'flac', '320k', '128k']

/** 按可用性挑选最佳音质 */
export function pickBestQuality(
  wanted: Quality,
  available: Partial<Record<Quality, unknown>>,
): Quality | null {
  const start = qualityOrder.indexOf(wanted)
  if (start === -1) return null
  for (let i = start; i < qualityOrder.length; i++) {
    const q = qualityOrder[i]
    if (q && available[q]) return q
  }
  return null
}

/** 格式化歌手名 */
export function formatSingerName(singers: unknown, nameKey = 'name', join = '、'): string {
  const { codec } = getPlatform()
  if (Array.isArray(singers)) {
    const out: string[] = []
    for (const item of singers) {
      const name = item && typeof item === 'object'
        ? (item as Record<string, unknown>)[nameKey]
        : undefined
      if (typeof name === 'string' && name) out.push(name)
    }
    return codec.decodeName(out.join(join))
  }
  return codec.decodeName(String(singers ?? ''))
}
