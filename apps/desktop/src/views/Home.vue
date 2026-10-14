<script setup lang="ts">
/**
 * 首页「推荐」—— 实测规格：
 * 频道卡 7 张、207x266（比例 0.78）、间距 20px，整图背景 + 底部蒙层
 * 推荐歌单 1 行 9 列、封面 156x157、水平间距 19~20px、标题 2 行省略
 * 精选活动 4 张横幅、373x209、间距 24~25px
 * 区块纵向间距 38~47px
 */
const channels = [
  { title: '每日推荐', desc: '根据你的口味生成', tone: '#e57373' },
  { title: '私人漫游', desc: '无限漫游', tone: '#64b5f6', playing: true },
  { title: '私人雷达', desc: '为你精选', tone: '#9575cd' },
  { title: '嘻哈/说唱日推', desc: '每日更新', tone: '#4db6ac' },
  { title: '心情氛围歌单', desc: '此刻的心情', tone: '#ffb74d' },
  { title: '欧美流行日推', desc: '每日更新', tone: '#7986cb' },
  { title: '民谣日推', desc: '每日更新', tone: '#a1887f' },
]

// 9 列歌单，封面 156x157
const playlists = Array.from({ length: 9 }, (_, i) => ({
  id: i,
  title: ['华语流行精选', '轻音乐助眠', '深夜电台', '电子舞曲', '摇滚经典',
          '民谣故事', '古典名曲', '爵士夜曲', '影视原声'][i] ?? `歌单 ${i + 1}`,
  playCount: `${(Math.random() * 900 + 100).toFixed(0)}万`,
}))

const activities = Array.from({ length: 4 }, (_, i) => ({
  id: i,
  title: ['新歌抢先听', '会员福利社', '音乐人计划', '线下演出'][i] ?? `活动 ${i + 1}`,
}))
</script>

<template>
  <div class="pt-4">
    <!-- ============ 顶部精选频道：7 张，207x266 ============ -->
    <section class="relative">
      <div class="flex gap-5">
        <article
          v-for="ch in channels"
          :key="ch.title"
          class="group relative h-[266px] w-[207px] shrink-0 cursor-pointer overflow-hidden rounded-channel"
          :style="{ background: ch.tone }"
        >
          <!-- 整图背景的替代：色块 + 顶部标题 -->
          <div class="absolute inset-0 bg-gradient-to-b from-black/5 to-black/45" />

          <!-- 标题距左 13px -->
          <h3 class="absolute left-[13px] top-[13px] text-[21px] font-bold leading-tight text-white drop-shadow">
            {{ ch.title }}
          </h3>

          <!-- 底部蒙层 + 说明文字 -->
          <div class="absolute inset-x-0 bottom-0 px-[13px] pb-[13px]">
            <p class="text-[14px] leading-[22px] text-white/90">{{ ch.desc }}</p>
          </div>

          <!-- 免费听 小标签 -->
          <span class="absolute right-[10px] top-[10px] rounded-[3px] bg-white/85 px-1.5 text-[10px] leading-4 text-ncm-accent">
            免费听
          </span>

          <!-- 悬停播放三角 -->
          <div
            v-if="ch.playing"
            class="absolute bottom-[13px] right-[13px] flex size-[34px] items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" class="size-4 fill-ncm-accent-play"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </article>
      </div>

      <!-- 轮播箭头 -->
      <button type="button" class="absolute -left-4 top-1/2 -translate-y-1/2 text-[26px] text-[#b9bfca]" aria-label="上一组">‹</button>
      <button type="button" class="absolute -right-4 top-1/2 -translate-y-1/2 text-[26px] text-[#b9bfca]" aria-label="下一组">›</button>
    </section>

    <!-- ============ 推荐歌单：9 列，封面 156x157 ============ -->
    <section class="mt-[43px]">
      <div class="mb-[18px] flex items-center gap-2">
        <h2 class="text-[24px] font-bold leading-8 text-ncm-fg">推荐歌单</h2>
        <span class="text-[20px] leading-8 text-ncm-fainter">›</span>
        <div class="flex-1" />
        <button type="button" class="text-[15px] text-ncm-faint hover:text-ncm-accent" aria-label="刷新">↻</button>
      </div>

      <div class="flex gap-5">
        <article
          v-for="pl in playlists"
          :key="pl.id"
          class="group w-[157px] shrink-0 cursor-pointer"
        >
          <!-- 封面 156x157，圆角 7px -->
          <div class="relative h-[157px] w-[156px] overflow-hidden rounded-cover bg-ncm-fainter/40">
            <!-- 播放量：左上角，耳机图标 + 12px 白字 -->
            <div class="absolute left-2 top-2 flex items-center gap-1 text-white drop-shadow">
              <svg viewBox="0 0 24 24" class="size-3 fill-current">
                <path d="M12 3a8 8 0 0 0-8 8v6a2 2 0 0 0 2 2h2v-7H6v-1a6 6 0 1 1 12 0v1h-2v7h2a2 2 0 0 0 2-2v-6a8 8 0 0 0-8-8Z" />
              </svg>
              <span class="text-[12px]">{{ pl.playCount }}</span>
            </div>

            <div class="absolute bottom-2 right-2 flex size-[30px] items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
              <svg viewBox="0 0 24 24" class="size-3.5 fill-ncm-accent-play"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>

          <!-- 标题：最多 2 行，行高 22px -->
          <p class="mt-2 line-clamp-2 text-[15px] leading-[22px] text-ncm-fg">{{ pl.title }}</p>
        </article>
      </div>
    </section>

    <!-- ============ 精选活动：4 张，373x209 ============ -->
    <section class="mt-[43px]">
      <div class="mb-[18px] flex items-center gap-2">
        <h2 class="text-[24px] font-bold leading-8 text-ncm-fg">精选活动</h2>
        <span class="text-[20px] leading-8 text-ncm-fainter">›</span>
      </div>

      <div class="flex gap-[24px]">
        <article
          v-for="a in activities"
          :key="a.id"
          class="relative h-[209px] w-[373px] shrink-0 cursor-pointer overflow-hidden rounded-banner bg-gradient-to-br from-[#dbe3f5] to-[#f2dde6]"
        >
          <h3 class="absolute left-[18px] top-[16px] text-[20px] font-semibold text-ncm-fg">{{ a.title }}</h3>
        </article>
      </div>
    </section>
  </div>
</template>
