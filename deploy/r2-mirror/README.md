# R2 下载镜像

lain42.top 主站的下载目录是源；这里是一层 Cloudflare R2 边缘镜像，
给下载器断点续传和海外用户提速用。

## 链路

- 桶：`lyco-music-dl`（公开不开放 r2.dev；通过下面的 worker 只读访问）
- Worker：`lyco-music-dl` → https://lyco-music-dl.m15178682641.workers.dev
  - GET/HEAD `/<key>` 即取桶内对象（key 如 `lyco_music/v0.2.0-xxx/Lyco.Music-...apk`）
  - `/health` 健康检查
  - Range 请求支持（断点续传）；安装包缓存 1 天、manifest/SHA256SUMS 缓存 60 秒

## 手动上传一个版本

```bash
npx wrangler r2 object put "lyco-music-dl/lyco_music/<tag>/<file>" --file <local-file> --remote
```

## 自定义域（可选）

在 Cloudflare Dashboard → Workers → lyco-music-dl → Domains 添加
`dl2.lilyco42.top` 之类的域即可。`dl.lilyco42.top` 已被其它项目占用，
不要动。

## 为什么不绑 r2.dev

r2.dev 公开访问未开启（TLS 直接断），且 OAuth token 缺 k2 权限去开；
worker 方案权限刚好够，还能加缓存策略和 CORS。


## 自动镜像

在 GitHub 仓库 Settings → Secrets 里加：

| Secret | 值 |
|---|---|
| `R2_ACCESS_KEY_ID` | R2 API Token 的 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token 的 Secret Access Key |
| `R2_ACCOUNT_ID` | 可省略，默认 `b34633d3c44c7b0d09ee26336a45ecd4` |
| `R2_BUCKET` | 可省略，默认 `lyco-music-dl` |

配好后 `release.yml` 的 **Mirror to Cloudflare R2** 步骤会自动把本轮产物 +
服务器上算好的 SHA256SUMS.txt 一起推进桶里；没配则自动跳过，主源仍走 lain42.top。

R2 的 API Token 在 Cloudflare Dashboard → R2 → Manage R2 API Tokens 创建，
权限选 Object Read & Write、只限 `lyco-music-dl` 桶。

没配 secret 时也可以在本地兜底镜像（走 wrangler 的 OAuth）：

```bash
python scripts/mirror-r2.py v0.2.1-20261016
```

## 下载页的镜像字段

`scripts/publish-downloads.py` 会给每个 lyco-music 条目写入 `r2Mirror`
字段（主站直链仍是 `url`/`mirror.url`），下载器可以按需回退。
