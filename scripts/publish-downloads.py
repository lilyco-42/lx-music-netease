#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 lx-music-netease 各平台安装包登记进下载页目录。幂等，可重复执行。

用法：publish-downloads.py [tag]
  不带参数时取 STAGE_ROOT 下最新的 v* 目录；
  带参数时用指定 tag（release.yml 会把本次发布的 tag 传进来）。

设计要点：**幂等**。同一 tag 重复执行只会覆盖同名条目，不会重复追加；
发布失败重跑、或者事后补跑都不会把目录弄脏。
"""
import json, os, glob, hashlib, shutil, sys, time

MAN = '/var/www/studio/downloads/manifest.json'
HTML = '/var/www/studio/downloads/index.html'
STAGE_ROOT = '/var/www/studio/downloads/lx-music-netease'
REPO = 'https://github.com/lilyco-42/lx-music-netease'

if len(sys.argv) > 1 and sys.argv[1].strip():
    tag = sys.argv[1].strip()
    stage = os.path.join(STAGE_ROOT, tag)
    assert os.path.isdir(stage), 'stage dir not found: ' + stage
else:
    stages = sorted(glob.glob(STAGE_ROOT + '/v*'))
    assert stages, 'no stage dirs under ' + STAGE_ROOT
    stage = stages[-1]
    tag = os.path.basename(stage)
base_url = 'https://lain42.top/downloads/lx-music-netease/' + tag
files = sorted(os.listdir(stage))

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def norm(s):
    """把文件名归一化后比较：空格与点号等价。

    electron-builder 的产物名随配置变过（"LX Music-..." -> "LX.Music-..."），
    归一化后新旧命名都能匹配上，脚本不会因为改了 artifactName 就失效。
    """
    return s.replace(' ', '.').lower()


def pick(*subs):
    """在 stage 里找第一个文件名（归一化后）包含所有子串的文件。"""
    for fn in files:
        n = norm(fn)
        if all(norm(s) in n for s in subs):
            return fn
    return None

def entry(fn, platform, plat_label, arch_note):
    if ' ' in fn:
        # 空格在 URL 中必须转义成 %20，直链很容易被二次编码后 404。
        # 这里不直接失败，但要让日志里看得见，便于回头修 artifactName。
        print('WARNING: filename contains a space, url-unsafe: %s' % fn)
    p = os.path.join(stage, fn)
    return {
        'platform': plat_label,
        'file': fn,
        'size': os.path.getsize(p),
        'sha256': sha(p),
        'url': base_url + '/' + fn,
    }

win = pick('windows-setup.exe')
msi = pick('windows-x64.msi')
portable = pick('windows-x64-portable.exe')
dmg_arm = pick('macos-arm64.dmg')
dmg_x64 = pick('macos-x64.dmg')
apk = pick('android') or pick('.apk')
ipa = pick('ios-unsigned.ipa') or pick('unsigned.ipa')
appimg = pick('linux-x86_64.AppImage')

print('stage', stage)
print('win', win, '| msi', msi, '| portable', portable, '| dmg_arm', dmg_arm, '| dmg_x64', dmg_x64)
print('apk', apk, '| ipa', ipa, '| appimg', appimg)

# 版本号从 tag 里取：v0.1.0-20261015 -> 0.1.0；取不到就退回 tag 本身
ver = tag[1:].split('-')[0] if tag.startswith('v') else tag
print('tag=%s version=%s' % (tag, ver))
common = {
    'license': 'Apache-2.0',
    'repository': REPO,
    'version': ver,
    'official': base_url + '/',
    'channel': '本站文件',
    'release': tag,
}

items = []

if win:
    items.append(dict(id='lx-music-windows', name='LX Music（Windows）',
        summary='网易云音乐风格的开源音乐播放器；桌面端与移动端共用同一套音源内核，支持导入订阅链接一键补全第三方音源。',
        category='媒体工具', platforms=['windows'],
        mirror=entry(win, 'win', 'Windows x64 · 安装版', ''),
        **common))
if portable:
    items.append(dict(id='lx-music-windows-portable', name='LX Music（Windows 便携版）',
        summary='网易云音乐风格的开源音乐播放器，Windows 免安装便携版，解压即用，不写注册表。',
        category='媒体工具', platforms=['windows'],
        mirror=entry(portable, 'win', 'Windows x64 · 免安装便携版', ''),
        note='便携版不需要安装，双击即可运行；数据与配置保存在程序所在目录。适合放在 U 盘里随身携带。',
        **common))
if dmg_arm:
    items.append(dict(id='lx-music-macos', name='LX Music（macOS）',
        summary='网易云音乐风格的开源音乐播放器，Apple Silicon 与 Intel 双架构。未签名，首次打开需右键 → 打开。',
        category='媒体工具', platforms=['macos'],
        mirror=entry(dmg_arm, 'mac', 'macOS arm64 · Apple Silicon', ''),
        note='安装包未经 Apple 签名与公证。首次打开请右键点图标选「打开」，或到「系统设置 → 隐私与安全性」点「仍要打开」。Intel 机型请改用同目录的 macos-x64.dmg。',
        **common))
if apk:
    items.append(dict(id='lx-music-android', name='LX Music（Android）',
        summary='网易云音乐风格的开源音乐播放器安卓版，含 arm64-v8a 与 armeabi-v7a。',
        category='媒体工具', platforms=['android'],
        mirror=entry(apk, 'android', 'Android · 通用 APK', ''),
        note='使用仓库内置调试证书签名，升级安装时请先卸载旧版。安装前需在系统设置里允许「安装未知来源应用」。',
        **common))
if appimg:
    items.append(dict(id='lx-music-linux', name='LX Music（Linux）',
        summary='网易云音乐风格的开源音乐播放器 Linux 版，单文件 AppImage，无需安装。',
        category='媒体工具', platforms=['linux'],
        mirror=entry(appimg, 'linux', 'Linux x86_64 · AppImage', ''),
        install='chmod +x LX.Music-*.AppImage && ./LX.Music-*.AppImage',
        **common))
if ipa:
    # iOS 条目必须和其他平台一样填 mirror。
    # 之前这里用的是 download_url + 手写的 channel/official，下载页只认 mirror，
    # 结果 iOS 卡片渲染成「file: None」，明明服务器上 4.1MB 的 ipa 已经传上去了。
    items.append(dict(id='lx-music-ios', name='LX Music（iOS）',
        summary='网易云音乐风格的开源音乐播放器 iOS 版。安装包未签名，需要自行签名或使用 AltStore / SideStore 侧载。',
        category='媒体工具', platforms=['ios'],
        mirror=entry(ipa, 'ios', 'iOS · 未签名 IPA', ''),
        note='这是未签名 IPA，不能直接双击安装。可用 AltStore / SideStore / TrollStore 侧载，或用你自己的开发者证书重签后再装。',
        **common))

man = json.load(open(MAN, encoding='utf-8'))
old_ids = {i['id'] for i in man['items']}
before = len(man['items'])
man['items'] = [i for i in man['items'] if i['id'] not in {x['id'] for x in items}]
man['items'].extend(items)
man['updatedAt'] = time.strftime('%Y-%m-%d')

bak = MAN + '.bak-lxmusic-' + time.strftime('%Y%m%d-%H%M%S')
shutil.copy2(MAN, bak)
json.dump(man, open(MAN, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('manifest: %d -> %d items (added %d, replaced %d)' % (
    before, len(man['items']), len(items), len(old_ids & {x['id'] for x in items})))
print('backup', bak)

# ---- 下载页加 Linux 标签 ----
h = open(HTML, encoding='utf-8').read()
if 'data-platform="linux"' not in h:
    old = '<button type="button" class="platform-tab" data-platform="android" aria-pressed="false">Android <small>0</small></button>'
    assert h.count(old) == 1, 'android tab anchor x%d' % h.count(old)
    new = old + '\n        <button type="button" class="platform-tab" data-platform="linux" aria-pressed="false">Linux <small>0</small></button>'
    h = h.replace(old, new, 1)
    old2 = "labels={windows:'Windows',macos:'macOS',ios:'iOS / iPadOS',android:'Android'}"
    assert h.count(old2) == 1, 'labels anchor x%d' % h.count(old2)
    h = h.replace(old2, "labels={windows:'Windows',macos:'macOS',ios:'iOS / iPadOS',android:'Android',linux:'Linux'}", 1)
    hbak = HTML + '.bak-lxmusic-' + time.strftime('%Y%m%d-%H%M%S')
    shutil.copy2(HTML, hbak)
    open(HTML, 'w', encoding='utf-8').write(h)
    print('downloads page: linux tab added, backup', hbak)
else:
    print('downloads page: linux tab already present')