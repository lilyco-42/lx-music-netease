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
