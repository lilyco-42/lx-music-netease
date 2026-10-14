<script setup lang="ts">
/**
 * 顶部工具栏 —— 实测规格：
 * 高 92~96px，背景与主内容同色（无分割线）
 * 返回按钮 34x44、圆角 11px
 * 搜索框 324x45、圆角 11px、渐变边框
 * 语音按钮 45x45
 */
import { ref } from 'vue'

const keyword = ref('')
</script>

<template>
  <header class="flex items-center gap-3 bg-ncm-topbar px-[49px]">
    <!-- 返回按钮 34x44 -->
    <button
      type="button"
      class="flex h-[44px] w-[34px] items-center justify-center rounded-search border border-ncm-divider text-ncm-fainter"
      aria-label="返回"
    >
      <svg viewBox="0 0 24 24" class="size-4 stroke-current" fill="none" stroke-width="2">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- 搜索框 324x45，渐变边框 -->
    <div
      class="flex h-[45px] w-[324px] items-center gap-2 rounded-search border px-3"
      style="
        border-color: #d7dff1;
        background: linear-gradient(#f4f6fc, #f4f6fc) padding-box,
                    linear-gradient(90deg, #d7dff1, #f1d7e4) border-box;
      "
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0 stroke-ncm-fainter" fill="none" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
      </svg>
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索音乐、MV、歌单、用户"
        class="w-full bg-transparent text-[18px] text-ncm-fg outline-none placeholder:text-ncm-fainter"
      />
    </div>

    <!-- 语音按钮 45x45 -->
    <button
      type="button"
      class="flex size-[45px] items-center justify-center rounded-search border border-[#f1d7e4] bg-[#fdf6f8] text-ncm-accent"
      aria-label="语音搜索"
    >
      <svg viewBox="0 0 24 24" class="size-[18px] stroke-current" fill="none" stroke-width="1.8">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke-linecap="round" />
      </svg>
    </button>

    <div class="flex-1" />

    <!-- 右侧：账号 + 窗口控制（实测从 x≈1358 起） -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="size-[30px] rounded-full bg-ncm-fainter/50" />
        <span class="text-[15px] text-ncm-fg">Lilyco42</span>
        <span class="rounded-[3px] border border-ncm-accent px-1 text-[10px] leading-4 text-ncm-accent">VIP</span>
      </div>

      <div class="flex items-center gap-2.5 text-ncm-faint">
        <span class="relative size-[18px] rounded-[3px] border-[1.5px] border-current">
          <span class="absolute -right-0.5 -top-0.5 size-[6px] rounded-full bg-ncm-accent" />
        </span>
        <span class="size-[18px] rounded-[3px] border-[1.5px] border-current" />
        <span class="size-[18px] rounded-[3px] border-[1.5px] border-current" />
      </div>

      <!-- 窗口控制：与背景融合，不做顶栏色块 -->
      <div class="ml-2 flex items-center text-ncm-faint">
        <button type="button" class="flex h-[44px] w-[46px] items-center justify-center hover:bg-black/5" aria-label="最小化">
          <svg viewBox="0 0 12 12" class="size-3 stroke-current" stroke-width="1.2"><path d="M2 6h8" /></svg>
        </button>
        <button type="button" class="flex h-[44px] w-[46px] items-center justify-center hover:bg-black/5" aria-label="最大化">
          <svg viewBox="0 0 12 12" class="size-3 stroke-current" fill="none" stroke-width="1.2"><rect x="2.5" y="2.5" width="7" height="7" /></svg>
        </button>
        <button type="button" class="flex h-[44px] w-[46px] items-center justify-center hover:bg-ncm-accent hover:text-white" aria-label="关闭">
          <svg viewBox="0 0 12 12" class="size-3 stroke-current" stroke-width="1.2"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      </div>
    </div>
  </header>
</template>
