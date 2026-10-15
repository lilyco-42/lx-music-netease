<script setup lang="ts">
/**
 * 云同步页（桌面端）
 *
 * 默认服务器就是 lain42.top —— 用户什么都不用填。
 * 会员用户直接点「用会员订阅开通」即可，同步令牌复用订阅令牌。
 * 也支持自建服务器（填地址 + 令牌）。
 */
import { onMounted, ref } from 'vue'
import { useSync } from '../lib/sync'
import { useMembership } from '../lib/membership'

const {
  favorites, playlists, history,
  configured, tokenMask, baseUrl, busy, error, lastSyncedAt, lastMessage, server,
  restore, connect, connectWithMembership, disconnect, syncNow,
} = useSync()

const { isActive } = useMembership()

const token = ref('')
const customBase = ref('')
const showCustom = ref(false)

function fmtTime(ms: number): string {
  if (!ms) return '从未'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function onConnect() {
  await connect(token.value, showCustom.value ? customBase.value : undefined)
  if (!error.value) token.value = ''
}

onMounted(restore)
</script>

<template>
  <div class="mx-auto max-w-[1000px] py-2">
    <h1 class="text-[30px] font-bold leading-40 text-ncm-fg">云同步</h1>
    <p class="mt-2 text-[15px] text-ncm-faint">
      收藏、歌单、播放记录在桌面端与移动端之间自动同步
    </p>

    <!-- 服务器信息 -->
    <section class="mt-7 rounded-banner border border-ncm-divider bg-white p-7">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-[19px] font-semibold text-ncm-fg">同步服务器</h2>
          <p class="mt-1.5 text-[14px] text-ncm-muted">{{ server }}</p>
        </div>
        <span
          class="rounded-pill px-3.5 py-1.5 text-[13px]"
          :class="configured ? 'bg-[#e8f6ec] text-[#2f7d47]' : 'bg-ncm-bg text-ncm-faint'"
        >{{ configured ? '已开通' : '未开通' }}</span>
      </div>

      <p class="mt-4 text-[13px] text-ncm-fainter">
        默认使用官方服务器，无需配置。会员身份即同步身份 —— 激活会员后自动开通。
      </p>

      <!-- 未开通：两种入口 -->
      <template v-if="!configured">
        <button
          v-if="isActive"
          type="button"
          class="mt-5 w-full rounded-pill bg-ncm-accent py-3.5 text-[17px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          :disabled="busy"
          @click="connectWithMembership"
        >用会员订阅一键开通</button>

        <div v-else class="mt-5 rounded-channel bg-ncm-bg p-4">
          <p class="text-[14px] text-ncm-muted">
            还没开通会员。同步使用会员令牌，请先到「音乐会员」页激活订阅链接。
          </p>
        </div>

        <button
          type="button"
          class="mt-3 text-[14px] text-ncm-fainter hover:text-ncm-accent"
          @click="showCustom = !showCustom"
        >{{ showCustom ? '收起自建服务器' : '使用自建同步服务器' }}</button>

        <template v-if="showCustom">
          <input
            v-model="customBase"
            type="text"
            :placeholder="'服务器地址，如 https://sync.example.com/studio'"
            class="mt-4 w-full rounded-search border border-ncm-divider bg-ncm-bg px-4 py-3.5 text-[15px] text-ncm-fg outline-none placeholder:text-ncm-fainter focus:border-ncm-accent"
          />
          <input
            v-model="token"
            type="text"
            placeholder="同步令牌"
            class="mt-3 w-full rounded-search border border-ncm-divider bg-ncm-bg px-4 py-3.5 text-[15px] text-ncm-fg outline-none placeholder:text-ncm-fainter focus:border-ncm-accent"
            @keyup.enter="onConnect"
          />
          <button
            type="button"
            class="mt-3 w-full rounded-pill border border-ncm-divider py-3 text-[16px] text-ncm-fg transition-colors hover:bg-black/5 disabled:opacity-60"
            :disabled="busy"
            @click="onConnect"
          >连接</button>
        </template>
      </template>

      <!-- 已开通 -->
      <template v-else>
        <div class="mt-5 flex items-center gap-6 rounded-channel bg-ncm-bg p-5">
          <div>
            <p class="text-[13px] text-ncm-faint">同步令牌</p>
            <p class="mt-1 font-mono text-[15px] text-ncm-fg">{{ tokenMask || '—' }}</p>
          </div>
          <div class="ml-auto text-right">
            <p class="text-[13px] text-ncm-faint">上次同步</p>
            <p class="mt-1 text-[15px] text-ncm-fg">{{ fmtTime(lastSyncedAt) }}</p>
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <button
            type="button"
            class="flex-1 rounded-pill bg-ncm-accent py-3 text-[16px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            :disabled="busy"
            @click="syncNow"
          >{{ busy ? '同步中…' : '立即同步' }}</button>
          <button
            type="button"
            class="rounded-pill border border-ncm-divider px-7 py-3 text-[16px] text-ncm-fg transition-colors hover:bg-black/5 disabled:opacity-60"
            :disabled="busy"
            @click="disconnect"
          >关闭同步</button>
        </div>
      </template>

      <p v-if="error" class="mt-3 text-[14px] text-ncm-accent">{{ error }}</p>
      <p v-else-if="lastMessage" class="mt-3 text-[14px] text-ncm-faint">{{ lastMessage }}</p>
    </section>

    <!-- 本地数据概览 -->
    <section class="mt-6 grid grid-cols-3 gap-4">
      <div class="rounded-channel border border-ncm-divider bg-white p-5">
        <p class="text-[26px] font-bold text-ncm-fg">{{ favorites.length }}</p>
        <p class="mt-1 text-[14px] text-ncm-faint">我喜欢的音乐</p>
      </div>
      <div class="rounded-channel border border-ncm-divider bg-white p-5">
        <p class="text-[26px] font-bold text-ncm-fg">{{ playlists.length }}</p>
        <p class="mt-1 text-[14px] text-ncm-faint">创建的歌单</p>
      </div>
      <div class="rounded-channel border border-ncm-divider bg-white p-5">
        <p class="text-[26px] font-bold text-ncm-fg">{{ history.length }}</p>
        <p class="mt-1 text-[14px] text-ncm-faint">最近播放</p>
      </div>
    </section>

    <!-- 说明：为什么不是「最后写入者胜出」 -->
    <section class="mt-6 rounded-channel border border-ncm-divider bg-white p-6">
      <h3 class="text-[16px] font-semibold text-ncm-fg">冲突是怎么处理的</h3>
      <ul class="mt-3 space-y-2">
        <li class="flex gap-3">
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-ncm-accent" />
          <span class="text-[14px] text-ncm-muted">收藏、歌单取并集 —— 任何一台设备上收藏过的歌都不会丢</span>
        </li>
        <li class="flex gap-3">
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-ncm-accent" />
          <span class="text-[14px] text-ncm-muted">播放次数取两边较大的值，不会因为同步而翻倍</span>
        </li>
        <li class="flex gap-3">
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-ncm-accent" />
          <span class="text-[14px] text-ncm-muted">歌单里歌曲的顺序以最近修改的那台设备为准，不重排</span>
        </li>
      </ul>
    </section>
  </div>
</template>
