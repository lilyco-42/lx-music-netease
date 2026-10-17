/**
 * Electron 主进程
 *
 * 只做外壳：加载 Vite 构建产物，保留 lx-music 上游的自定义音源能力
 * （渲染层可通过 preload 暴露的 API 读写本地文件 / 发起无 CORS 请求）。
 */
const { app, BrowserWindow, shell, ipcMain, net } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

const isDev = !app.isPackaged
/** 允许在开发时用环境变量指向 vite dev server */
const devUrl = process.env.LXMN_DEV_URL

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 670,
    backgroundColor: '#F4F6FB',
    title: 'Lyco Music',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev && devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // 外链走系统浏览器，不在应用内打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => { win = null })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/* ---------- 渲染层需要的原生能力 ---------- */

/**
 * 无 CORS 限制的请求：音乐源接口普遍不带 CORS 头，
 * 渲染层直接 fetch 会被浏览器拦；这里用主进程 net 代发。
 */
/** 只允许 http(s) 外链，避免 file:// 等本地协议被滥用 */
ipcMain.handle('lxmn:open-external', async (_e, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false
  await shell.openExternal(url)
  return true
})

ipcMain.handle('lxmn:request', async (_e, options) => {
  const res = await net.fetch(options.url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  })
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    statusCode: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: buf.toString('utf8'),
    raw: buf,
  }
})

/** 简易本地存储（用户数据目录下的 JSON），用于订阅链接等 */
const storePath = () => path.join(app.getPath('userData'), 'lxmn-store.json')

async function readStore() {
  try { return JSON.parse(await fs.readFile(storePath(), 'utf8')) } catch { return {} }
}

ipcMain.handle('lxmn:storage:get', async (_e, key) => (await readStore())[key] ?? null)
ipcMain.handle('lxmn:storage:set', async (_e, key, value) => {
  const s = await readStore()
  s[key] = value
  await fs.writeFile(storePath(), JSON.stringify(s), 'utf8')
})
ipcMain.handle('lxmn:storage:remove', async (_e, key) => {
  const s = await readStore()
  delete s[key]
  await fs.writeFile(storePath(), JSON.stringify(s), 'utf8')
})
ipcMain.handle('lxmn:storage:keys', async () => Object.keys(await readStore()))

ipcMain.handle('lxmn:app:info', async () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}))
