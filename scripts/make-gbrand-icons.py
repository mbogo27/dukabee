"""GBRAND favicon set: a square "G." (white on ink) with a thin Kenya-flag stripe along the bottom.
The wordmark is unreadable at 32px, so the icon is a monogram. Writes data/gbrand/brand/.
Uses Impact (condensed, close to Big Shoulders Display 900) and falls back to Pillow's default font."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'gbrand', 'brand')
os.makedirs(OUT, exist_ok=True)
INK, RED, GREEN, WHITE = '#121212', '#b81f2b', '#0c6b3b', '#ffffff'

def font(size):
    for f in ('C:/Windows/Fonts/impact.ttf', '/usr/share/fonts/truetype/impact.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def icon(px):
    S = px * 4  # draw large, then downsample for clean edges
    im = Image.new('RGB', (S, S), INK)
    d = ImageDraw.Draw(im)
    bar = max(4, round(S * 0.09))
    top = S - bar
    bands = [(INK, .28), (WHITE, .08), (RED, .28), (WHITE, .08), (GREEN, .28)]
    y = top
    for c, h in bands:
        y2 = y + bar * h
        d.rectangle([0, round(y), S, round(y2)], fill=c)
        y = y2
    f = font(round(S * 0.78))
    text = 'G.'
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    x = (S - (r - l)) / 2 - l
    yy = (top - (b - t)) / 2 - t
    d.text((x, yy), text, font=f, fill=WHITE)
    return im.resize((px, px), Image.LANCZOS)

for name, px in (('favicon-32.png', 32), ('favicon-192.png', 192), ('favicon-512.png', 512), ('apple-touch-icon.png', 180)):
    icon(px).save(os.path.join(OUT, name))
icon(64).save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
print('wrote', sorted(os.listdir(OUT)))
