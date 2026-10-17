<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { UserRound, LockKeyhole, ExternalLink, LogOut, ShieldCheck } from 'lucide-vue-next'
import { useAccount } from '@/lib/auth'

const account = useAccount()
const username = ref('')
const password = ref('')
onMounted(() => void account.restore())

async function login() {
  if (await account.signIn(username.value, password.value)) password.value = ''
}
</script>

<template>
  <section class="mx-auto max-w-[650px] py-8">
    <div class="mb-7 flex items-center gap-3">
      <UserRound :size="29" class="text-ncm-accent" />
      <div>
        <h1 class="text-[28px] font-bold text-ncm-fg">我的账户</h1>
        <p class="text-sm text-ncm-faint">使用 lain42.top 账号登录，同步识别真实购买权益。</p>
      </div>
    </div>

    <div v-if="account.signedIn.value && account.profile.value" class="rounded-2xl border border-ncm-divider bg-white p-7">
      <div class="flex items-center gap-3">
        <div class="flex size-12 items-center justify-center rounded-full bg-ncm-accent/10">
          <UserRound :size="24" class="text-ncm-accent" />
        </div>
        <div>
          <div class="text-lg font-semibold">{{ account.profile.value.username }}</div>
          <p class="text-sm text-ncm-faint">账户 ID：{{ account.profile.value.account_id }}</p>
        </div>
        <span v-if="account.vip.value" class="ml-auto rounded-full bg-ncm-accent px-3 py-1 text-xs text-white">音乐会员有效</span>
      </div>
      <p class="mt-6 text-sm text-ncm-muted">当前权益：{{ account.profile.value.entitlements?.length ?? 0 }} 项</p>
      <p class="mt-2 text-sm text-ncm-faint">{{ account.rememberOnDevice.value ? '账号已通过系统加密保存，下次启动自动验证。' : '本机无法加密保存登录信息；关闭软件后需重新登录。' }}</p>
      <p class="mt-2 text-sm text-ncm-faint">网站账号不等于音源订阅；已购买音乐会员可前往「音乐会员」页面激活订阅。</p>
      <button type="button" class="mt-6 flex items-center gap-2 rounded-full border border-ncm-divider px-5 py-2.5 text-ncm-muted hover:bg-ncm-bg" @click="account.signOut()">
        <LogOut :size="17" /> 退出登录
      </button>
    </div>

    <form v-else class="rounded-2xl border border-ncm-divider bg-white p-7 shadow-sm" @submit.prevent="login">
      <h2 class="text-xl font-semibold">登录网站账户</h2>
      <p class="mt-2 text-sm text-ncm-faint">与 lain42.top「我的账户」使用同一用户名和密码。</p>
      <label class="mt-6 block text-sm font-medium" for="account-username">用户名</label>
      <div class="mt-2 flex items-center gap-2 rounded-xl border border-ncm-divider px-4 focus-within:border-ncm-accent">
        <UserRound :size="18" class="text-ncm-faint" />
        <input id="account-username" v-model.trim="username" autocomplete="username" required maxlength="24"
               class="h-12 min-w-0 flex-1 bg-transparent outline-none" placeholder="lain42 用户名" />
      </div>
      <label class="mt-4 block text-sm font-medium" for="account-password">密码</label>
      <div class="mt-2 flex items-center gap-2 rounded-xl border border-ncm-divider px-4 focus-within:border-ncm-accent">
        <LockKeyhole :size="18" class="text-ncm-faint" />
        <input id="account-password" v-model="password" type="password" autocomplete="current-password" required
               class="h-12 min-w-0 flex-1 bg-transparent outline-none" placeholder="账户密码" />
      </div>
      <p v-if="account.error.value" role="alert" class="mt-4 text-sm text-ncm-accent">{{ account.error.value }}</p>
      <button type="submit" :disabled="account.busy.value"
              class="mt-6 w-full rounded-full bg-ncm-accent py-3 font-semibold text-white disabled:opacity-60">
        {{ account.busy.value ? '正在验证…' : '登录' }}
      </button>
      <button type="button" class="mt-4 flex items-center gap-2 text-sm text-ncm-muted hover:text-ncm-accent" @click="account.openRegistration()">
        <ExternalLink :size="16" /> 没有账号？去官网注册或找回密码
      </button>
      <p class="mt-5 flex items-center gap-2 text-xs text-ncm-faint">
        <ShieldCheck :size="16" /> 登录通过 HTTPS 验证，不在日志中保存密码。
      </p>
    </form>
  </section>
</template>
