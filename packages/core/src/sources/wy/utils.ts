/**
 * 网易云 eapi 请求封装 —— 移植自 lx-music-desktop
 *   src/renderer/utils/musicSdk/wy/utils/index.js
 *
 * 原文件依赖 ../../../request 的 httpFetch；这里改为通过 PlatformAdapter.http，
 * 于是同一份代码在 Electron(needle) 与 RN(fetch) 下都能跑。
 */
import { getPlatform } from '../../registry'
import { eapi } from './crypto'

const EAPI_BATCH_URL = 'http://interface.music.163.com/eapi/batch'

const EAPI_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'

export const eapiRequest = (url: string, data: unknown) =>
  getPlatform().http.request({
    url: EAPI_BATCH_URL,
    method: 'POST',
    headers: {
      'User-Agent': EAPI_UA,
      origin: 'https://music.163.com',
    },
    form: eapi(url, data),
  })

export { EAPI_BATCH_URL, EAPI_UA }
