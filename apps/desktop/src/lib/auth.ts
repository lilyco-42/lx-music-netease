/**
 * lain42 Studio Billing account sessions.
 * Account JWTs and Lyco Music source-subscription tokens are separate credentials.
 */
import { computed, ref } from 'vue'

const API = 'https://lain42.top/studio/api'

interface AccountEntitlement {
  product: string
  status: string
  expires_at?: string | null
}
interface AccountProfile {
  username: string
  account_id: number
  founder: boolean
  entitlements: AccountEntitlement[]
  points?: unknown
}
interface SessionResponse {
  ok: boolean
  token?: string
  detail?: string
}
interface NativeAuth {
  save: (token: string) => Promise<boolean>
  load: () => Promise<string>
  clear: () => Promise<boolean>
}
interface NativeBridge {
  auth?: NativeAuth
  request?: (options: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
  }) => Promise<{ statusCode: number; body: string }>
  openExternal?: (url: string) => Promise<boolean>
}

function native(): NativeBridge | undefined {
  return (globalThis as unknown as { lxmnNative?: NativeBridge }).lxmnNative
}

let accessToken = ''
let initialized = false
const profile = ref<AccountProfile | null>(null)
const busy = ref(false)
const error = ref('')
const rememberOnDevice = ref(false)

async function request<T>(method: 'GET' | 'POST', path: '/login' | '/register' | '/me', data?: unknown, token?: string): Promise<T> {
  const url = API + path
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (data !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = 'Bearer ' + token
  let code: number
  let body: string
  if (native()?.request) {
    const result = await native()!.request!({ url, method, headers, body: data === undefined ? undefined : JSON.stringify(data) })
    code = result.statusCode
    body = result.body
  } else {
    const response = await fetch(url, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) })
    code = response.status
    body = await response.text()
  }
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(body) as Record<string, unknown> }
  catch { throw new Error('账户服务响应异常（HTTP ' + code + '）') }
  if (code < 200 || code >= 300) {
    const message = parsed.detail
    throw new Error(typeof message === 'string' ? message : '账户请求失败（HTTP ' + code + '）')
  }
  return parsed as T
}

async function restore(): Promise<void> {
  if (initialized) return
  initialized = true
  try {
    const token = await native()?.auth?.load()
    if (!token) return
    const account = await request<AccountProfile>('GET', '/me', undefined, token)
    accessToken = token
    profile.value = account
    rememberOnDevice.value = true
  } catch (e) {
    // Network trouble should not delete encrypted credentials. Invalid or expired
    // sessions are simply treated as logged out until the user logs in again.
    error.value = e instanceof Error ? e.message : '无法连接账户服务器'
    profile.value = null
  }
}

async function signIn(username: string, password: string): Promise<boolean> {
  if (!username.trim() || !password) { error.value = '请输入用户名和密码'; return false }
  busy.value = true
  error.value = ''
  try {
    const data = await request<SessionResponse>('POST', '/login', { username: username.trim(), password })
    if (!data.token) throw new Error('服务器没有返回登录会话')
    // A successful /me response is required before trusting a login result.
    const account = await request<AccountProfile>('GET', '/me', undefined, data.token)
    accessToken = data.token
    profile.value = account
    try {
      rememberOnDevice.value = (await native()?.auth?.save(data.token)) === true
    } catch {
      // The OS keychain may be locked or unavailable; keep only the in-memory session.
      rememberOnDevice.value = false
    }
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
    return false
  } finally { busy.value = false }
}

async function signOut(): Promise<void> {
  accessToken = ''
  profile.value = null
  rememberOnDevice.value = false
  error.value = ''
  await native()?.auth?.clear()
}

function openRegistration(): void {
  const url = 'https://lain42.top/account/'
  if (native()?.openExternal) void native()!.openExternal!(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

const signedIn = computed(() => !!profile.value && !!accessToken)
const vip = computed(() => profile.value?.entitlements?.some(e =>
  e.product === 'music_annual' && e.status === 'active' &&
  (!e.expires_at || (Number.isFinite(Date.parse(e.expires_at)) && Date.parse(e.expires_at) > Date.now()))
) ?? false)

export function useAccount() {
  return { profile, busy, error, signedIn, vip, rememberOnDevice, restore, signIn, signOut, openRegistration }
}
