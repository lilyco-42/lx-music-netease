# -*- coding: utf-8 -*-
"""从商店素材母图派生移动端启动图标（iOS AppIcon + Android launcher）。

为什么要有这个脚本：iOS 的 AppIcon.appiconset 一直是空的（只有 Contents.json），
Android 的 ic_launcher 还是 React Native 模板里的安卓机器人。商店列表用的是
store-assets/icon 里的黑胶图标，装到手机上却看到模板图标 —— 这里把母图按各
平台要求的尺寸派生出来，并把 iOS 需要的文件名写回 Contents.json。

用法：python apps/mobile/scripts/install-app-icons.py
"""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MOBILE))

MASTER = os.environ.get(
    'LYCO_ICON_MASTER',
    os.path.join(REPO, 'store-assets', 'icon', 'lyco_music_icon_1024.png'),
)

# iOS: (idiom, size, scale) -> 像素边长；与 AppIcon.appiconset/Contents.json 对应
IOS_SLOTS = [
    ('iphone', '20x20', '2x', 40),
    ('iphone', '20x20', '3x', 60),
    ('iphone', '29x29', '2x', 58),
    ('iphone', '29x29', '3x', 87),
    ('iphone', '40x40', '2x', 80),
    ('iphone', '40x40', '3x', 120),
    ('iphone', '60x60', '2x', 120),
    ('iphone', '60x60', '3x', 180),
    ('ios-marketing', '1024x1024', '1x', 1024),
]

# Android 密度 -> 边长
ANDROID_SIZES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
}


def ios_filename(size, scale):
    return 'AppIcon-%s@%s.png' % (size, scale)


def round_mask(px):
    """圆角/圆形遮罩：Android 的 ic_launcher_round 需要真的圆形。"""
    mask = Image.new('L', (px, px), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, px - 1, px - 1], fill=255)
    return mask


def main():
    if not os.path.exists(MASTER):
        sys.exit('母图不存在：%s' % MASTER)
    master = Image.open(MASTER).convert('RGBA')
    print('母图 %s %s' % (master.size, MASTER))

    # ---- iOS ----
    ios_dir = os.path.join(MOBILE, 'ios', 'LycoMusic', 'Images.xcassets', 'AppIcon.appiconset')
    os.makedirs(ios_dir, exist_ok=True)
    images = []
    for idiom, size, scale, px in IOS_SLOTS:
        fn = ios_filename(size.replace('x', 'x'), scale)
        master.resize((px, px), Image.LANCZOS).save(os.path.join(ios_dir, fn), 'PNG')
        # iOS 图标不允许透明通道，转成 RGB 再存一次
        rgb = Image.open(os.path.join(ios_dir, fn)).convert('RGB')
        rgb.save(os.path.join(ios_dir, fn), 'PNG')
        images.append({'idiom': idiom, 'size': size, 'scale': scale, 'filename': fn})
        print('  iOS   %-28s %dx%d' % (fn, px, px))
    with open(os.path.join(ios_dir, 'Contents.json'), 'w', encoding='utf-8') as f:
        json.dump({'images': images, 'info': {'author': 'xcode', 'version': 1}},
                  f, ensure_ascii=False, indent=2)
        f.write('\n')

    # ---- Android ----
    for density, px in ANDROID_SIZES.items():
        d = os.path.join(MOBILE, 'android', 'app', 'src', 'main', 'res', 'mipmap-' + density)
        os.makedirs(d, exist_ok=True)
        square = master.resize((px, px), Image.LANCZOS).convert('RGBA')
        square.save(os.path.join(d, 'ic_launcher.png'), 'PNG')
        round_icon = square.copy()
        round_icon.putalpha(round_mask(px))
        round_icon.save(os.path.join(d, 'ic_launcher_round.png'), 'PNG')
        print('  Android mipmap-%-8s %dx%d (square + round)' % (density, px, px))

    print('完成：iOS %d 个尺寸，Android %d 个密度' % (len(IOS_SLOTS), len(ANDROID_SIZES)))


if __name__ == '__main__':
    main()
