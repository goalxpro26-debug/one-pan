#!/usr/bin/env python3
"""One Pan - all art drawn in code with PIL. No AI images, no downloads.
Original food-court theme, seen from straight above: a dark grill top on a
warm wooden counter, checkered floor where the customers queue, a neon
stall sign, and top-down food icons (shape + colour, so every food reads
at a glance). Outputs PNGs into art/ (project root is the parent of tools/).
"""
import glob
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(os.path.dirname(HERE), "art")
os.makedirs(ART, exist_ok=True)

rng = random.Random(20261123)

S = 128  # food canvas


def save(img, name):
    p = os.path.join(ART, name)
    img.save(p, "PNG")
    print("wrote", p, img.size)


def circle(d, cx, cy, r, fill, outline=None, width=1):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill,
              outline=outline, width=width)


def find_font(size):
    for pat in ("/usr/share/fonts/**/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/**/LiberationSans-Bold.ttf"):
        for p in sorted(glob.glob(pat, recursive=True)):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


# ------------------------------------------------------------------- foods --

def grill_marks(d, cx, cy, angle, color=(60, 30, 20, 255)):
    # three dark stripes across the food, slightly rotated
    for off in (-18, 0, 18):
        x0 = cx - 42
        x1 = cx + 42
        y = cy + off
        d.line([(x0, y - 6), (x1, y + 6)], fill=color, width=6)


def icon_sausage(d, cx, cy):
    # a curved sausage link, top-down
    pts = []
    for k in range(25):
        a = math.pi * 0.15 + k * (math.pi * 0.7) / 24
        pts.append((cx + 38 * math.cos(a), cy + 26 * math.sin(a) - 6))
    d.line(pts, fill=(165, 70, 40, 255), width=26, joint="curve")
    d.line(pts, fill=(205, 105, 60, 255), width=16, joint="curve")
    # grill marks across the curve
    for (x, y) in [(cx - 26, cy - 16), (cx, cy - 24), (cx + 26, cy - 16)]:
        d.line([(x - 5, y - 7), (x + 5, y + 7)], fill=(90, 40, 20, 255), width=5)


def icon_steak(d, cx, cy):
    d.ellipse([cx - 40, cy - 30, cx + 40, cy + 30],
              fill=(150, 55, 45, 255), outline=(90, 30, 25, 255), width=4)
    # fat edge along the top
    d.arc([cx - 40, cy - 30, cx + 40, cy + 30], 200, 340,
          fill=(250, 225, 190, 255), width=9)
    grill_marks(d, cx, cy, 0)
    circle(d, cx - 12, cy - 6, 4, (200, 90, 70, 255))
    circle(d, cx + 14, cy + 8, 4, (200, 90, 70, 255))


def icon_corn(d, cx, cy):
    # cob lying flat, kernels in rows, husk at both ends
    d.rounded_rectangle([cx - 34, cy - 16, cx + 34, cy + 16], radius=14,
                        fill=(250, 210, 60, 255), outline=(200, 150, 20, 255), width=3)
    for r in range(-1, 2):
        for c in range(-3, 4):
            circle(d, cx + c * 9, cy + r * 9, 3, (220, 170, 30, 255))
    d.polygon([(cx - 34, cy - 16), (cx - 52, cy - 4), (cx - 34, cy + 16)],
              fill=(90, 170, 80, 255), outline=(50, 120, 50, 255))
    d.polygon([(cx + 34, cy - 16), (cx + 52, cy - 4), (cx + 34, cy + 16)],
              fill=(90, 170, 80, 255), outline=(50, 120, 50, 255))


def icon_fish(d, cx, cy):
    # whole fish from above: body, tail, fin, eye
    d.polygon([(cx + 30, cy), (cx + 54, cy - 18), (cx + 54, cy + 18)],
              fill=(110, 150, 180, 255), outline=(60, 90, 120, 255))
    d.ellipse([cx - 42, cy - 20, cx + 34, cy + 20],
              fill=(150, 190, 215, 255), outline=(60, 90, 120, 255), width=3)
    d.ellipse([cx - 8, cy - 20, cx + 14, cy - 2],
              fill=(110, 150, 180, 255))
    circle(d, cx - 28, cy - 4, 4, (30, 40, 55, 255))
    d.arc([cx - 20, cy + 2, cx + 6, cy + 18], 10, 170,
          fill=(60, 90, 120, 255), width=3)


def icon_patty(d, cx, cy):
    circle(d, cx, cy, 38, (125, 75, 40, 255), (80, 45, 20, 255), 4)
    circle(d, cx, cy, 30, (150, 95, 50, 255))
    grill_marks(d, cx, cy, 0, color=(70, 40, 18, 255))
    circle(d, cx - 10, cy - 8, 5, (190, 130, 80, 255))
    circle(d, cx + 12, cy + 10, 4, (190, 130, 80, 255))


FOODS = [
    ("sausage", icon_sausage),
    ("steak", icon_steak),
    ("corn", icon_corn),
    ("fish", icon_fish),
    ("patty", icon_patty),
]


def make_food(name, draw_icon):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([14, 18, S - 14, S - 10],
                               fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(4))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    draw_icon(d, S // 2, S // 2 + 2)
    save(img, f"food_{name}.png")


for _n, _f in FOODS:
    make_food(_n, _f)


# -------------------------------------------------------------------- pan --

def make_pan():
    S2 = 256
    img = Image.new("RGBA", (S2, S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = 118, 128
    # handle
    d.rounded_rectangle([cx + 78, cy - 14, 246, cy + 14], radius=12,
                        fill=(45, 45, 50, 255), outline=(20, 20, 25, 255), width=3)
    circle(d, 232, cy, 6, (20, 20, 25, 255))
    # body
    circle(d, cx, cy, 96, (45, 45, 50, 255), (20, 20, 25, 255), 5)
    circle(d, cx, cy, 82, (70, 70, 78, 255))
    circle(d, cx, cy, 70, (95, 95, 105, 255))
    # seasoning sheen
    d.arc([cx - 52, cy - 52, cx + 52, cy + 52], 200, 330,
          fill=(160, 160, 175, 255), width=6)
    save(img, "pan.png")


make_pan()


# --------------------------------------------------------------- customers --

CUST_COLOURS = [
    (45, 165, 190),    # teal
    (240, 110, 110),   # coral
    (240, 190, 60),    # mustard
    (165, 125, 215),   # lavender
]


def make_cust(idx, colour):
    S2 = 96
    img = Image.new("RGBA", (S2, S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = S2 // 2, S2 // 2 + 4
    sh = Image.new("RGBA", (S2, S2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - 38, cy - 32, cx + 38, cy + 42],
                               fill=(0, 0, 0, 60))
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    circle(d, cx, cy, 38, colour + (255,), (40, 30, 30, 255), 3)
    # face
    circle(d, cx - 13, cy - 4, 5, (40, 30, 30, 255))
    circle(d, cx + 13, cy - 4, 5, (40, 30, 30, 255))
    d.arc([cx - 12, cy + 6, cx + 12, cy + 20], 15, 165,
          fill=(40, 30, 30, 255), width=3)
    # hair tuft
    d.arc([cx - 12, cy - 46, cx + 12, cy - 22], 180, 360,
          fill=(40, 30, 30, 255), width=5)
    save(img, f"cust_{idx}.png")


for _i, _c in enumerate(CUST_COLOURS, start=1):
    make_cust(_i, _c)


# ------------------------------------------------------------------- bits --

def make_dot(name, size, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    circle(d, size // 2, size // 2, size // 2 - 1, color)
    save(img, name)


make_dot("particle.png", 32, (255, 255, 255, 255))


def make_star():
    S2 = 96
    img = Image.new("RGBA", (S2, S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S2 // 2
    pts = []
    for k in range(10):
        r = 42 if k % 2 == 0 else 18
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=(255, 200, 60, 255), outline=(220, 150, 20, 255))
    save(img, "star.png")


def make_lock():
    W2, H2 = 64, 80
    img = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 34, 54, 72], radius=8,
                        fill=(90, 100, 120, 255), outline=(50, 60, 80, 255), width=3)
    d.arc([18, 10, 46, 44], 180, 360, fill=(50, 60, 80, 255), width=7)
    circle(d, 32, 50, 7, (255, 220, 90, 255))
    d.rectangle([29, 50, 35, 62], fill=(255, 220, 90, 255))
    save(img, "lock.png")


make_star()
make_lock()


# -------------------------------------------------------------- background --
# PIL y is down; GUI y is up (GUI y = 640 - PIL y).
# Top strip (PIL 0-64) = GUI 576-640: neon stall sign.
# Wooden counter (PIL 64-470) with the dark grill top (PIL 170-310).
# Checkered floor (PIL 470-640) where customers queue (GUI y ~120).

def make_bg():
    W, H = 1136, 640
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    # wooden counter planks
    plank_cols = [(172, 118, 66), (160, 108, 58), (178, 124, 70)]
    for y0 in range(64, 470, 58):
        col = plank_cols[(y0 // 58) % 3]
        d.rectangle([0, y0, W, y0 + 58], fill=col)
        d.line([(0, y0), (W, y0)], fill=(120, 78, 40), width=3)
        # plank seams
        for x in range(rng.randint(120, 300), W, rng.randint(280, 420)):
            d.line([(x, y0 + 3), (x, y0 + 55)], fill=(120, 78, 40), width=2)
    # dark grill top behind the slots (PIL x 180-960, y 170-310)
    d.rounded_rectangle([180, 170, 960, 310], radius=18,
                        fill=(38, 38, 44))
    d.rounded_rectangle([188, 178, 952, 302], radius=14,
                        outline=(70, 70, 78), width=2)
    for y in range(196, 300, 16):
        d.line([(196, y), (944, y)], fill=(58, 58, 66), width=3)
    # checkered floor
    cell = 58
    for row in range(470, H, cell):
        for col in range(0, W, cell):
            even = ((row - 470) // cell + col // cell) % 2 == 0
            d.rectangle([col, row, col + cell, row + cell],
                        fill=(245, 232, 205) if even else (205, 90, 70))
    # floor grout
    for y in range(470, H, cell):
        d.line([(0, y), (W, y)], fill=(190, 170, 140), width=2)
    # top strip: dark teal + neon sign
    d.rectangle([0, 0, W, 64], fill=(16, 42, 48))
    d.rectangle([0, 60, W, 64], fill=(255, 200, 90))
    # neon glow behind the sign board
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([330, -30, 810, 90], fill=(255, 80, 160))
    glow = glow.filter(ImageFilter.GaussianBlur(24))
    img = Image.blend(img, Image.blend(img, glow, 0.55), 0.5)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([380, 8, 760, 56], radius=10,
                        fill=(30, 30, 38), outline=(255, 200, 90), width=3)
    font = find_font(30)
    d.text((570, 32), "ONE PAN", font=font, fill=(255, 220, 100),
           anchor="mm")
    # rival stall awning, top right of the counter (PIL x 950-1120, y 84-128)
    for i, x0 in enumerate(range(950, 1120, 34)):
        d.rectangle([x0, 84, x0 + 34, 128],
                    fill=(220, 60, 60) if i % 2 == 0 else (250, 240, 220))
    d.rectangle([950, 122, 1120, 130], fill=(120, 40, 40))
    font2 = find_font(20)
    d.text((1035, 152), "RIVAL", font=font2, fill=(255, 255, 255),
           anchor="mm", stroke_width=2, stroke_fill=(120, 40, 40))
    save(img.convert("RGBA"), "background.png")


make_bg()
print("art done")
