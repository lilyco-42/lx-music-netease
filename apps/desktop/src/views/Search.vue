<script setup lang="ts">
/**
 * 搜索结果页
 *
 * 这一页是「能真的听歌」的入口：TopBar 的搜索框回车 -> /search?q=xxx
 * -> 调内核的 musicSearch -> 点条目播放。
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePlayer } from '@/lib/player'
import type { MusicItem } from '@lxmn/core'

const route = useRoute()
const player = usePlayer()

const loading = ref(false)
const error = ref('')
const list = ref<MusicItem[]>([])
const total = ref(0)

const keyword = computed(() => String(route.query.q ?? '').trim())

async function run(): Promise<void> {
  list.value = []
  total.value = 0
  error.value = ''
  if (!keyword.value) return
  loading.value = true
  try {
    const r = await player.search(keyword.value, 1, 30)
    list.value = r.list
    total.value = r.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

watch(keyword, run, { immediate: true })

async function play(item: MusicItem): Promise<void> {
  await player.play(item, list.value)
}

function fmtDuration(v: unknown): string {
  return typeof v === 'string' && v ? v : '--:--'
}
</script>

<template>
  <div class="pt-2">
    <div class="mb-5 flex items-baseline gap-3">
      <h1 class="text-[26px] font-bold text-ncm-fg">搜索「{{ keyword }}」</h1>
      <span v-if="total" class="text-[14px] text-ncm-faint">共 {{ total }} 首</span>
    </div>

    <p v-if="loading" class="text-[15px] text-ncm-faint">搜索中…</p>
    <p v-else-if="error" class="text-[15px] text-ncm-accent">{{ error }}</p>
    <p v-else-if="!keyword" class="text-[15px] text-ncm-faint">在上方输入关键词后回车</p>
    <p v-else-if="!list.length" class="text-[15px] text-ncm-faint">没有找到相关歌曲</p>

    <ul v-else class="flex flex-col">
      <li
        v-for="(item, i) in list"
        :key="item.source + '-' + item.songmid"
        class="group flex h-[62px] cursor-pointer items-center gap-4 rounded-nav px-3 transition-colors hover:bg-black/5"
        @dblclick="play(item)"
      >
        <span class="w-6 shrink-0 text-center text-[15px] text-ncm-fainter">{{ i + 1 }}</span>

        <div class="relative size-[44px] shrink-0 overflow-hidden rounded-[5px] bg-ncm-fainter/30">
          <img v-if="item.picUrl" :src="String(item.picUrl)" alt="" class="size-full object-cover" loading="lazy" />
          <button
            type="button"
            class="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100"
            :aria-label="'播放 ' + item.name"
            @click.stop="play(item)"
          >
            <svg viewBox="0 0 24 24" class="size-4 fill-white"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <div class="truncate text-[16px] text-ncm-fg">{{ item.name }}</div>
          <div class="truncate text-[13px] text-ncm-faint">{{ item.singer }}</div>
        </div>

        <div class="hidden w-[240px] shrink-0 truncate text-[14px] text-ncm-faint md:block">
          {{ item.albumName }}
        </div>
        <div class="w-[60px] shrink-0 text-right text-[14px] text-ncm-fainter">
          {{ fmtDuration(item.interval) }}
        </div>
      </li>
    </ul>

    <p v-if="list.length" class="mt-4 text-[13px] text-ncm-fainter">
      双击播放。灰色不可播的曲目通常是版权方限制（VIP 专享 / 已下架）。
    </p>
  </div>
</template>
