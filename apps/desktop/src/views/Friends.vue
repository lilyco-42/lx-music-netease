<script setup lang="ts">
/**
 * 好友页 —— 加好友 / 处理请求 / 看谁在线。
 *
 * 身份即订阅：没开会员时整个页面引导去开通，而不是报错 ——
 * 和云同步页一个套路，用户不用理解「令牌」是什么。
 */
import { onMounted, ref } from 'vue'
import { useFriends } from '../lib/friends'

const { me, friends, pendingIn, pendingOut, busy, error, refresh, addByCode, accept, decline, remove, rename } = useFriends()

const codeInput = ref('')
const nickInput = ref('')
const editingNick = ref(false)

onMounted(() => { void refresh() })

async function submitAdd() {
  if (!codeInput.value.trim()) return
  try {
    await addByCode(codeInput.value)
    codeInput.value = ''
  } catch { /* error 已在 lib 里置好，界面展示 */ }
}

async function saveNick() {
  const n = nickInput.value.trim()
  if (!n) return
  try {
    await rename(n)
    editingNick.value = false
  } catch { /* 同上 */ }
}

async function copyCode(): Promise<void> {
  if (me.value) await navigator.clipboard.writeText(me.value.friendCode)
}

function fmtTime(t: number): string {
  if (!t) return '—'
  const d = new Date(t * 1000)
  return d.getMonth() + 1 + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
</script>

<template>
  <div class="mx-auto w-full max-w-[980px] px-8 py-6">
    <h1 class="text-[26px] font-bold text-ncm-fg">好友</h1>

    <!-- 未开通会员：引导去会员页 -->
    <div v-if="!me && !busy" class="mt-10 flex flex-col items-center rounded-nav bg-ncm-surface p-10">
      <img src="/art/avatar-default.jpg" alt="" class="w-[120px] rounded-full opacity-90" />
      <p class="mt-5 text-[16px] text-ncm-fg">好友功能需要音乐会员</p>
      <p class="mt-2 text-[14px] text-ncm-faint">开通后用好友码加好友，同步歌单、看在线状态</p>
      <RouterLink
        to="/membership"
        class="mt-5 rounded-pill bg-ncm-accent px-6 py-2.5 text-[15px] text-white transition-opacity hover:opacity-90"
      >去开通</RouterLink>
    </div>

    <template v-else-if="me">
      <!-- 我的身份卡 -->
      <div class="mt-5 flex items-center gap-5 rounded-nav bg-ncm-surface p-5">
        <img src="/art/avatar-default.jpg" alt="" class="size-[64px] rounded-full" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-3">
            <span class="truncate text-[18px] font-semibold text-ncm-fg">{{ me.nickname }}</span>
            <span class="rounded-full bg-ncm-accent/10 px-2.5 py-0.5 text-[12px] text-ncm-accent">{{ me.online ? '在线' : '离线' }}</span>
          </div>
          <div class="mt-1.5 flex items-center gap-2">
            <span class="text-[13px] text-ncm-faint">好友码</span>
            <code class="rounded bg-ncm-bg px-2 py-0.5 font-mono text-[15px] tracking-widest text-ncm-fg">{{ me.friendCode }}</code>
            <button
              type="button"
              class="text-[13px] text-ncm-accent hover:underline"
              @click="() => { void copyCode() }"
            >复制</button>
          </div>
        </div>
        <button
          type="button"
          class="rounded-pill border border-ncm-divider px-4 py-1.5 text-[13px] text-ncm-muted hover:bg-black/5"
          @click="editingNick = !editingNick"
        >改昵称</button>
      </div>

      <div v-if="editingNick" class="mt-3 flex gap-2">
        <input
          v-model="nickInput"
          maxlength="20"
          placeholder="新的昵称"
          class="w-[240px] rounded-search border border-ncm-divider bg-ncm-bg px-4 py-2 text-[14px] text-ncm-fg outline-none focus:border-ncm-accent"
        />
        <button class="rounded-pill bg-ncm-accent px-4 py-2 text-[13px] text-white" @click="saveNick">保存</button>
      </div>

      <!-- 加好友 -->
      <div class="mt-5 rounded-nav bg-ncm-surface p-5">
        <p class="text-[15px] font-semibold text-ncm-fg">添加好友</p>
        <div class="mt-3 flex gap-2">
          <input
            v-model="codeInput"
            maxlength="8"
            placeholder="输入对方的好友码（8 位）"
            class="flex-1 rounded-search border border-ncm-divider bg-ncm-bg px-4 py-2.5 font-mono text-[15px] tracking-widest text-ncm-fg uppercase outline-none focus:border-ncm-accent"
            @keyup.enter="submitAdd"
          />
          <button
            class="rounded-pill bg-ncm-accent px-6 py-2.5 text-[14px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            :disabled="busy || !codeInput.trim()"
            @click="submitAdd"
          >发送请求</button>
        </div>
        <p v-if="error" class="mt-2 text-[13px] text-ncm-accent">{{ error }}</p>
      </div>

      <!-- 收到的请求 -->
      <section v-if="pendingIn.length" class="mt-5">
        <h2 class="text-[16px] font-semibold text-ncm-fg">收到的请求（{{ pendingIn.length }}）</h2>
        <ul class="mt-3 flex flex-col gap-2">
          <li
            v-for="p in pendingIn"
            :key="p.id"
            class="flex items-center gap-4 rounded-nav bg-ncm-surface p-4"
          >
            <img src="/art/avatar-default.jpg" alt="" class="size-[44px] rounded-full" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] text-ncm-fg">{{ p.nickname }}</div>
              <div class="text-[12px] text-ncm-faint">{{ p.friendCode }} · {{ fmtTime(p.createdAt) }}</div>
            </div>
            <button class="rounded-pill bg-ncm-accent px-4 py-1.5 text-[13px] text-white" @click="() => { void accept(p.id) }">接受</button>
            <button class="rounded-pill border border-ncm-divider px-4 py-1.5 text-[13px] text-ncm-muted hover:bg-black/5" @click="() => { void decline(p.id) }">拒绝</button>
          </li>
        </ul>
      </section>

      <p v-if="pendingOut.length" class="mt-3 text-[13px] text-ncm-faint">
        已发送 {{ pendingOut.length }} 个请求等待对方处理
      </p>

      <!-- 好友列表 -->
      <section class="mt-5">
        <h2 class="text-[16px] font-semibold text-ncm-fg">我的好友（{{ friends.length }}）</h2>
        <p v-if="!friends.length" class="mt-3 text-[14px] text-ncm-faint">
          还没有好友。把你的好友码发给朋友，让他们来加你。
        </p>
        <ul v-else class="mt-3 flex flex-col gap-2">
          <li
            v-for="f in friends"
            :key="f.friendCode"
            class="group flex items-center gap-4 rounded-nav bg-ncm-surface p-4"
          >
            <div class="relative">
              <img src="/art/avatar-default.jpg" alt="" class="size-[44px] rounded-full" />
              <span
                class="absolute bottom-0 right-0 size-[11px] rounded-full border-2 border-ncm-surface"
                :class="f.online ? 'bg-green-500' : 'bg-ncm-fainter'"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] text-ncm-fg">{{ f.nickname }}</div>
              <div class="text-[12px] text-ncm-faint">{{ f.online ? '在线' : '最近活跃 ' + fmtTime(f.lastActiveAt) }}</div>
            </div>
            <button
              type="button"
              class="rounded-pill border border-ncm-divider px-4 py-1.5 text-[13px] text-ncm-muted opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100"
              @click="() => { void remove(f.friendCode) }"
            >删除</button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
