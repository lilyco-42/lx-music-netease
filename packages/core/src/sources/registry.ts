/**
 * 音源注册表 —— 对应原 lx-music 的
 *   src/renderer/utils/musicSdk/index.js 与 api-source.js
 *
 * 原实现的问题：api-source.js 直接 import `@renderer/store` 的 apiSource / userApi，
 * 于是音源逻辑与渲染层状态管理硬耦合，移动端无法复用。
 *
 * 这里把「用哪个接口实现」变成显式注入，音源本身不再知道 UI / store 的存在。
 */
import type { MusicSource, SourceId, Quality } from '../types'

export type SourceRegistry = Partial<Record<SourceId, MusicSource>>

const registry: SourceRegistry = {}

/** 注册一个音源实现（内置或用户自定义） */
export function registerSource(id: SourceId, source: MusicSource): void {
  registry[id] = source
}

export function getSource(id: SourceId): MusicSource {
  const source = registry[id]
  if (!source) throw new Error(`[lxmn/core] Source not registered: ${id}`)
  return source
}

export function hasSource(id: SourceId): boolean {
  return Boolean(registry[id])
}

export function listSources(): SourceId[] {
  return Object.keys(registry) as SourceId[]
}

/**
 * 每个音源支持哪些音质 —— 对应原 api-source-info.ts 的 supportQualitys，
 * 但改为由音源实现自行声明，避免额外维护一张表。
 */
const supportQuality: Partial<Record<SourceId, Quality[]>> = {}

export function setSupportQuality(id: SourceId, qualities: Quality[]): void {
  supportQuality[id] = qualities
}

export function getSupportQuality(id: SourceId): Quality[] {
  return supportQuality[id] ?? []
}

/** 清空注册表（测试用） */
export function resetSources(): void {
  for (const k of Object.keys(registry)) delete registry[k as SourceId]
  for (const k of Object.keys(supportQuality)) delete supportQuality[k as SourceId]
}
