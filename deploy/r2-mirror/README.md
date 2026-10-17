# R2 下载镜像

lain42.top 主站的下载目录是源；这里是一层 Cloudflare R2 边缘镜像，
给下载器断点续传和海外用户提速用。

## 链路

- 桶：`lyco-music-dl`（不开 r2.dev 公开访问；只通过下面的 worker 只读访问）
- Worker：`lyco-music-dl` → https://lyco-music-dl.m15178682641.workers.dev
  - `GET/HEAD /<key>` 取桶内对象（key 如 `lyco_music/v0.2.3-xxx/Lyco.Music-....apk`）
  - 目录式路径回落：`/` 与 `/downloads/` → 对应的 `index.html`
  - `GET /health` 健康检查（含 `upload` 是否已配置）
  - Range 请求支持（断点续传）；安装包缓存 1 天，页面/manifest 60 秒
- 下载页镜像：https://lyco-music-dl.m15178682641.workers.dev/downloads/

## 手动上传单个对象（本机 wrangler 已登录时）

```bash
npx wrangler r2 object put "lyco-music-dl/lyco_music/<tag>/<file>" --file <local-file> --remote
```

## 自定义域（可选）

在 Cloudflare Dashboard → Workers → lyco-music-dl → Domains 添加
`dl2.lilyco42.top` 之类的域即可。`dl.lilyco42.top` 已被其它项目占用，不要动。

## 为什么不绑 r2.dev

r2.dev 公开访问未开启（TLS 直接断），且 OAuth token 缺 k2 权限去开；
worker 方案权限刚好够，还能加缓存策略、CORS 和目录索引。

## 自动镜像（现在不需要任何 R2 S3 密钥）

CI 里不再用 `aws s3 cp`。原因：R2 的 S3 Access Key 必须先有一个 R2 API Token，
而 Cloudflare 的 OAuth 登录**建不出** API Token（`/user/tokens`、`/accounts/*/tokens`
都返回 403）。所以换了个方向 —— 让镜像 Worker 自己去 `lain42.top` 把文件拉进桶：

```
POST https://lyco-music-dl.m15178682641.workers.dev/__mirror
Authorization: Bearer <UPLOAD_TOKEN>
{"key": "lyco_music/v0.2.3-20261017/Lyco.Music-0.2.3-android-universal.apk",
 "src": "https://lain42.top/downloads/lyco_music/v0.2.3-20261017/Lyco.Music-0.2.3-android-universal.apk"}
→ {"ok": true, "key": "...", "size": 51477032, "etag": "..."}
```

- 几百 MB 的包在 Cloudflare 内部流转，CI 只发几十字节的 JSON，
  不会撞 Worker 的请求体大小限制
- `ALLOWED_SRC` 只放行 `https://lain42.top/downloads/` 与 `/assets/`，
  `ALLOWED_KEY_PREFIX` 只放行 `lyco_music/`、`downloads/`、`assets/` —— 不是开放代理
- 令牌用常量时间比较；没有 `UPLOAD_TOKEN` 时接口直接 503

需要两个地方存同一个令牌：

| 位置 | 名字 | 怎么设 |
|---|---|---|
| Worker secret | `UPLOAD_TOKEN` | `wrangler secret put UPLOAD_TOKEN` |
| 仓库 Secrets | `R2_UPLOAD_TOKEN` | 已通过 `gh secret set` 设置 |

可选：`R2_MIRROR_ENDPOINT` 覆盖默认域名。

发版时 `release.yml` 的 **Mirror to Cloudflare R2** 步骤会自动：

1. 把本轮产物（exe/msi/dmg/apk/ipa/AppImage/blockmap/yml/SHA256SUMS）逐個镜像
2. 顺带镜像下载页本身（`downloads/index.html`、`downloads/downloads.css`、
   `downloads/manifest.json`、`assets/studio.css`、`assets/studio.js`），
   页面上的「你在镜像站」说明条由 Worker 注入（幂等）

没配 `R2_UPLOAD_TOKEN` 时自动跳过，主源仍走 lain42.top，不会让发布失败。

## 本地兜底

本机已登录 wrangler（OAuth）时，也可以直接推（走 `wrangler r2 object put`）：

```bash
python scripts/mirror-r2.py v0.2.3-20261017          # 安装包
python scripts/mirror-downloads-page.py               # 下载页 + 静态资源
```

## 下载页的镜像字段

`scripts/publish-downloads.py` 会给每个 lyco-music 条目写入 `r2Mirror`
字段（主站直链仍是 `url`/`mirror.url`），下载器可以按需回退。
