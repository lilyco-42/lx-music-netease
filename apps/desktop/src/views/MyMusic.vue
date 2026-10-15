<script setup lang="ts">
/**
 * 我喜欢的音乐 / 最近播放（桌面端）
 *
 * 曲库是内核级的，桌面端与移动端读的是同一份数据 —— 在这里看到的就是
 * 同步过去的内容。
 */
import { computed, onMounted, ref } from 'vue'
import { usePlayer } from '@/lib/player'
import { useSync } from '@/lib/sync'
import { useSharing, type ShareTrack } from '@/lib/share'
import type { MusicItem, SourceId } from '@lxmn/core'

const { library, favorites, history, playlists } = useSync()
const player = usePlayer()
const { getShared } = useSharing()

const tab = ref<'fav' | 'recent'>('fav')

// —— 分享导入：好友页或手输分享码跳转过来时，sessionStorage 里带着码 ——
const importPrompt = ref<{ code: string; name: string; count: number } | null>(null)
const importBusy = ref(false)

onMounted(async () => {
  const code = sessionStorage.getItem('lyco-import-share')
  if (!code) return
  sessionStorage.removeItem('lyco-import-share')
  try {
    const s = await getShared(code)
    importPrompt.value = { code, name: s.name, count: s.trackCount }
  } catch { /* 分享失效就静默忽略，不打断页面 */ }
})

async function confirmImport(): Promise<void> {
  const pr = importPrompt.value
  if (!pr) return
  importBusy.value = true
  try {
    const s = await getShared(pr.code)
    const pl = await library.createPlaylist(s.name || '导入的歌单')
    for (const t of s.tracks) {
      await library.addToPlaylist(pl.id, { ...t, id: t.songmid, source: t.source as SourceId })
    }
    importPrompt.value = null
  } catch { /* 导入失败静默；歌单页会显示实际结果 */ } finally {
    importBusy.value = false
  }
}

function dismissImport(): void {
  importPrompt.value = null
}

/** 列表项：把 playedAt 显式提出来，模板里就不用做类型断言（vue-tsc 不接受模板中的 as） */
interface Row {
  item: MusicItem
  playedAt: number
}

const list = computed<Row[]>(() => {
  if (tab.value === 'fav') {
    return favorites.value.map(item => ({ item, playedAt: 0 }))
  }
  return history.value.map(h => ({ item: h, playedAt: h.playedAt }))
})

const plain = computed<MusicItem[]>(() => list.value.map(r => r.item))

function keyOf(i: MusicItem): string {
  return i.source + '-' + String(i.songmid)
}

async function play(item: MusicItem): Promise<void> {
  await player.play(item, plain.value)
}

async function unfav(item: MusicItem): Promise<void> {
  await library.removeFavorite(item)
}

async function addTo(playlistId: string, item: MusicItem): Promise<void> {
  await library.addToPlaylist(playlistId, item)
}

/** <select> 的 change 事件：把选中的歌单 id 取出来并复位 */
function onPick(item: MusicItem, e: Event): void {
  const el = e.target as HTMLSelectElement
  if (el.value) void addTo(el.value, item)
  el.value = ''
}

function fmtTime(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="pt-2">
    <h1 class="text-[30px] font-bold leading-10 text-ncm-fg">我的音乐</h1>

    <!-- 切换 -->
    <div class="mt-5 flex gap-2">
      <button
        type="button"
        class="rounded-pill px-5 py-2 text-[15px] transition-colors"
        :class="tab === 'fav' ? 'bg-ncm-accent text-white' : 'bg-white text-ncm-muted hover:bg-black/5'"
        @click="tab = 'fav'"
      >我喜欢的音乐 {{ favorites.length }}</button>
      <button
        type="button"
        class="rounded-pill px-5 py-2 text-[15px] transition-colors"
        :class="tab === 'recent' ? 'bg-ncm-accent text-white' : 'bg-white text-ncm-muted hover:bg-black/5'"
        @click="tab = 'recent'"
      >最近播放 {{ history.length }}</button>
    </div>

    <!-- 分享导入确认条 -->
    <div v-if="importPrompt" class="mt-4 flex items-center gap-3 rounded-nav border border-ncm-accent/30 bg-ncm-accent/5 p-4">
      <span class="flex-1 text-[14px] text-ncm-fg">
        导入歌单「<b class="font-semibold">{{ importPrompt.name }}</b>」（{{ importPrompt.count }} 首）？
      </span>
      <button class="rounded-pill bg-ncm-accent px-4 py-1.5 text-[13px] text-white disabled:opacity-50" :disabled="importBusy" @click="confirmImport">导入</button>
      <button class="rounded-pill border border-ncm-divider px-4 py-1.5 text-[13px] text-ncm-muted hover:bg-black/5" @click="dismissImport">取消</button>
    </div>

    <div v-if="!list.length" class="mt-10 flex flex-col items-center">
      <img
        :src="tab === 'fav' ? '/art/empty-favorites.jpg' : '/art/empty-history.jpg'"
        alt=""
        class="w-[180px] rounded-cover opacity-90"
        loading="lazy"
      />
      <p class="mt-4 text-[15px] text-ncm-faint">
        {{ tab === 'fav' ? '还没有收藏。在搜索页点右侧的心形即可收藏。' : '还没有播放记录。' }}
      </p>
    </div>

    <ul v-else class="mt-5 flex flex-col">
      <li
        v-for="(row, i) in list"
        :key="keyOf(row.item)"
        class="group flex h-[62px] cursor-pointer items-center gap-4 rounded-nav px-3 transition-colors hover:bg-black/5"
        @dblclick="play(row.item)"
      >
        <span class="w-6 shrink-0 text-center text-[15px] text-ncm-fainter">{{ i + 1 }}</span>

        <div class="relative size-[44px] shrink-0 overflow-hidden rounded-[5px] bg-ncm-fainter/30">
          <img
            v-if="row.item.picUrl"
            :src="String(row.item.picUrl)"
            alt=""
            class="size-full object-cover"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = '/art/cover-default.jpg'"
          />
          <img v-else src="/art/cover-default.jpg" alt="" class="size-full object-cover" loading="lazy" />
          <button
            type="button"
            class="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100"
            :aria-label="'播放 ' + row.item.name"
            @click.stop="play(row.item)"
          >
            <svg viewBox="0 0 24 24" class="size-4 fill-white"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <div class="truncate text-[16px] text-ncm-fg">{{ row.item.name }}</div>
          <div class="truncate text-[13px] text-ncm-faint">{{ row.item.singer }}</div>
        </div>

        <!-- 加进歌单 -->
        <select
          v-if="playlists.length"
          class="shrink-0 rounded-[6px] border border-ncm-divider bg-white px-2 py-1.5 text-[13px] text-ncm-muted outline-none"
          @click.stop
          @change="onPick(row.item, $event)"
        >
          <option value="">加入歌单…</option>
          <option v-for="pl in playlists" :key="pl.id" :value="pl.id">{{ pl.name }}</option>
        </select>

        <span v-if="tab === 'recent'" class="w-[92px] shrink-0 text-right text-[13px] text-ncm-fainter">
          {{ fmtTime(row.playedAt) }}
        </span>

        <button
          v-if="tab === 'fav'"
          type="button"
          class="shrink-0 rounded-full p-2 transition-colors hover:bg-black/5"
          aria-label="取消收藏"
          title="取消收藏"
          @click.stop="unfav(row.item)"
        >
          <svg viewBox="0 0 24 24" class="size-[18px] fill-ncm-accent">
            <path d="M12 21s-7.5-4.9-9.3-9.2C1.2 8.3 3.3 5 6.7 5c2 0 3.6 1.1 4.4 2.7l.9 1.7.9-1.7C13.7 6.1 15.3 5 17.3 5c3.4 0 5.5 3.3 4 6.8C19.5 16.1 12 21 12 21z" />
          </svg>
        </button>
      </li>
    </ul>

    <p v-if="list.length" class="mt-4 text-[13px] text-ncm-fainter">双击播放。</p>
  </div>
</template>
