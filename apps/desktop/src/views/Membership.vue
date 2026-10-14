<script setup lang="ts">
/**
 * 会员页（桌面端）
 *
 * 购买 → 复制订阅链接 → 粘贴激活 → 一键补全全部第三方音源。
 * 全部走 @lxmn/core 的 SubscriptionClient，与移动端同一套协议。
 */
import { onMounted, ref } from 'vue'
import { useMembership } from '../lib/membership'

const { status, busy, error, applied, isActive, plan, sources, restore, activate, refresh, clear, openShop,
        SHOP_URL, ANNUAL_PRICE_CNY } = useMembership()

const link = ref('')

const FEATURES = [
  '一键补全全部第三方音源',
  '桌面端 / 移动端同一账号通用',
  '会员期内自动续期提醒',
  '音源失效后自动更新订阅',
]

function fmtDate(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function onActivate() {
  if (!link.value.trim()) {
    error.value = '请先粘贴订阅链接或令牌'
    return
  }
  await activate(link.value)
  if (isActive.value) link.value = ''
}

onMounted(restore)
</script>

<template>
  <div class="mx-auto max-w-[1000px] py-2">
    <h1 class="text-[30px] font-bold leading-10 text-ncm-fg">音乐会员</h1>
    <p class="mt-2 text-[15px] text-ncm-faint">购买后获得订阅链接，填入下方即可解锁全部音源</p>

    <div class="mt-7 grid grid-cols-[1fr_1fr] gap-6">
      <!-- 价格卡 -->
      <section class="rounded-banner border border-ncm-divider bg-white p-7">
        <div class="flex items-end">
          <span class="text-[52px] font-extrabold leading-[56px] text-ncm-accent">¥{{ ANNUAL_PRICE_CNY }}</span>
          <span class="mb-2 ml-2 text-[17px] text-ncm-faint">/ 年</span>
        </div>
        <h2 class="mt-3 text-[19px] font-semibold text-ncm-fg">音乐会员 · 年卡</h2>

        <ul class="mt-5 space-y-2.5">
          <li v-for="f in FEATURES" :key="f" class="flex items-center gap-3">
            <span class="size-1.5 shrink-0 rounded-full bg-ncm-accent" />
            <span class="text-[15px] text-ncm-muted">{{ f }}</span>
          </li>
        </ul>

        <button
          type="button"
          class="mt-7 w-full rounded-pill bg-ncm-accent py-3.5 text-[17px] font-semibold text-white transition-opacity hover:opacity-90"
          @click="openShop"
        >
          去商城购买
        </button>
        <p class="mt-3 text-center text-[12px] text-ncm-fainter">{{ SHOP_URL }}</p>
      </section>

      <!-- 激活卡 -->
      <section class="rounded-banner border border-ncm-divider bg-white p-7">
        <h2 class="text-[19px] font-semibold text-ncm-fg">激活订阅</h2>

        <input
          v-model="link"
          type="text"
          placeholder="粘贴订阅链接或令牌"
          class="mt-5 w-full rounded-search border border-ncm-divider bg-ncm-bg px-4 py-3.5 text-[15px] text-ncm-fg outline-none placeholder:text-ncm-fainter focus:border-ncm-accent"
          @keyup.enter="onActivate"
        />

        <div class="mt-3 flex gap-3">
          <button
            type="button"
            class="flex-1 rounded-pill bg-ncm-accent py-3 text-[16px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            :disabled="busy"
            @click="onActivate"
          >
            {{ busy ? '处理中…' : '激活' }}
          </button>
          <button
            type="button"
            class="rounded-pill border border-ncm-divider px-7 py-3 text-[16px] text-ncm-fg transition-colors hover:bg-black/5 disabled:opacity-60"
            :disabled="busy"
            @click="refresh"
          >
            查询
          </button>
        </div>

        <p v-if="error" class="mt-3 text-[14px] text-ncm-accent">{{ error }}</p>

        <!-- 状态 -->
        <div v-if="status.state === 'active'" class="mt-6 rounded-channel bg-ncm-bg p-5">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-[#4ec97a]" />
            <span class="text-[16px] font-semibold text-ncm-fg">会员有效</span>
          </div>
          <p class="mt-2 text-[15px] text-ncm-muted">{{ plan?.name }}</p>
          <p class="mt-1 text-[14px] text-ncm-faint">到期时间：{{ fmtDate(plan?.expiresAt ?? '') }}</p>

          <p class="mt-4 text-[14px] text-ncm-faint">已解锁音源（{{ sources.length }}）</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="s in sources"
              :key="s.id"
              class="rounded-[6px] bg-white px-2.5 py-1 text-[13px] text-ncm-fg"
            >{{ s.name || s.id }}</span>
          </div>
          <p v-if="applied.length" class="mt-3 text-[12px] text-ncm-fainter">
            本次已应用：{{ applied.join('、') }}
          </p>
          <button type="button" class="mt-4 text-[14px] text-ncm-fainter hover:text-ncm-accent" @click="clear">
            退出会员
          </button>
        </div>

        <div v-else-if="status.state === 'expired'" class="mt-6 rounded-channel bg-ncm-bg p-5">
          <p class="text-[16px] font-semibold text-ncm-accent">会员已过期</p>
          <p class="mt-1 text-[14px] text-ncm-faint">
            {{ status.plan.name }} · {{ fmtDate(status.plan.expiresAt) }}
          </p>
        </div>

        <div v-else-if="status.state === 'invalid'" class="mt-6 rounded-channel bg-ncm-bg p-5">
          <p class="text-[15px] text-ncm-accent">{{ status.reason }}</p>
        </div>

        <p v-else class="mt-6 text-[15px] text-ncm-faint">尚未激活会员</p>
      </section>
    </div>
  </div>
</template>
