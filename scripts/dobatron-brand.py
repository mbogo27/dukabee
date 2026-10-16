"""Prepare Dobatron's logo and favicon for the web.

    python scripts/dobatron-brand.py logo.png favicon.png

Writes data/dobatron/brand/:
  logo.png          wordmark on a transparent background, for the light header
  logo-light.png    same, with the navy lettering turned light, for the dark footer (yellow kept)
  favicon-32.png, favicon-48.png, favicon.ico, icon-192.png, icon-512.png   the round icon, transparent outside the circle
  apple-touch-icon.png   180px on white (iOS doesn't use transparency)
Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "dobatron" / "brand"
LIGHT = (247, 245, 240)  # the site's paper colour


def unwhite(im):
    """Turn a white background into transparency, un-blending anti-aliased edges so they stay crisp."""
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            a = max(0.0, min(1.0, (255 - min(r, g, b)) / 200))
            if a == 0:
                px[x, y] = (255, 255, 255, 0)
                continue
            un = lambda c: max(0, min(255, round((c - 255 * (1 - a)) / a)))
            px[x, y] = (un(r), un(g), un(b), round(a * 255))
    return im.crop(im.getbbox())


def lighten(im):
    """Navy lettering → light; the yellow power stroke stays yellow."""
    im = im.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and not (r > 150 and g > 110 and b < 120):
                px[x, y] = (*LIGHT, a)
    return im


def round_icon(im):
    """Keep only the circle (the power symbol's white ring stays white), transparent outside it."""
    im = im.convert("RGB")
    gray = im.convert("L").point(lambda v: 255 if v < 235 else 0)
    l, t, r, b = gray.getbbox()
    side = max(r - l, b - t)
    cx, cy = (l + r) / 2, (t + b) / 2
    box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
    sq = im.crop(box).convert("RGBA")
    ss = 4  # supersampled mask for a smooth edge
    mask = Image.new("L", (sq.width * ss, sq.height * ss), 0)
    ImageDraw.Draw(mask).ellipse((ss, ss, sq.width * ss - ss, sq.height * ss - ss), fill=255)
    sq.putalpha(mask.resize(sq.size, Image.LANCZOS))
    return sq


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    logo = unwhite(Image.open(sys.argv[1]))
    h = 96  # shown at up to 40px tall: 2x+ for sharp screens
    logo = logo.resize((round(logo.width * h / logo.height), h), Image.LANCZOS)
    logo.save(OUT / "logo.png", optimize=True)
    lighten(logo).save(OUT / "logo-light.png", optimize=True)

    icon = round_icon(Image.open(sys.argv[2]))
    for size, name in [(32, "favicon-32.png"), (48, "favicon-48.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        icon.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    icon.resize((256, 256), Image.LANCZOS).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    touch = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
    small = icon.resize((164, 164), Image.LANCZOS)
    touch.alpha_composite(small, (8, 8))
    touch.convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    for f in sorted(OUT.iterdir()):
        im = Image.open(f)
        print(f"  {f.name:22} {im.size[0]}x{im.size[1]}  {f.stat().st_size // 1024 or 1}KB")
    print(f"logo aspect ratio {logo.width}:{logo.height}")


if __name__ == "__main__":
    main()
