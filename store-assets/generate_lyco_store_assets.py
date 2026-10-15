from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os, random, json, zipfile
from functools import lru_cache

OUT_DIR = '/mnt/data/lyco_music_store_assets/pngs'
os.makedirs(OUT_DIR, exist_ok=True)

ICON_SRC = '/mnt/data/ghostwriter_images/generated/a_clean_high_contrast_minimalist_dark_app_icon_s_1.png'
FONT_REG = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'

DARK = {
    'bg': '#101010', 'surface': '#202020', 'float': '#303030', 'bottom': '#1d1d1d',
    'text': '#EEEEEE', 'sub': '#969696', 'weak': '#555555', 'red': '#E83A45', 'line': '#2B2B2B',
}
LIGHT = {
    'bg': '#F4F6FB', 'side': '#EEF1F6', 'bottom': '#FBFCFE', 'line': '#E9ECF2',
    'text': '#252D42', 'sub': '#465066', 'weak': '#747D90', 'red': '#D43B52',
}
random.seed(42)


def rgba(hex_color, alpha=255):
    hex_color = hex_color.lstrip('#')
    return (int(hex_color[:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16), alpha)


@lru_cache(maxsize=64)
def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, int(size))


def draw_text(draw, xy, text, size, color, bold=False, anchor='la'):
    draw.text(xy, text, font=font(size, bold), fill=color, anchor=anchor)


def rounded_rect_mask(size, radius):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size[0]-1, size[1]-1], radius=radius, fill=255)
    return m


def paste_rounded(dst, src, box, radius):
    src = src.resize((box[2]-box[0], box[3]-box[1]), Image.LANCZOS)
    mask = rounded_rect_mask(src.size, radius)
    dst.paste(src, box[:2], mask)


def draw_shadow(base, box, radius, blur=30, offset=(0,8), color=(0,0,0,140)):
    shadow = Image.new('RGBA', base.size, (0,0,0,0))
    d = ImageDraw.Draw(shadow)
    x0,y0,x1,y1 = box
    ox,oy = offset
    d.rounded_rectangle([x0+ox, y0+oy, x1+ox, y1+oy], radius=radius, fill=color)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)


def make_bg(size, dark=True, accent_pos=None):
    w,h = size
    base = Image.new('RGBA', size, rgba(DARK['bg'] if dark else LIGHT['bg']))
    overlay = Image.new('RGBA', size, (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    if accent_pos is None:
        accent_pos = (int(w*0.18), int(h*0.22))
    ax, ay = accent_pos
    red = rgba(DARK['red'] if dark else LIGHT['red'], 110 if dark else 80)
    pale = (255,255,255,35 if dark else 25)
    d.ellipse([ax-w*0.22, ay-h*0.22, ax+w*0.22, ay+h*0.22], fill=red)
    bx, by = int(w*0.82), int(h*0.78)
    d.ellipse([bx-w*0.18, by-h*0.18, bx+w*0.18, by+h*0.18], fill=pale)
    overlay = overlay.filter(ImageFilter.GaussianBlur(max(24, min(w,h)//14)))
    base.alpha_composite(overlay)
    vignette = Image.new('RGBA', size, (0,0,0,0))
    vd = ImageDraw.Draw(vignette)
    step = max(12, min(w,h)//40)
    for i in range(0, step*4, step):
        alpha = 28 + i//2
        vd.rounded_rectangle([i,i,w-i-1,h-i-1], radius=max(8, int(min(w,h)*0.03)), outline=(0,0,0,alpha), width=step)
    base.alpha_composite(vignette)
    return base


@lru_cache(maxsize=128)
def gradient_square(size, c1, c2, c3):
    w=h=size
    img = Image.new('RGBA', (w,h), c1)
    px = img.load()
    a = tuple(int(c1.lstrip('#')[i:i+2], 16) for i in (0,2,4))
    b = tuple(int(c2.lstrip('#')[i:i+2], 16) for i in (0,2,4))
    c = tuple(int(c3.lstrip('#')[i:i+2], 16) for i in (0,2,4))
    for y in range(h):
        ty = y/(h-1) if h>1 else 0
        for x in range(w):
            tx = x/(w-1) if w>1 else 0
            r = int(a[0]*(1-tx)*(1-ty) + b[0]*tx*(1-ty) + c[0]*ty)
            g = int(a[1]*(1-tx)*(1-ty) + b[1]*tx*(1-ty) + c[1]*ty)
            bb = int(a[2]*(1-tx)*(1-ty) + b[2]*tx*(1-ty) + c[2]*ty)
            px[x,y] = (r,g,bb,255)
    d = ImageDraw.Draw(img)
    d.ellipse([w*0.52, h*0.10, w*0.95, h*0.53], fill=(255,255,255,24))
    d.rectangle([w*0.12, h*0.12, w*0.88, h*0.88], outline=(255,255,255,18), width=max(2, size//32))
    return img


ALBUM_TYPES = ['sunset','ocean','mint','gold','purple']

@lru_cache(maxsize=256)
def create_album_art(size, kind):
    palette = {
        'sunset': ('#3A1016','#C7363E','#1C0E17'),
        'ocean': ('#0F2338','#355CFF','#18202C'),
        'mint': ('#12211E','#2BAA8E','#192A29'),
        'gold': ('#2A2010','#D28D35','#1F1A17'),
        'purple': ('#201226','#6B3CF0','#1A1626'),
    }
    art = gradient_square(size, *palette.get(kind, palette['purple'])).copy()
    d = ImageDraw.Draw(art)
    w,h = art.size
    poly = [(0,h*0.72),(w*0.25,h*0.48),(w*0.45,h*0.62),(w*0.62,h*0.42),(w*0.78,h*0.56),(w,h*0.36),(w,h),(0,h)]
    d.polygon(poly, fill=(0,0,0,55))
    d.ellipse([w*0.58,h*0.18,w*0.82,h*0.42], fill=(255,255,255,55))
    return art


@lru_cache(maxsize=16)
def load_icon(size):
    img = Image.open(ICON_SRC).convert('RGBA')
    return img.resize((size,size), Image.LANCZOS)


def draw_line_icon(draw, kind, box, color, width=3):
    x0,y0,x1,y1 = box
    cx,cy = (x0+x1)/2,(y0+y1)/2
    w = x1-x0; h=y1-y0
    if kind == 'home':
        draw.polygon([(cx, y0+h*0.14),(x0+w*0.12, y0+h*0.45),(x0+w*0.25, y0+h*0.45),(x0+w*0.25,y1-h*0.1),(x1-w*0.25,y1-h*0.1),(x1-w*0.25,y0+h*0.45),(x1-w*0.12,y0+h*0.45)], outline=color, width=width)
    elif kind == 'discover':
        draw.ellipse([x0+w*0.12,y0+h*0.12,x1-w*0.12,y1-h*0.12], outline=color, width=width)
        draw.line([cx, y0+h*0.28, cx, y1-h*0.28], fill=color, width=width)
        draw.line([x0+w*0.28, cy, x1-w*0.28, cy], fill=color, width=width)
    elif kind == 'library':
        for i in range(3):
            yy = y0 + h*(0.22+i*0.24)
            draw.rounded_rectangle([x0+w*0.18, yy, x1-w*0.18, yy+h*0.1], radius=3, outline=color, width=width)
    elif kind == 'search':
        draw.ellipse([x0+w*0.18,y0+h*0.18,x0+w*0.65,y0+h*0.65], outline=color, width=width)
        draw.line([x0+w*0.58,y0+h*0.58,x1-w*0.15,y1-w*0.15], fill=color, width=width)
    elif kind == 'heart':
        draw.arc([x0+w*0.18,y0+h*0.2,x0+w*0.5,y0+h*0.52],180,360,fill=color,width=width)
        draw.arc([x0+w*0.5,y0+h*0.2,x1-w*0.18,y0+h*0.52],180,360,fill=color,width=width)
        draw.line([x0+w*0.18,y0+h*0.38,cx,y1-h*0.18,x1-w*0.18,y0+h*0.38], fill=color, width=width, joint='curve')
    elif kind == 'devices':
        draw.rounded_rectangle([x0+w*0.12,y0+h*0.22,x0+w*0.52,y1-h*0.18], radius=4, outline=color, width=width)
        draw.rounded_rectangle([x0+w*0.62,y0+h*0.12,x1-w*0.12,y1-h*0.28], radius=4, outline=color, width=width)


def build_phone_ui(w, h, screen_kind):
    img = Image.new('RGBA', (w,h), rgba(DARK['bg']))
    d = ImageDraw.Draw(img)
    draw_text(d, (w*0.08, h*0.055), 'Lyco Music', h*0.035, DARK['text'], bold=True)
    d.ellipse([w*0.055,h*0.042,w*0.072,h*0.059], fill=rgba(DARK['red']))
    for i,kind in enumerate(['heart','search']):
        bx = w*(0.8 + i*0.08)
        draw_line_icon(d, kind, [bx,h*0.04,bx+w*0.045,h*0.085], rgba(DARK['sub']), width=max(2,int(w*0.004)))
    if screen_kind == 'home':
        search_box = [w*0.055,h*0.11,w*0.945,h*0.17]
        d.rounded_rectangle(search_box, radius=int(h*0.018), fill=rgba('#171717'), outline=rgba(DARK['line']))
        draw_text(d,(w*0.12,h*0.14),'搜索歌曲 / 歌手 / 专辑',h*0.022,DARK['weak'])
        draw_line_icon(d,'search',[w*0.07,h*0.122,w*0.105,h*0.157],rgba(DARK['weak']), width=max(2,int(w*0.003)))
        banner=[w*0.055,h*0.20,w*0.945,h*0.34]
        d.rounded_rectangle(banner, radius=int(h*0.02), fill=rgba('#171717'))
        art=create_album_art(int((banner[3]-banner[1])*0.78),'sunset')
        paste_rounded(img, art, [int(w*0.07),int(h*0.215),int(w*0.29),int(h*0.325)], radius=int(h*0.015))
        draw_text(d,(w*0.34,h*0.242),'每日推荐',h*0.034,DARK['text'],bold=True)
        draw_text(d,(w*0.34,h*0.285),'你的专属音乐情绪站',h*0.022,DARK['sub'])
        chip=[w*0.34,h*0.302,w*0.48,h*0.332]
        d.rounded_rectangle(chip, radius=int(h*0.015), fill=rgba(DARK['red']))
        draw_text(d,((chip[0]+chip[2])/2,(chip[1]+chip[3])/2),'立即播放',h*0.018,'#FFFFFF',bold=True,anchor='mm')
        draw_text(d,(w*0.055,h*0.39),'为你推荐',h*0.028,DARK['text'],bold=True)
        card_w = w*0.41; card_h = h*0.18
        titles=[('夜航日志','纯音乐'),('城市光影','流行'),('专注工作','轻电子'),('新歌雷达','每日更新')]
        for idx,(t,sub) in enumerate(titles):
            row,col=divmod(idx,2)
            x=w*(0.055 + col*0.455); y=h*(0.43 + row*0.215)
            d.rounded_rectangle([x,y,x+card_w,y+card_h], radius=int(h*0.02), fill=rgba('#171717'), outline=rgba(DARK['line']))
            cover_size=int(card_h*0.56)
            art=create_album_art(cover_size, ALBUM_TYPES[idx%len(ALBUM_TYPES)])
            paste_rounded(img, art, [int(x+w*0.02),int(y+h*0.02),int(x+w*0.02+cover_size),int(y+h*0.02+cover_size)], radius=int(h*0.012))
            draw_text(d,(x+w*0.02+cover_size+w*0.02,y+h*0.045),t,h*0.022,DARK['text'],bold=True)
            draw_text(d,(x+w*0.02+cover_size+w*0.02,y+h*0.08),sub,h*0.018,DARK['sub'])
            draw_text(d,(x+w*0.02,y+h*0.135),'24 首',h*0.016,DARK['weak'])
        y=h*0.84
        d.rounded_rectangle([w*0.05,y,w*0.95,h*0.91], radius=int(h*0.02), fill=rgba('#171717'), outline=rgba(DARK['line']))
        art=create_album_art(int(h*0.048),'sunset')
        paste_rounded(img, art, [int(w*0.07),int(y+h*0.011),int(w*0.07+h*0.048),int(y+h*0.059)], radius=int(h*0.01))
        draw_text(d,(w*0.165,y+h*0.023),'赤色余晖',h*0.02,DARK['text'],bold=True)
        draw_text(d,(w*0.165,y+h*0.047),'Lyco FM',h*0.016,DARK['sub'])
        d.polygon([(w*0.78,y+h*0.018),(w*0.78,y+h*0.052),(w*0.815,y+h*0.035)], fill=rgba(DARK['text']))
    elif screen_kind == 'player':
        draw_text(d,(w*0.5,h*0.11),'正在播放',h*0.024,DARK['sub'],anchor='mm')
        vc=(w*0.5,h*0.33); r=h*0.17
        d.ellipse([vc[0]-r,vc[1]-r,vc[0]+r,vc[1]+r], fill=rgba('#0B0B0B'), outline=rgba('#242424'), width=max(2,int(w*0.004)))
        for i in range(10):
            rr=r-i*h*0.012
            d.ellipse([vc[0]-rr,vc[1]-rr,vc[0]+rr,vc[1]+rr], outline=(35,35,35,120), width=1)
        art=create_album_art(int(r*1.0),'sunset')
        paste_rounded(img, art, [int(vc[0]-r*0.5),int(vc[1]-r*0.5),int(vc[0]+r*0.5),int(vc[1]+r*0.5)], radius=int(r*0.18))
        d.line([w*0.77,h*0.17,w*0.64,h*0.32], fill=rgba('#8A8A8A'), width=max(4,int(w*0.01)))
        d.rounded_rectangle([w*0.61,h*0.29,w*0.7,h*0.34], radius=int(h*0.01), fill=rgba('#2A2A2A'))
        d.rounded_rectangle([w*0.654,h*0.305,w*0.675,h*0.325], radius=int(h*0.006), fill=rgba(DARK['red']))
        draw_text(d,(w*0.5,h*0.53),'赤色余晖',h*0.032,DARK['text'],bold=True,anchor='mm')
        draw_text(d,(w*0.5,h*0.568),'Lyco FM · 03:24 / 04:12',h*0.02,DARK['sub'],anchor='mm')
        d.rounded_rectangle([w*0.1,h*0.605,w*0.9,h*0.618], radius=int(h*0.006), fill=rgba('#1A1A1A'))
        d.rounded_rectangle([w*0.1,h*0.605,w*0.62,h*0.618], radius=int(h*0.006), fill=rgba(DARK['red']))
        d.ellipse([w*0.605,h*0.598,w*0.635,h*0.625], fill=rgba('#FFFFFF'))
        d.ellipse([w*0.44,h*0.652,w*0.56,h*0.724], fill=rgba(DARK['red']))
        d.polygon([(w*0.475,h*0.665),(w*0.475,h*0.71),(w*0.525,h*0.688)], fill=rgba('#FFFFFF'))
        d.rounded_rectangle([w*0.065,h*0.77,w*0.935,h*0.93], radius=int(h*0.02), fill=rgba('#171717'), outline=rgba(DARK['line']))
        lines=[('沿着光影，穿过安静城市', DARK['text'], True),('在黑夜里把心跳慢慢放低', DARK['sub'], False),('跟着旋律，找到热爱的位置', DARK['sub'], False),('让每一首歌，都有回响', DARK['sub'], False)]
        for i,(txt,col,b) in enumerate(lines):
            draw_text(d,(w*0.5,h*(0.81+i*0.032)),txt,h*(0.024 if i==0 else 0.02),col,bold=b,anchor='mm')
    elif screen_kind == 'playlist':
        draw_text(d,(w*0.055,h*0.11),'歌单广场',h*0.032,DARK['text'],bold=True)
        cats=['推荐','华语','流行','电子','学习']
        x=w*0.055
        for i,c in enumerate(cats):
            tw = w*(0.12 if len(c)==2 else 0.145)
            fill = rgba(DARK['red']) if i==0 else rgba('#171717')
            tc = '#FFFFFF' if i==0 else DARK['sub']
            d.rounded_rectangle([x,h*0.15,x+tw,h*0.185], radius=int(h*0.017), fill=fill, outline=rgba(DARK['line']))
            draw_text(d,((x+x+tw)/2,h*0.167),c,h*0.017,tc,bold=i==0,anchor='mm')
            x += tw + w*0.02
        cards=[('深夜回响','私人珍藏 32 首','sunset'),('Lo-Fi 专注','适合学习与写作','mint'),('城市漫游','通勤路上的节奏','ocean'),('电子脉冲','高能节拍充电','purple')]
        cw=w*0.41; ch=h*0.27
        for i,(t,sub,k) in enumerate(cards):
            row,col=divmod(i,2)
            x=w*(0.055+col*0.455); y=h*(0.22+row*0.3)
            d.rounded_rectangle([x,y,x+cw,y+ch], radius=int(h*0.02), fill=rgba('#171717'), outline=rgba(DARK['line']))
            art_h=int(ch*0.58)
            art=create_album_art(int(cw), k)
            paste_rounded(img, art, [int(x),int(y),int(x+cw),int(y+art_h)], radius=int(h*0.02))
            draw_text(d,(x+w*0.02,y+art_h+h*0.02),t,h*0.024,DARK['text'],bold=True)
            draw_text(d,(x+w*0.02,y+art_h+h*0.055),sub,h*0.018,DARK['sub'])
            draw_text(d,(x+w*0.02,y+art_h+h*0.086),'♡ 1.2 万',h*0.016,DARK['weak'])
    elif screen_kind == 'sync':
        draw_text(d,(w*0.055,h*0.11),'好友与同步',h*0.032,DARK['text'],bold=True)
        d.rounded_rectangle([w*0.055,h*0.16,w*0.945,h*0.33], radius=int(h*0.02), fill=rgba('#171717'), outline=rgba(DARK['line']))
        draw_line_icon(d,'devices',[w*0.08,h*0.19,w*0.2,h*0.29],rgba(DARK['red']),width=max(3,int(w*0.005)))
        draw_text(d,(w*0.23,h*0.205),'跨端同步已开启',h*0.028,DARK['text'],bold=True)
        draw_text(d,(w*0.23,h*0.245),'Windows · Android · iPhone',h*0.02,DARK['sub'])
        d.rounded_rectangle([w*0.23,h*0.272,w*0.48,h*0.305], radius=int(h*0.016), fill=rgba(DARK['red']))
        draw_text(d,((w*0.23+w*0.48)/2,h*0.289),'继续播放',h*0.018,'#FFFFFF',bold=True,anchor='mm')
        draw_text(d,(w*0.055,h*0.38),'最近设备',h*0.026,DARK['text'],bold=True)
        devs=[('办公室电脑','正在播放 赤色余晖','在线'),('Pixel 手机','歌单已同步','2 分钟前'),('iPhone','搜索历史已同步','5 分钟前')]
        for i,(a,b,c) in enumerate(devs):
            y=h*(0.42+i*0.12)
            d.rounded_rectangle([w*0.055,y,w*0.945,y+h*0.095], radius=int(h*0.018), fill=rgba('#171717'), outline=rgba(DARK['line']))
            d.ellipse([w*0.08,y+h*0.024,w*0.12,y+h*0.064], fill=rgba(DARK['red'] if i==0 else '#2E2E2E'))
            draw_text(d,(w*0.145,y+h*0.022),a,h*0.022,DARK['text'],bold=True)
            draw_text(d,(w*0.145,y+h*0.053),b,h*0.017,DARK['sub'])
            draw_text(d,(w*0.87,y+h*0.038),c,h*0.016,DARK['weak'])
        d.rounded_rectangle([w*0.055,h*0.80,w*0.945,h*0.93], radius=int(h*0.02), fill=rgba('#171717'), outline=rgba(DARK['line']))
        draw_text(d,(w*0.08,h*0.825),'好友动态',h*0.024,DARK['text'],bold=True)
        draw_text(d,(w*0.08,h*0.865),'阿南 正在听：夜航日志',h*0.019,DARK['sub'])
        d.rounded_rectangle([w*0.72,h*0.845,w*0.9,h*0.885], radius=int(h*0.016), fill=rgba('#242424'))
        draw_text(d,((w*0.72+w*0.9)/2,h*0.865),'一起听',h*0.018,DARK['text'],bold=True,anchor='mm')
    elif screen_kind == 'search':
        box=[w*0.055,h*0.11,w*0.945,h*0.17]
        d.rounded_rectangle(box, radius=int(h*0.018), fill=rgba('#171717'), outline=rgba(DARK['line']))
        draw_text(d,(w*0.11,h*0.14),'陈奕迅',h*0.022,DARK['text'])
        draw_line_icon(d,'search',[w*0.07,h*0.122,w*0.105,h*0.157],rgba(DARK['weak']), width=max(2,int(w*0.003)))
        draw_text(d,(w*0.055,h*0.22),'热门搜索',h*0.028,DARK['text'],bold=True)
        hot=['周杰伦','纯音乐','Lo-Fi','白噪音','电子','周末歌单']
        positions=[(0.055,0.26),(0.34,0.26),(0.62,0.26),(0.055,0.31),(0.34,0.31),(0.58,0.31)]
        widths=[0.22,0.18,0.16,0.22,0.14,0.25]
        for (px,py),txt,ww in zip(positions,hot,widths):
            d.rounded_rectangle([w*px,h*py,w*(px+ww),h*(py+0.04)], radius=int(h*0.017), fill=rgba('#171717'), outline=rgba(DARK['line']))
            draw_text(d,((w*px+w*(px+ww))/2,h*(py+0.02)),txt,h*0.017,DARK['sub'],anchor='mm')
        draw_text(d,(w*0.055,h*0.40),'搜索结果',h*0.028,DARK['text'],bold=True)
        results=[('歌曲','十年','陈奕迅 · 黑 · 白 · 灰','sunset'),('歌手','陈奕迅','华语流行','ocean'),('专辑','认了吧','2007','gold'),('歌词','“十年之后，我们是朋友…”','歌词结果','purple')]
        for i,(typ,a,b,k) in enumerate(results):
            y=h*(0.445+i*0.12)
            d.rounded_rectangle([w*0.055,y,w*0.945,y+h*0.095], radius=int(h*0.018), fill=rgba('#171717'), outline=rgba(DARK['line']))
            if typ in ('歌曲','专辑'):
                art=create_album_art(int(h*0.056),k)
                paste_rounded(img, art, [int(w*0.08),int(y+h*0.019),int(w*0.08+h*0.056),int(y+h*0.075)], radius=int(h*0.01))
            else:
                d.ellipse([w*0.08,y+h*0.024,w*0.136,y+h*0.08], fill=rgba('#232323'))
                draw_text(d,((w*0.08+w*0.136)/2,y+h*0.052),typ[0],h*0.022,DARK['red'],bold=True,anchor='mm')
            draw_text(d,(w*0.165,y+h*0.022),a,h*0.022,DARK['text'],bold=True)
            draw_text(d,(w*0.165,y+h*0.055),b,h*0.017,DARK['sub'])
            draw_text(d,(w*0.87,y+h*0.04),typ,h*0.016,DARK['weak'])
    nav_y1 = h*0.93
    d.rounded_rectangle([0, nav_y1, w, h], radius=0, fill=rgba(DARK['bottom']))
    items=[('home','首页'),('discover','发现'),('library','歌单'),('devices','同步'),('search','搜索')]
    for i,(kind,label) in enumerate(items):
        cx = w*(0.1 + i*0.2)
        active = (screen_kind == 'home' and i==0) or (screen_kind == 'playlist' and i==2) or (screen_kind == 'sync' and i==3) or (screen_kind == 'search' and i==4)
        if screen_kind == 'player':
            active = (i==2)
        col = rgba(DARK['red']) if active else rgba(DARK['sub'])
        draw_line_icon(d, kind, [cx-w*0.032, h*0.943, cx+w*0.032, h*0.975], col, width=max(2,int(w*0.0035)))
        draw_text(d,(cx, h*0.985),label,h*0.014,col,bold=active,anchor='ms')
    return img


def compose_mobile_store_shot(size, title, subtitle, kind, theme='dark'):
    w,h=size
    base = make_bg(size, dark=(theme=='dark'))
    d = ImageDraw.Draw(base)
    main_col = '#FFFFFF' if theme=='dark' else LIGHT['text']
    sub_col = DARK['sub'] if theme=='dark' else LIGHT['sub']
    # Brand line
    draw_text(d,(w*0.08,h*0.06),'Lyco Music',h*0.03,main_col,bold=True)
    d.ellipse([w*0.055,h*0.048,w*0.068,h*0.061], fill=rgba(DARK['red'] if theme=='dark' else LIGHT['red']))
    # Dynamic title sizing to prevent overlap
    title_size = h*(0.046 if len(title) <= 4 else 0.041 if len(title) <= 6 else 0.038)
    subtitle_size = h*0.020
    title_y = h*0.118
    draw_text(d,(w*0.08,title_y),title,title_size,main_col,bold=True)
    tb = d.textbbox((w*0.08,title_y), title, font=font(title_size, True), anchor='la')
    title_h = tb[3]-tb[1]
    sub_y = title_y + title_h + h*0.008
    draw_text(d,(w*0.08,sub_y),subtitle,subtitle_size,sub_col)
    sb = d.textbbox((w*0.08,sub_y), subtitle, font=font(subtitle_size, False), anchor='la')
    sub_h = sb[3]-sb[1]
    chips_y = sub_y + sub_h + h*0.018
    chips = [('跨平台',0.08),('深色主题',0.22),('歌词同步',0.39)]
    for text,x in chips:
        tw = len(text)*h*0.016 + w*0.05
        fill = rgba('#191919',220) if theme=='dark' else rgba('#FFFFFF',230)
        outline = rgba('#2B2B2B',255) if theme=='dark' else rgba(LIGHT['line'],255)
        d.rounded_rectangle([x*w,chips_y,x*w+tw,chips_y+h*0.036], radius=int(h*0.018), fill=fill, outline=outline)
        draw_text(d,((x*w+x*w+tw)/2,chips_y+h*0.018),text,h*0.017,sub_col,anchor='mm')
    ph_w = int(w*0.78); ph_h = int(h*0.60)
    outer_r = int(ph_w*0.08)
    x0 = (w-ph_w)//2; y0 = int(h*0.295)
    x1,y1 = x0+ph_w, y0+ph_h
    draw_shadow(base, [x0,y0,x1,y1], radius=outer_r, blur=max(20,w//40), offset=(0,int(h*0.01)))
    phone = Image.new('RGBA',(ph_w,ph_h),(0,0,0,0))
    pd = ImageDraw.Draw(phone)
    pd.rounded_rectangle([0,0,ph_w-1,ph_h-1], radius=outer_r, fill=rgba('#0B0B0B'), outline=(255,255,255,25), width=max(2,ph_w//180))
    inner_margin = int(ph_w*0.035)
    screen_box=[inner_margin,int(ph_h*0.028),ph_w-inner_margin,ph_h-int(ph_h*0.028)]
    screen=build_phone_ui(screen_box[2]-screen_box[0], screen_box[3]-screen_box[1], kind)
    paste_rounded(phone, screen, screen_box, radius=int(outer_r*0.72))
    nw,nh = int(ph_w*0.32), int(ph_h*0.04)
    pd.rounded_rectangle([(ph_w-nw)//2,int(ph_h*0.018),(ph_w+nw)//2,int(ph_h*0.018)+nh], radius=nh//2, fill=rgba('#000000'))
    base.alpha_composite(phone, (x0,y0))
    return base

def build_desktop_window(w, h, kind):
    img = Image.new('RGBA',(w,h), rgba(DARK['bg']))
    d = ImageDraw.Draw(img)
    sidebar_w = int(w*0.2); top_h = int(h*0.085)
    d.rounded_rectangle([0,0,w-1,h-1], radius=int(min(w,h)*0.018), fill=rgba('#151515'), outline=rgba('#2A2A2A'))
    d.rounded_rectangle([0,0,sidebar_w,h], radius=int(min(w,h)*0.018), fill=rgba('#121212'))
    d.rectangle([sidebar_w,0,sidebar_w+1,h], fill=rgba('#232323'))
    d.rectangle([sidebar_w,top_h,w,h], fill=rgba('#171717'))
    for i,c in enumerate(['#FF5F57','#FFBD2E','#28C840']):
        d.ellipse([w*0.028+i*w*0.018,h*0.03,w*0.04+i*w*0.018,h*0.052], fill=rgba(c))
    draw_text(d,(w*0.11,h*0.03),'Lyco Music',h*0.035,DARK['text'],bold=True)
    sb=[sidebar_w+w*0.04,h*0.025,sidebar_w+w*0.28,h*0.065]
    d.rounded_rectangle(sb, radius=int(h*0.02), fill=rgba('#111111'), outline=rgba('#2A2A2A'))
    draw_text(d,(sb[0]+w*0.045,sb[1]+h*0.006),'搜索音乐',h*0.02,DARK['weak'])
    sections=[('发现音乐',True),('为你推荐',False),('我的歌单',False),('最近播放',False),('下载管理',False),('同步设备',False)]
    sy=h*0.12
    for i,(name,active) in enumerate(sections):
        y=sy+i*h*0.08
        if active:
            d.rounded_rectangle([w*0.03,y-h*0.015,sidebar_w-w*0.03,y+h*0.04], radius=int(h*0.02), fill=rgba('#1B1B1B'))
            d.rounded_rectangle([w*0.03,y-h*0.015,w*0.036,y+h*0.04], radius=3, fill=rgba(DARK['red']))
        draw_text(d,(w*0.065,y),name,h*0.022,DARK['text'] if active else DARK['sub'],bold=active)
    d.rounded_rectangle([0,h*0.905,w,h], radius=0, fill=rgba(DARK['bottom']))
    art=create_album_art(int(h*0.07),'sunset')
    paste_rounded(img, art, [int(w*0.022),int(h*0.92),int(w*0.022+h*0.07),int(h*0.99)], radius=int(h*0.012))
    draw_text(d,(w*0.105,h*0.928),'赤色余晖',h*0.022,DARK['text'],bold=True)
    draw_text(d,(w*0.105,h*0.958),'Lyco FM',h*0.016,DARK['sub'])
    d.rounded_rectangle([w*0.34,h*0.945,w*0.66,h*0.955], radius=5, fill=rgba('#1A1A1A'))
    d.rounded_rectangle([w*0.34,h*0.945,w*0.51,h*0.955], radius=5, fill=rgba(DARK['red']))
    d.ellipse([w*0.5,h*0.939,w*0.512,h*0.961], fill=rgba('#FFFFFF'))
    cx0,cy0 = sidebar_w+w*0.03, top_h+h*0.03
    cw,ch = w-sidebar_w-w*0.06, h-top_h-h*0.15
    if kind == 'home':
        draw_text(d,(cx0,cy0),'首页推荐',h*0.04,DARK['text'],bold=True)
        draw_text(d,(cx0,cy0+h*0.045),'懂你的每日推荐与最近播放',h*0.02,DARK['sub'])
        hero=[cx0,cy0+h*0.09,cx0+cw*0.62,cy0+h*0.31]
        d.rounded_rectangle(hero, radius=int(h*0.025), fill=rgba('#1A1A1A'))
        art=create_album_art(int((hero[3]-hero[1])*0.75),'sunset')
        paste_rounded(img, art, [int(hero[0]+w*0.02),int(hero[1]+h*0.02),int(hero[0]+w*0.02+(hero[3]-hero[1])*0.75),int(hero[3]-h*0.02)], radius=int(h*0.02))
        draw_text(d,(hero[0]+cw*0.24,hero[1]+h*0.04),'每日推荐',h*0.04,DARK['text'],bold=True)
        draw_text(d,(hero[0]+cw*0.24,hero[1]+h*0.095),'用喜欢的旋律，填满今天',h*0.022,DARK['sub'])
        d.rounded_rectangle([hero[0]+cw*0.24,hero[1]+h*0.14,hero[0]+cw*0.34,hero[1]+h*0.19], radius=int(h*0.018), fill=rgba(DARK['red']))
        draw_text(d,((hero[0]+cw*0.29),hero[1]+h*0.165),'播放',h*0.018,'#FFFFFF',bold=True,anchor='mm')
        for i,(t,k) in enumerate([('本周收藏','mint'),('跨端同步','ocean')]):
            x=hero[2]+w*0.018; y=hero[1]+i*(hero[3]-hero[1]+h*0.015)/2
            box=[x,y,x+cw*0.33,y+(hero[3]-hero[1]-h*0.015)/2]
            d.rounded_rectangle(box, radius=int(h*0.022), fill=rgba('#1A1A1A'))
            if i==0:
                art=create_album_art(int(box[3]-box[1]-h*0.04),k)
                paste_rounded(img, art, [int(box[0]+w*0.015),int(box[1]+h*0.02),int(box[0]+w*0.015+(box[3]-box[1]-h*0.04)),int(box[3]-h*0.02)], radius=int(h*0.015))
                draw_text(d,(box[0]+cw*0.12,box[1]+h*0.04),t,h*0.026,DARK['text'],bold=True)
                draw_text(d,(box[0]+cw*0.12,box[1]+h*0.085),'收藏 248 首',h*0.018,DARK['sub'])
            else:
                draw_text(d,(box[0]+cw*0.05,box[1]+h*0.04),t,h*0.026,DARK['text'],bold=True)
                draw_text(d,(box[0]+cw*0.05,box[1]+h*0.085),'Windows 与 Android 已连接',h*0.018,DARK['sub'])
        draw_text(d,(cx0,cy0+h*0.37),'推荐歌单',h*0.03,DARK['text'],bold=True)
        for i,(t,sub,k) in enumerate([('城市漫游','通勤节奏','ocean'),('夜航日志','独处时刻','sunset'),('Lo-Fi 专注','学习工作','mint'),('电子脉冲','高能电音','purple')]):
            x=cx0+(i%2)*cw*0.49; y=cy0+h*0.42+(i//2)*h*0.19
            box=[x,y,x+cw*0.46,y+h*0.16]
            d.rounded_rectangle(box, radius=int(h*0.02), fill=rgba('#1A1A1A'))
            art=create_album_art(int(h*0.12),k)
            paste_rounded(img, art, [int(x+w*0.015),int(y+h*0.02),int(x+w*0.015+h*0.12),int(y+h*0.14)], radius=int(h*0.014))
            draw_text(d,(x+w*0.015+h*0.14,y+h*0.028),t,h*0.024,DARK['text'],bold=True)
            draw_text(d,(x+w*0.015+h*0.14,y+h*0.07),sub,h*0.018,DARK['sub'])
            draw_text(d,(x+w*0.015+h*0.14,y+h*0.105),'24 首歌曲',h*0.016,DARK['weak'])
    elif kind == 'player':
        draw_text(d,(cx0,cy0),'沉浸式播放器',h*0.04,DARK['text'],bold=True)
        draw_text(d,(cx0,cy0+h*0.045),'黑胶唱片、歌词同屏与氛围播放',h*0.02,DARK['sub'])
        vinyl_box=[cx0+w*0.02, cy0+h*0.11, cx0+cw*0.42, cy0+h*0.62]
        center=((vinyl_box[0]+vinyl_box[2])/2,(vinyl_box[1]+vinyl_box[3])/2); r=(vinyl_box[2]-vinyl_box[0])*0.42
        d.ellipse([center[0]-r,center[1]-r,center[0]+r,center[1]+r], fill=rgba('#0B0B0B'), outline=rgba('#252525'), width=max(2,w//600))
        for i in range(12):
            rr=r-i*h*0.013
            d.ellipse([center[0]-rr,center[1]-rr,center[0]+rr,center[1]+rr], outline=(35,35,35,140), width=1)
        art=create_album_art(int(r*1.0),'sunset')
        paste_rounded(img, art, [int(center[0]-r*0.52),int(center[1]-r*0.52),int(center[0]+r*0.52),int(center[1]+r*0.52)], radius=int(h*0.018))
        right=[cx0+cw*0.46, cy0+h*0.12, cx0+cw*0.98, cy0+h*0.62]
        d.rounded_rectangle(right, radius=int(h*0.024), fill=rgba('#1A1A1A'))
        draw_text(d,(right[0]+w*0.03,right[1]+h*0.03),'赤色余晖',h*0.038,DARK['text'],bold=True)
        draw_text(d,(right[0]+w*0.03,right[1]+h*0.08),'Lyco FM · 专辑《夜色回声》',h*0.02,DARK['sub'])
        d.rounded_rectangle([right[0]+w*0.03,right[1]+h*0.13,right[2]-w*0.03,right[1]+h*0.145], radius=6, fill=rgba('#111111'))
        d.rounded_rectangle([right[0]+w*0.03,right[1]+h*0.13,right[0]+w*0.19,right[1]+h*0.145], radius=6, fill=rgba(DARK['red']))
        d.ellipse([right[0]+w*0.185,right[1]+h*0.123,right[0]+w*0.197,right[1]+h*0.151], fill=rgba('#FFFFFF'))
        lines=['沿着光影，穿过安静城市','在黑夜里把心跳慢慢放低','跟着旋律，找到热爱的位置','让每一首歌，都有回响']
        for i,line in enumerate(lines):
            draw_text(d,(right[0]+w*0.03,right[1]+h*(0.20+0.06*i)),line,h*(0.026 if i==0 else 0.02),DARK['text'] if i==0 else DARK['sub'],bold=(i==0))
    elif kind == 'library':
        draw_text(d,(cx0,cy0),'歌单与音乐库',h*0.04,DARK['text'],bold=True)
        draw_text(d,(cx0,cy0+h*0.045),'更好整理你的收藏与播放历史',h*0.02,DARK['sub'])
        tags=['全部','最近添加','专属歌单','收藏专辑']
        tx=cx0
        for i,tg in enumerate(tags):
            ww=w*(0.06+0.02*len(tg))
            d.rounded_rectangle([tx,cy0+h*0.095,tx+ww,cy0+h*0.14], radius=int(h*0.018), fill=rgba(DARK['red']) if i==0 else rgba('#1B1B1B'))
            draw_text(d,((tx+tx+ww)/2,cy0+h*0.118),tg,h*0.018,'#FFFFFF' if i==0 else DARK['sub'],bold=i==0,anchor='mm')
            tx += ww + w*0.012
        left=[cx0,cy0+h*0.18,cx0+cw*0.48,cy0+h*0.72]
        d.rounded_rectangle(left, radius=int(h*0.022), fill=rgba('#1A1A1A'))
        draw_text(d,(left[0]+w*0.02,left[1]+h*0.03),'我的歌单',h*0.028,DARK['text'],bold=True)
        items=[('夜航日志','24 首歌曲','sunset'),('城市漫游','32 首歌曲','ocean'),('Lo-Fi 专注','18 首歌曲','mint'),('新歌雷达','每日更新','gold')]
        for i,(t,sub,k) in enumerate(items):
            y=left[1]+h*(0.09+i*0.13)
            if i==0:
                d.rounded_rectangle([left[0]+w*0.015,y-h*0.012,left[2]-w*0.015,y+h*0.09], radius=int(h*0.018), fill=rgba('#222222'))
            art=create_album_art(int(h*0.08),k)
            paste_rounded(img, art, [int(left[0]+w*0.02),int(y),int(left[0]+w*0.02+h*0.08),int(y+h*0.08)], radius=int(h*0.012))
            draw_text(d,(left[0]+w*0.12,y+h*0.01),t,h*0.024,DARK['text'],bold=True)
            draw_text(d,(left[0]+w*0.12,y+h*0.045),sub,h*0.017,DARK['sub'])
        right=[cx0+cw*0.52,cy0+h*0.18,cx0+cw*0.98,cy0+h*0.72]
        d.rounded_rectangle(right, radius=int(h*0.022), fill=rgba('#1A1A1A'))
        art=create_album_art(int(h*0.18),'sunset')
        paste_rounded(img, art, [int(right[0]+w*0.03),int(right[1]+h*0.04),int(right[0]+w*0.03+h*0.18),int(right[1]+h*0.22)], radius=int(h*0.016))
        draw_text(d,(right[0]+w*0.24,right[1]+h*0.05),'夜航日志',h*0.034,DARK['text'],bold=True)
        draw_text(d,(right[0]+w*0.24,right[1]+h*0.1),'24 首歌曲 · 创建于今天',h*0.018,DARK['sub'])
        cols=['#','歌曲','歌手','时长']; colx=[right[0]+w*0.03,right[0]+w*0.09,right[0]+w*0.32,right[2]-w*0.09]
        for x,t in zip(colx,cols):
            draw_text(d,(x,right[1]+h*0.29),t,h*0.016,DARK['weak'],bold=True)
        songs=[('1','赤色余晖','Lyco FM','4:12'),('2','落在凌晨的风','Luna','3:46'),('3','远方电台','Neon','2:58'),('4','夜色静止时','Milo','4:01')]
        for i,row in enumerate(songs):
            y=right[1]+h*(0.34+i*0.08)
            d.rounded_rectangle([right[0]+w*0.02,y-h*0.008,right[2]-w*0.02,y+h*0.05], radius=int(h*0.012), fill=rgba('#202020' if i%2==0 else '#1B1B1B'))
            for x,t in zip(colx,row):
                draw_text(d,(x,y),t,h*0.017,DARK['text'] if x!=colx[0] else DARK['sub'])
    return img


def compose_desktop_screenshot(size, kind, platform='mac'):
    w,h=size
    base = make_bg(size, dark=True)
    ww = int(w*(0.86 if platform=='mac' else 0.94)); wh = int(h*(0.80 if platform=='mac' else 0.89))
    x0=(w-ww)//2; y0=(h-wh)//2
    radius=int(min(ww,wh)*(0.03 if platform=='mac' else 0.02))
    draw_shadow(base, [x0,y0,x0+ww,y0+wh], radius=radius, blur=max(14,w//60), offset=(0,int(h*0.015)))
    window = build_desktop_window(ww,wh,kind)
    paste_rounded(base, window, [x0,y0,x0+ww,y0+wh], radius=radius)
    if platform=='windows':
        d=ImageDraw.Draw(base)
        draw_text(d,(w*0.05,h*0.06),'Lyco Music',h*0.05,DARK['text'],bold=True)
        draw_text(d,(w*0.05,h*0.12),{'home':'首页推荐','player':'沉浸播放','library':'歌单管理'}[kind],h*0.025,DARK['sub'])
    return base


def create_feature_graphic(size):
    w,h=size
    base = make_bg(size, dark=True, accent_pos=(int(w*0.18), int(h*0.35)))
    d = ImageDraw.Draw(base)
    draw_text(d,(w*0.08,h*0.16),'Lyco Music',h*0.11,DARK['text'],bold=True)
    draw_text(d,(w*0.08,h*0.34),'跨平台音乐播放器',h*0.05,DARK['sub'])
    draw_text(d,(w*0.08,h*0.48),'听见热爱，自在切换每一种节奏',h*0.06,DARK['text'],bold=True)
    labels=['黑胶播放','歌词同屏','跨端同步']
    x=w*0.08
    for lab in labels:
        tw = len(lab)*h*0.03 + w*0.03
        d.rounded_rectangle([x,h*0.62,x+tw,h*0.72], radius=int(h*0.05), fill=rgba('#1B1B1B'), outline=rgba('#2A2A2A'))
        draw_text(d,((x+x+tw)/2,h*0.67),lab,h*0.028,DARK['sub'],anchor='mm')
        x += tw + w*0.02
    icon = load_icon(int(h*0.72))
    draw_shadow(base, [int(w*0.62), int(h*0.12), int(w*0.62)+icon.width, int(h*0.12)+icon.height], radius=int(h*0.12), blur=26, offset=(0,10))
    base.alpha_composite(icon, (int(w*0.62), int(h*0.12)))
    return base


def create_appstore_header(size):
    w,h=size
    base = make_bg(size, dark=True, accent_pos=(int(w*0.68), int(h*0.28)))
    d = ImageDraw.Draw(base)
    draw_text(d,(w*0.08,h*0.16),'Lyco Music',h*0.1,DARK['text'],bold=True)
    draw_text(d,(w*0.08,h*0.29),'让音乐在每一块屏幕上自然流动',h*0.045,DARK['sub'])
    draw_text(d,(w*0.08,h*0.40),'黑胶唱片视觉 · 歌词沉浸播放 · 跨端无缝同步',h*0.038,DARK['text'],bold=True)
    points=['桌面 + 移动全平台','深浅主题自由切换','歌单、搜索、歌词一体化体验']
    for i,p in enumerate(points):
        y=h*(0.54+i*0.09)
        d.ellipse([w*0.082,y,w*0.093,y+h*0.025], fill=rgba(DARK['red']))
        draw_text(d,(w*0.105,y-h*0.005),p,h*0.03,DARK['sub'])
    desk = compose_desktop_screenshot((int(w*0.46), int(h*0.68)), 'player', platform='mac')
    paste_rounded(base, desk, [int(w*0.5), int(h*0.16), int(w*0.96), int(h*0.84)], radius=int(h*0.03))
    phone = compose_mobile_store_shot((700,1400), '沉浸式播放界面', '黑胶动效与歌词同屏，听见每一句', 'player')
    ph = phone.resize((int(w*0.16), int(h*0.62)), Image.LANCZOS)
    base.alpha_composite(ph, (int(w*0.78), int(h*0.26)))
    return base


def save_flattened(img, filename):
    path = os.path.join(OUT_DIR, filename)
    bg = Image.new('RGB', img.size, rgba(DARK['bg'])[:3])
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    bg.paste(img, mask=img.getchannel('A'))
    bg.save(path, 'PNG', optimize=True)
    return path


def validate_sizes(paths):
    out=[]
    for p in paths:
        with Image.open(p) as im:
            out.append({'file': os.path.basename(p), 'width': im.width, 'height': im.height})
    return out


def main():
    outputs=[]
    # Icons
    icon_master = load_icon(1024)
    icon_sizes = {
        'lyco_music_icon_1024.png': (1024,1024), 'lyco_music_icon_512.png': (512,512),
        'lyco_music_icon_180.png': (180,180), 'lyco_music_icon_152.png': (152,152),
        'lyco_music_icon_167.png': (167,167), 'lyco_music_icon_120.png': (120,120),
        'lyco_music_icon_48.png': (48,48), 'lyco_music_icon_44.png': (44,44),
        'lyco_music_icon_50.png': (50,50), 'lyco_music_icon_150.png': (150,150),
        'lyco_music_icon_310.png': (310,310),
    }
    for fn,sz in icon_sizes.items():
        outputs.append(save_flattened(icon_master.resize(sz, Image.LANCZOS), fn))

    outputs.append(save_flattened(create_feature_graphic((1024,500)), 'google_play_feature_graphic_1024x500.png'))

    mobile_specs=[('home','首页推荐','懂你的每日推荐与最近播放'),('player','沉浸式播放界面','黑胶动效与歌词同屏，听见每一句'),('playlist','歌单广场','发现宝藏歌单，收藏喜欢的节奏'),('sync','好友与同步','桌面与移动无缝接力，收藏歌单实时同步'),('search','搜索','歌曲、歌手、专辑、歌词一键直达')]
    for i,(kind,title,sub) in enumerate(mobile_specs, start=1):
        outputs.append(save_flattened(compose_mobile_store_shot((1080,1920), title, sub, kind), f'google_play_phone_screenshot_{i}_1080x1920.png'))
    for i,(kind,title,sub) in enumerate(mobile_specs, start=1):
        outputs.append(save_flattened(compose_mobile_store_shot((1320,2868), title, sub, kind), f'apple_iphone_screenshot_{i}_1320x2868.png'))

    outputs.append(save_flattened(create_appstore_header((3840,1646)), 'apple_product_page_header_3840x1646.png'))

    desktop_kinds=['home','player','library']
    for i,kind in enumerate(desktop_kinds, start=1):
        outputs.append(save_flattened(compose_desktop_screenshot((2880,1800), kind, platform='mac'), f'mac_app_store_screenshot_{i}_2880x1800.png'))

    outputs.append(save_flattened(icon_master.resize((300,300), Image.LANCZOS), 'microsoft_store_logo_300x300.png'))
    tile = make_bg((310,150), dark=True)
    d=ImageDraw.Draw(tile)
    tile.alpha_composite(load_icon(110), (18,20))
    draw_text(d,(150,34),'Lyco Music',26,DARK['text'],bold=True)
    draw_text(d,(150,70),'Windows 音乐播放器',14,DARK['sub'])
    d.rounded_rectangle([150,94,292,122], radius=14, fill=rgba('#1B1B1B'))
    draw_text(d,(221,108),'黑胶 · 歌词 · 同步',12,DARK['sub'],anchor='mm')
    outputs.append(save_flattened(tile, 'microsoft_store_wide_tile_310x150.png'))
    outputs.append(save_flattened(icon_master.resize((44,44), Image.LANCZOS), 'microsoft_store_small_icon_44x44.png'))
    for i,kind in enumerate(desktop_kinds, start=1):
        outputs.append(save_flattened(compose_desktop_screenshot((1366,768), kind, platform='windows'), f'microsoft_store_screenshot_{i}_1366x768.png'))

    manifest = validate_sizes(outputs)
    man_path='/mnt/data/lyco_music_store_assets/manifest.json'
    with open(man_path,'w',encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    txt_path='/mnt/data/lyco_music_store_assets/README_assets.txt'
    with open(txt_path,'w',encoding='utf-8') as f:
        f.write('Lyco Music store listing assets\n\n')
        for row in manifest:
            f.write(f"{row['file']} - {row['width']}x{row['height']}\n")

    zip_path='/mnt/data/lyco_music_store_assets/lyco_music_store_listing_assets.zip'
    with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for p in outputs:
            z.write(p, arcname=os.path.basename(p))
        z.write(man_path, arcname='manifest.json')
        z.write(txt_path, arcname='README_assets.txt')
    print(f'Generated {len(outputs)} PNG files')
    print(zip_path)
    print(man_path)

if __name__ == '__main__':
    main()
