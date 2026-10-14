<script setup lang="ts">
/**
 * 底部播放条 —— 实测规格：
 * 高 102px，背景 #FBFCFE，贴顶进度条高 3~4px 全宽
 * 左侧歌名/歌手左边距 50px；中央控制区中心 x=960；播放按钮 52x52 圆形
 * 右侧从 x≈1642 起：音质 / 词 / 音量 / 更多
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const playing = ref(true)
const progress = ref(60) // 实测约 60%
const volume = ref(70)

const progressStyle = computed(() => ({ width: `${progress.value}%` }))
</script>

<template>
  <footer class="relative flex items-center bg-ncm-bottombar">
    <!-- 进度条：贴顶，高 4px，全宽 -->
    <div class="absolute inset-x-0 top-0 h-[4px] bg-ncm-divider">
      <div class="h-full bg-ncm-progress" :style="progressStyle" />
    </div>

    <!-- 左侧歌曲信息：左边距 50px -->
    <div class="flex w-[430px] shrink-0 items-center gap-4 pl-[50px]">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-[18px] text-ncm-fg">나만 바라봐</span>
          <span class="shrink-0 rounded-[3px] border border-ncm-accent px-1 text-[10px] leading-4 text-ncm-accent">VIP</span>
          <span class="shrink-0 rounded-[3px] border border-ncm-faint px-1 text-[10px] leading-4 text-ncm-faint">试听</span>
        </div>
        <div class="mt-[7px] text-[17px] text-ncm-faint">TAEYANG</div>
      </div>

      <!-- 爱心 + 计数，评论 + 计数 -->
      <div class="flex shrink-0 items-center gap-3 text-ncm-faint">
        <span class="flex items-center gap-1">
          <svg viewBox="0 0 24 24" class="size-[17px] stroke-current" fill="none" stroke-width="1.8">
            <path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20Z" />
          </svg>
          <span class="text-[12px]">100w+</span>
        </span>
        <span class="flex items-center gap-1">
          <svg viewBox="0 0 24 24" class="size-[17px] stroke-current" fill="none" stroke-width="1.8">
            <path d="M21 12a8 8 0 1 1-3.2-6.4M21 4v5h-5" stroke-linecap="round" />
          </svg>
          <span class="text-[12px]">1w+</span>
        </span>
      </div>
    </div>

    <!-- 中央控制区 -->
    <div class="flex flex-1 items-center justify-center gap-[31px]">
      <!-- 循环模式 -->
      <button type="button" class="text-ncm-faint hover:text-ncm-fg" aria-label="循环模式">
        <svg viewBox="0 0 24 24" class="size-[22px] stroke-current" fill="none" stroke-width="1.8">
          <path d="M17 2l4 4-4 4M7 22l-4-4 4-4M21 6H7a4 4 0 0 0-4 4M3 18h14a4 4 0 0 0 4-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- 上一首 -->
      <button type="button" class="text-ncm-fg/80 hover:text-ncm-fg" aria-label="上一首">
        <svg viewBox="0 0 24 24" class="size-[26px] fill-current"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
      </button>

      <!-- 播放/暂停：52x52 圆形，白色三角 -->
      <button
        type="button"
        class="flex size-[52px] items-center justify-center rounded-full bg-ncm-accent-play text-white transition-transform hover:scale-105"
        :aria-label="playing ? '暂停' : '播放'"
        @click="playing = !playing"
      >
        <svg v-if="playing" viewBox="0 0 24 24" class="size-6 fill-current"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
        <svg v-else viewBox="0 0 24 24" class="size-6 fill-current"><path d="M8 5v14l11-7z" /></svg>
      </button>

      <!-- 下一首 -->
      <button type="button" class="text-ncm-fg/80 hover:text-ncm-fg" aria-label="下一首">
        <svg viewBox="0 0 24 24" class="size-[26px] fill-current"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
      </button>

      <!-- 播放列表 -->
      <button type="button" class="text-ncm-faint hover:text-ncm-fg" aria-label="播放列表">
        <svg viewBox="0 0 24 24" class="size-[22px] stroke-current" fill="none" stroke-width="1.8">
          <path d="M4 6h11M4 12h11M4 18h7M19 10v8M19 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- 右侧工具区：从 x≈1642 起 -->
    <div class="flex w-[430px] shrink-0 items-center justify-end gap-[29px] pr-[49px] text-ncm-faint">
      <span class="text-[14px] text-ncm-fg/70">极高</span>
      <button type="button" class="text-[15px] hover:text-ncm-fg" aria-label="音质">+</button>
      <button
        type="button"
        class="text-[15px] hover:text-ncm-fg"
        aria-label="歌词"
        @click="router.push({ name: 'player' })"
      >词</button>

      <!-- 音量 -->
      <div class="flex items-center gap-2">
        <svg viewBox="0 0 24 24" class="size-[19px] stroke-current" fill="none" stroke-width="1.8">
          <path d="M4 9v6h3l4 3V6L7 9H4ZM16 9a4 4 0 0 1 0 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <input v-model="volume" type="range" min="0" max="100" class="h-1 w-[70px] accent-ncm-accent-play" />
      </div>

      <button type="button" class="text-[18px] leading-none hover:text-ncm-fg" aria-label="更多">…</button>
    </div>
  </footer>
</template>
