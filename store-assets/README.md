# Lyco Music 应用商店上架素材

v0.2.0 商店素材包（32 张 PNG），由 ChatGPT 生成视觉 + Python/PIL 精确导出，规格基于
`gh search repo` 找到的开源规范（[ParthJadhav/app-store-screenshots](https://github.com/ParthJadhav/app-store-screenshots)、
[mobile-dev-ci/play-store-screenshots](https://github.com/mobile-dev-ci/play-store-screenshots) 等）与官方商店要求。

设计语言：深色 `#101010` 背景 + 黑胶唱片/音符 + 强调红 `#E83A45`，扁平圆角，中文文案；品牌字体
PingFang SC / Microsoft YaHei / Noto Sans CJK SC。

## 目录与尺寸

### icon/（应用图标，无透明通道、方形 PNG）
| 文件 | 尺寸 |
|---|---|
| lyco_music_icon_1024.png | 1024×1024（主图标） |
| lyco_music_icon_512.png | 512×512（Play 商店） |
| lyco_music_icon_180.png | 180×180（iOS @3x） |
| lyco_music_icon_152.png | 152×152（iPad） |
| lyco_music_icon_167.png | 167×167（iPad Pro） |
| lyco_music_icon_120.png | 120×120（iOS @2x） |
| lyco_music_icon_310.png | 310×310（Windows 方形 Tile） |
| lyco_music_icon_150.png | 150×150（Windows 方形 Tile） |
| lyco_music_icon_50.png / 48.png / 44.png | 50 / 48 / 44×44（小图标） |

### google_play/（Google Play）
| 文件 | 尺寸 | 用途 |
|---|---|---|
| google_play_feature_graphic_1024x500.png | 1024×500 | 必填 Feature Graphic |
| google_play_phone_screenshot_1..5_1080x1920.png | 1080×1920 | 手机截图（首页/播放器/歌单/好友同步/搜索） |

### apple_app_store/（Apple App Store）
| 文件 | 尺寸 | 用途 |
|---|---|---|
| apple_iphone_screenshot_1..5_1320x2868.png | 1320×2868 | iPhone 6.9" 截图 |
| apple_product_page_header_3840x1646.png | 3840×1646 | 产品页头部创意素材 |

### mac_app_store/（Mac App Store）
| 文件 | 尺寸 |
|---|---|
| mac_app_store_screenshot_1..3_2880x1800.png | 2880×1800（16:10） |

### microsoft_store/（Microsoft Store）
| 文件 | 尺寸 | 用途 |
|---|---|---|
| microsoft_store_logo_300x300.png | 300×300 | 商店 Logo |
| microsoft_store_wide_tile_310x150.png | 310×150 | 宽幅 Tile |
| microsoft_store_small_icon_44x44.png | 44×44 | 小图标 |
| microsoft_store_screenshot_1..3_1366x768.png | 1366×768 | 商店截图（16:9） |

## 其他文件
- `manifest.json`：全部 32 个文件与像素尺寸清单（可与本地逐张校验）。
- `generate_lyco_store_assets.py`：ChatGPT 生成时使用的导出脚本（PIL 精确尺寸 + 校验）。
- `lyco_music_store_assets.zip`：整包压缩，5.6 MB，可直接下载使用。
