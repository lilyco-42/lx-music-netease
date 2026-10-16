#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把某个发布版本的产物从 lain42.top 镜像到 Cloudflare R2。

CI 里配好 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY 两个 secret 后，
release.yml 的 "Mirror to Cloudflare R2" 步骤会自动镜像；这个脚本是
没配 secret 时的本地兜底（走 wrangler 的 OAuth，本机已登录即可）。

用法：
    python scripts/mirror-r2.py v0.2.1-20261016
    python scripts/mirror-r2.py            # 不传则取服务器上最新的 v* 目录

环境变量（都有合理默认值）：
    LYCO_SSH_KEY     SSH 私钥路径，默认 ~/.ssh/lain42.pem
    LYCO_SSH_HOST    默认 root@lain42.top
    LYCO_STAGE_ROOT  服务器上的发布根目录，默认 /var/www/studio/downloads/lyco_music
    LYCO_R2_BUCKET   默认 lyco-music-dl
    LYCO_WRANGLER    wrangler 的调用方式，默认 npx.cmd wrangler / npx wrangler 自动探测
"""
import os
import subprocess
import sys
import tempfile

SSH_KEY = os.path.expanduser(os.environ.get('LYCO_SSH_KEY', '~/.ssh/lain42.pem'))
SSH_HOST = os.environ.get('LYCO_SSH_HOST', 'root@lain42.top')
STAGE_ROOT = os.environ.get('LYCO_STAGE_ROOT', '/var/www/studio/downloads/lyco_music')
BUCKET = os.environ.get('LYCO_R2_BUCKET', 'lyco-music-dl')
PUBLIC_BASE = os.environ.get(
    'LYCO_R2_PUBLIC_BASE', 'https://lyco-music-dl.m15178682641.workers.dev')

SSH_OPTS = ['-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no']


def run(cmd, timeout=1800):
    return subprocess.run(cmd, capture_output=True, text=True,
                          timeout=timeout, encoding='utf-8', errors='replace')


def wrangler_prefix():
    env = os.environ.get('LYCO_WRANGLER')
    if env:
        return env.split()
    npx = os.environ.get('LYCO_NPX', 'npx')
    return [npx, 'wrangler']


def pick_stage():
    r = run(['ssh'] + SSH_OPTS + [SSH_HOST, 'ls -1 %s' % STAGE_ROOT])
    if r.returncode != 0:
        sys.exit('列目录失败：%s' % (r.stderr or '').strip()[-200:])
    stages = sorted(s.strip() for s in r.stdout.splitlines() if s.strip().startswith('v'))
    if not stages:
        sys.exit('%s 下没有 v* 目录' % STAGE_ROOT)
    return stages[-1]


def main():
    tag = sys.argv[1] if len(sys.argv) > 1 else pick_stage()
    remote_dir = '%s/%s' % (STAGE_ROOT, tag)
    r = run(['ssh'] + SSH_OPTS + [SSH_HOST, 'ls -1 %s' % remote_dir])
    if r.returncode != 0:
        sys.exit('服务器上找不到 %s' % remote_dir)
    files = [f.strip() for f in r.stdout.splitlines() if f.strip()]
    print('stage %s：%d 个文件' % (tag, len(files)))

    ok = fail = 0
    tmpdir = tempfile.mkdtemp(prefix='lyco-r2-')
    for name in files:
        local = os.path.join(tmpdir, name)
        r = run(['scp'] + SSH_OPTS + ['%s:%s/%s' % (SSH_HOST, remote_dir, name), local])
        if r.returncode != 0:
            print('  SCP FAIL  %s' % name)
            fail += 1
            continue
        key = 'lyco_music/%s/%s' % (tag, name)
        r = run(wrangler_prefix() + ['r2', 'object', 'put',
                                     '%s/%s' % (BUCKET, key), '--file', local, '--remote'])
        if 'Upload complete' in (r.stdout or ''):
            ok += 1
            print('  OK        %s' % name)
            os.remove(local)
        else:
            fail += 1
            print('  PUT FAIL  %s  %s' % (name, (r.stdout or '')[-120:]))
            print('            （若在非项目目录运行，请设置 LYCO_WRANGLER 指向已安装 wrangler）')

    print()
    print('成功 %d，失败 %d' % (ok, fail))
    print('镜像地址：%s/lyco_music/%s/' % (PUBLIC_BASE, tag))
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
