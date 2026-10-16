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
`generate_lyco_store_assets.py`：导出脚本（PIL 精确尺寸 + 文字重叠自检）。

## 复现与自检

脚本原本写死在 ChatGPT 沙箱路径（`/mnt/data/...`、Linux Noto 字体）上，出沙箱跑不起来；现已改为
可用环境变量覆盖的本地路径，在 Windows 上直接可跑：

```bash
# 只重画商店截图/头图（推荐，图标沿用已定稿的 AI 生成母图）
LYCO_OUT=./out LYCO_ICON=./icon/lyco_music_icon_1024.png \
  python generate_lyco_store_assets.py

# 连 11 个图标 + Microsoft Logo/小图标一起重画
LYCO_ICONS=1 ... python generate_lyco_store_assets.py
```

字体默认用 `C:\\Windows\\Fonts\\msyh.ttc`（可用 `LYCO_FONT_REG` / `LYCO_FONT_BOLD` 换）。

**文字重叠自检**：`draw_text()` 会把每段文字的 ink 盒记进 `_TEXT_LOG`，每张图渲染完调用
`check_overlaps()` 做两两相交检测并打印结果。生成式排版最容易出的错就是文字互相压字，
这类问题在缩略图里往往看不出来，必须机器逐张校验。当前 19 张合成图重叠数均为 0。

### 本版修掉的排版缺陷

| 位置 | 问题 | 修法 |
|---|---|---|
| 手机截图（Play/App Store 各 5 张） | 首页 banner 的红底「立即播放」按钮压住副标题「你的专属音乐情绪站」 | 用字体度量 `below()` 排版后按钮跟随副标题下移 |
| 手机截图标题区 | 标题行高用 `textbbox` 差值算（ink 盒 ≠ em 盒），副标题贴到标题字形上 | 统一改用 `ink_top/ink_bottom/below` 基于 `getmetrics()` 的行高 |
| Microsoft Store 截图 ×3 | 左上角「Lyco Music」说明文字正好画在窗口标题栏上 | 窗口收到 0.72 高并下移，顶部留出净空 |
| 桌面窗口三个页面标题 | 标题/副标题间距 0.045h 小于实际行高，出现 1px 相压 | 改为按字体度量计算、`gap=0.9` |
- `lyco_music_store_assets.zip`：整包压缩，约 5.4 MB，可直接下载使用。
