/**
 * 会员 / 音源订阅。
 *
 * 流程：用户在 https://lain42.top/shop/ 购买「音乐会员 · 年卡」（88 元 / 年），
 * 拿到订阅链接 -> 粘进客户端 -> 一键补全全部第三方音源。
 */
import { SubscriptionClient, SHOP_URL, ANNUAL_PRICE_CNY } from '@lxmn/core'
import type { MembershipStatus } from '@lxmn/core'

const client = new SubscriptionClient()

/** 激活订阅：拉取 -> 校验 -> 应用音源 */
export async function activate(link: string): Promise<MembershipStatus> {
  const doc = await client.fetch(link)
  await client.apply(doc)
  return client.status()
}

/** 查询当前会员状态（离线可用） */
export async function status(): Promise<MembershipStatus> {
  return client.status()
}

/** 退出会员 / 换链接 */
export async function deactivate(): Promise<void> {
  await client.clear()
}

export { SHOP_URL, ANNUAL_PRICE_CNY }
