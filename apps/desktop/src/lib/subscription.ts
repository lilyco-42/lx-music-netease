/**
 * 共享的订阅客户端单例
 *
 * membership.ts 与 sync.ts 都需要读同一个订阅令牌（同步复用会员身份），
 * 如果各自 new 一个 SubscriptionClient，虽然 storage key 相同、数据一致，
 * 但两个实例的 cache 互不可见，恢复时机不同就会读到空令牌。
 * 更糟的是让 sync.ts 去 import membership.ts 会形成循环依赖
 * （membership → sync → membership），ESM 下取到 undefined 是常见坑。
 * 所以把它单独放一层。
 */
import { SubscriptionClient } from '@lxmn/core'

export const subscription = new SubscriptionClient()
