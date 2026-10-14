<script setup lang="ts">
/**
 * 左侧导航 —— 实测规格：
 * 宽 255px，背景 #EEF1F6
 * 导航项高 45~49px，选中项背景 #D13B50、圆角 10px、白字
 * 选中项左边距 30px、宽 206px
 * 分组小封面 40x40、圆角 4px、行高 57px
 */
import { ref } from 'vue'

const navMain = [
  { key: 'recommend', label: '推荐', icon: 'music' },
  { key: 'featured', label: '精选', icon: 'star' },
  { key: 'podcast', label: '播客', icon: 'mic' },
  { key: 'roam', label: '漫游', icon: 'compass' },
  { key: 'follow', label: '关注', icon: 'user', dot: true },
]

const navMine = [
  { key: 'like', label: '我喜欢的音乐', icon: 'heart' },
  { key: 'recent', label: '最近播放', icon: 'clock' },
  { key: 'download', label: '下载管理', icon: 'download' },
  { key: 'more', label: '更多', icon: 'more' },
]

// 实测：创建的歌单 13
const playlists = ref(
  Array.from({ length: 13 }, (_, i) => ({
    id: i,
    name: ['私人雷达', '每日推荐', '我喜欢的音乐', '华语流行', '轻音乐', '电子', '摇滚', '民谣',
           '古典', '爵士', '说唱', '影视原声', '深夜电台'][i] ?? `歌单 ${i + 1}`,
  })),
)

const active = ref('recommend')
</script>

<template>
  <aside class="flex h-full flex-col overflow-y-auto bg-ncm-sidebar">
    <!-- Logo 区：红色圆标直径 35px + 22px/600 文字 -->
    <div class="flex items-center gap-2.5 px-[30px] pt-[29px] pb-4">
      <div class="flex size-[35px] items-center justify-center rounded-full bg-ncm-accent">
        <svg viewBox="0 0 24 24" class="size-[19px] fill-white">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.2a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6Zm0 3.1a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z" />
        </svg>
      </div>
      <span class="text-[22px] font-semibold leading-[30px] text-ncm-fg">LX Music</span>
    </div>

    <!-- 主导航 -->
    <nav class="mt-[19px] flex flex-col">
      <button
        v-for="item in navMain"
        :key="item.key"
        type="button"
        class="relative mx-[30px] flex h-[45px] w-[206px] items-center gap-3 rounded-nav px-3.5 text-left text-[18px] leading-6 transition-colors"
        :class="active === item.key
          ? 'bg-ncm-accent-nav text-white'
          : 'text-ncm-muted hover:bg-black/5'"
        @click="active = item.key"
      >
        <span class="size-[18px] shrink-0 rounded-[3px] border-[1.5px] border-current opacity-80" />
        <span>{{ item.label }}</span>
        <span v-if="item.dot" class="absolute right-4 size-[7px] rounded-full bg-ncm-accent" />
      </button>
    </nav>

    <!-- 分隔线：实测 y≈375 -->
    <div class="mx-[30px] my-4 h-px bg-ncm-divider" />

    <!-- 我的 -->
    <div class="flex flex-col">
      <div class="px-[30px] pb-1 text-[14px] text-ncm-fainter">我的</div>
      <button
        v-for="item in navMine"
        :key="item.key"
        type="button"
        class="mx-[30px] flex h-[49px] w-[206px] items-center gap-3 rounded-nav px-3.5 text-left text-[17px] leading-6 text-ncm-muted transition-colors hover:bg-black/5"
      >
        <span class="size-[18px] shrink-0 rounded-[3px] border-[1.5px] border-current opacity-70" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <!-- 创建的歌单 -->
    <div class="mt-4 flex flex-col pb-6">
      <div class="px-[30px] pb-1 text-[14px] text-ncm-fainter">
        创建的歌单 <span class="ml-1">{{ playlists.length }}</span>
      </div>
      <!-- 行高 57px，封面 40x40 圆角 4px -->
      <button
        v-for="pl in playlists"
        :key="pl.id"
        type="button"
        class="mx-[30px] flex h-[57px] w-[206px] items-center gap-3 rounded-nav px-1.5 text-left transition-colors hover:bg-black/5"
      >
        <span class="size-[40px] shrink-0 rounded-[4px] bg-ncm-fainter/40" />
        <span class="truncate text-[15px] text-ncm-muted">{{ pl.name }}</span>
      </button>
    </div>
  </aside>
</template>
