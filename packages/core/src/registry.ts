import type { PlatformAdapter } from './platform'

let current: PlatformAdapter | null = null

/**
 * 注册平台适配器。
 * 桌面端在启动时注册 desktop 实现；移动端在 app.ts 注册 mobile 实现。
 */
export function setPlatform(adapter: PlatformAdapter): void {
  current = adapter
}

/** 获取当前平台适配器，未注册时抛出明确错误 */
export function getPlatform(): PlatformAdapter {
  if (!current) {
    throw new Error(
      '[lxmn/core] Platform adapter not registered. ' +
      'Call setPlatform() at app startup (see @lxmn/core/platform-desktop or platform-mobile).',
    )
  }
  return current
}

export function hasPlatform(): boolean {
  return current !== null
}
