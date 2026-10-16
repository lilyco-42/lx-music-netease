#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把下载页本身（HTML + 静态资源 + manifest）也镜像到 R2，并注入镜像站说明条。

安装包由 scripts/mirror-r2.py 或 CI 负责；这个脚本管的是「页面」：
让 https://<worker>/downloads/ 能直接从 Cloudflare 边缘打开，不必回源 lain42.top。

用法：
    python scripts/mirror-downloads-page.py

环境变量：
    LYCO_SSH_KEY / LYCO_SSH_HOST / LYCO_STAGE_ROOT / LYCO_R2_BUCKET
    LYCO_WRANGLER   wrangler 调用方式（本机已 OAuth 登录时用默认的 npx wrangler）
"""
import os
import re
import subprocess
import sys
import tempfile

SSH_KEY = os.path.expanduser(os.environ.get('LYCO_SSH_KEY', '~/.ssh/lain42.pem'))
SSH_HOST = os.environ.get('LYCO_SSH_HOST', 'root@lain42.top')
WEB_ROOT = os.environ.get('LYCO_WEB_ROOT', '/var/www/studio')
BUCKET = os.environ.get('LYCO_R2_BUCKET', 'lyco-music-dl')
PUBLIC_BASE = os.environ.get(
    'LYCO_R2_PUBLIC_BASE', 'https://lyco-music-dl.m15178682641.workers.dev')

SSH = ['ssh', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no']
SCP = ['scp', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no']

# (服务器路径, 桶内 key, Content-Type)
FILES = [
    (WEB_ROOT + '/downloads/index.html', 'downloads/index.html', 'text/html; charset=utf-8'),
    (WEB_ROOT + '/downloads/downloads.css', 'downloads/downloads.css', 'text/css; charset=utf-8'),
    (WEB_ROOT + '/downloads/manifest.json', 'downloads/manifest.json', 'application/json'),
    (WEB_ROOT + '/assets/studio.css', 'assets/studio.css', 'text/css; charset=utf-8'),
    (WEB_ROOT + '/assets/studio.js', 'assets/studio.js', 'text/javascript; charset=utf-8'),
]

BANNER = (
    '<div id="lyco-mirror-note" style="margin:0;padding:10px 16px;'
    'background:#1b1b1b;border-bottom:1px solid #2a2a2a;color:#c9c9c9;'
    'font:13px/1.6 -apple-system,PingFang SC,Microsoft YaHei,sans-serif;text-align:center">'
    '你现在打开的是 <b style="color:#E83A45">Cloudflare R2 边缘镜像</b>，'
    '下载更快；主站与完整导航在 <a href="https://lain42.top/downloads/" '
    'style="color:#E83A45">lain42.top/downloads/</a>（本站仅镜像下载页与安装包）'
    '</div>'
)


def wrangler_prefix():
    """找到能用的 wrangler。没装/没登录时给出明确提示，而不是 WinError 2。"""
    env = os.environ.get('LYCO_WRANGLER')
    if env:
        return env.split()
    import shutil
    for name in ('npx', 'npx.cmd', 'pnpm', 'pnpm.cmd'):
        found = shutil.which(name)
        if found:
            return [found, 'wrangler']
    for cand in (r'D:\APP\Code\nodejs\npx.cmd', r'C:\Program Files\nodejs\npx.cmd'):
        if os.path.exists(cand):
            return [cand, 'wrangler']
    sys.exit('找不到 npx/pnpm：请在装了 wrangler 并已登录的目录下运行，'
             '或用 LYCO_WRANGLER 指定（例如 LYCO_WRANGLER="npx.cmd wrangler"）')


def main():
    tmp = tempfile.mkdtemp(prefix='lyco-page-')
    ok = fail = 0
    for remote, key, ctype in FILES:
        local = os.path.join(tmp, key.replace('/', '_'))
        r = subprocess.run(SCP + ['%s:%s' % (SSH_HOST, remote), local],
                           capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            print('  SCP FAIL  %s  %s' % (remote, (r.stderr or '')[-120:]))
            fail += 1
            continue

        if key.endswith('index.html'):
            html = open(local, encoding='utf-8').read()
            if 'lyco-mirror-note' not in html:
                m = re.search(r'<body[^>]*>', html, re.I)
                html = (html[:m.end()] + '\n' + BANNER + html[m.end():]) if m else (BANNER + html)
                open(local, 'w', encoding='utf-8').write(html)
                print('  注入镜像说明条 ->', key)

        r = subprocess.run(wrangler_prefix() + ['r2', 'object', 'put',
                                                '%s/%s' % (BUCKET, key), '--file', local,
                                                '--content-type', ctype, '--remote'],
                           capture_output=True, text=True, timeout=600)
        if 'Upload complete' in (r.stdout or ''):
            ok += 1
            print('  OK        %s' % key)
        else:
            fail += 1
            print('  PUT FAIL  %s  %s' % (key, (r.stdout or '')[-120:]))

    print()
    print('上传 %d，失败 %d' % (ok, fail))
    print('镜像下载页：%s/downloads/' % PUBLIC_BASE)
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
