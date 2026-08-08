"""產生 RT 隨身站 App 圖示 (PNG)。重跑即可重新產生。"""
from PIL import Image, ImageDraw, ImageFont
import os, math

HERE = os.path.dirname(os.path.abspath(__file__))
TEAL = (15, 118, 110)
TEAL2 = (13, 148, 136)
WHITE = (255, 255, 255)


def vgrad(size, top, bot):
    img = Image.new("RGB", (size, size), top)
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        for x in range(size):
            pass
        img.paste((r, g, b), (0, y, size, y + 1))
    return img


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def draw_lungs(d, cx, cy, s, color):
    """簡化肺部符號：中央氣管 + 兩側肺葉。"""
    lw = max(2, int(s * 0.09))
    # 氣管
    d.line([(cx, cy - s * 0.75), (cx, cy - s * 0.05)], fill=color, width=lw)
    d.ellipse([cx - s * 0.12, cy - s * 0.9, cx + s * 0.12, cy - s * 0.66], outline=color, width=lw)
    # 左右肺（用弧線近似）
    for sgn in (-1, 1):
        pts = []
        for i in range(0, 41):
            t = i / 40
            ang = math.pi * (0.15 + 0.7 * t)  # 從上往下外擴
            x = cx + sgn * (s * 0.15 + s * 0.62 * math.sin(ang))
            y = cy - s * 0.45 + s * 1.15 * t
            pts.append((x, y))
        d.line(pts, fill=color, width=lw, joint="curve")
        # 連回氣管底
        d.line([(cx + sgn * s * 0.05, cy - s * 0.05), pts[0]], fill=color, width=lw)
        d.line([pts[-1], (cx + sgn * s * 0.22, cy + s * 0.7)], fill=color, width=lw)


def make(size, maskable=False):
    ss = size * 4  # supersample
    img = vgrad(ss, TEAL, TEAL2).convert("RGBA")
    d = ImageDraw.Draw(img)
    pad = ss * (0.20 if maskable else 0.0)  # maskable 留安全區
    s = (ss - 2 * pad) * 0.34
    draw_lungs(d, ss / 2, ss / 2 - ss * 0.02, s, WHITE)
    # 底部 "RT" 字樣
    try:
        font = ImageFont.truetype("arialbd.ttf", int(ss * 0.14))
    except Exception:
        font = ImageFont.load_default()
    txt = "RT"
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((ss - tw) / 2 - bbox[0], ss * 0.72 - bbox[1]), txt, font=font, fill=WHITE)

    img = img.resize((size, size), Image.LANCZOS)
    if not maskable:
        radius = int(size * 0.22)
        mask = rounded_mask(size, radius)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out
    return img


for sz in (192, 512):
    make(sz).save(os.path.join(HERE, f"icon-{sz}.png"))
    make(sz, maskable=True).save(os.path.join(HERE, f"icon-maskable-{sz}.png"))
print("icons written:", os.listdir(HERE))
