"""Build the Duka Bee brand assets from the Taskbee bee logo (brand-src/taskbee-logo-light.jpg).
Needs Pillow. Output goes to web/ (served from the site root): transparent bee marks + favicons."""
from PIL import Image, ImageDraw, ImageFilter
import os

SRC = 'brand-src/taskbee-logo-light.jpg'
OUT = 'web/brand'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')

# Knock the white background out: flood-fill from every edge over near-white pixels only, so the white
# eyes and grey wings inside the outline stay opaque. Then feather the edge by a pixel.
w, h = im.size
mask = Image.new('L', (w, h), 255)
bg = im.copy()
MARK = (255, 0, 255)
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
    if all(c > 225 for c in bg.getpixel(seed)):
        ImageDraw.floodfill(bg, seed, MARK, thresh=40)
px = bg.load()
m = mask.load()
for y in range(h):
    for x in range(w):
        if px[x, y] == MARK:
            m[x, y] = 0
mask = mask.filter(ImageFilter.GaussianBlur(1.1))
rgba = im.convert('RGBA')
rgba.putalpha(mask)

# Crop to the bee with a little breathing room, keep it square.
bbox = mask.point(lambda v: 255 if v > 20 else 0).getbbox()
x0, y0, x1, y1 = bbox
side = max(x1 - x0, y1 - y0)
pad = int(side * 0.04)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
half = side // 2 + pad
crop = rgba.crop((cx - half, cy - half, cx + half, cy + half))

def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}', optimize=True)

save(crop, 'bee-256.png', 256)
save(crop, 'favicon-32.png', 32)
save(crop, 'favicon-192.png', 192)

# iOS home-screen icon: opaque cream tile with the bee centred.
tile = Image.new('RGBA', (180, 180), (250, 247, 239, 255))
bee = crop.resize((148, 148), Image.LANCZOS)
tile.alpha_composite(bee, (16, 16))
tile.convert('RGB').save(f'{OUT}/apple-touch-icon.png', optimize=True)

# Classic /favicon.ico for browsers that ask for it by default (16, 32, 48).
ico = crop.resize((256, 256), Image.LANCZOS)
ico.save('web/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('wrote', sorted(os.listdir(OUT)), 'and web/favicon.ico')
