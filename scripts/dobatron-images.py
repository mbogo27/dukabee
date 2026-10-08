"""Import product photos for a v2 storefront (Dobatron by default).

    python scripts/dobatron-images.py <source folder> [--store dobatron]

Source files are named after the model: <modelId>-01.jpg, <modelId>-02.png, ... (any of jpg/jpeg/png/webp, any
subfolder). A name that doesn't end in -NN (e.g. hp-zbook-firefly-14-g8-i7-32gb-front.png) is matched to the model
whose id it starts with and numbered in order, "front" first. Every photo is converted to WebP (max 1200px, no
upscaling) into data/<store>/images/, and models.json is updated: each model's `images` lists its own photos, or
borrows another model's (data/<store>/image-standins.json) and is marked `standIn` until its own arrive.
The tint/glyph placeholder stays on each image, as the fallback. Needs Pillow (pip install Pillow).
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MAX = 1200
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def main():
    args = sys.argv[1:]
    store = "dobatron"
    if "--store" in args:
        i = args.index("--store")
        store = args[i + 1]
        del args[i:i + 2]
    if not args:
        sys.exit(__doc__)
    src = Path(args[0]).resolve()
    data = ROOT / "data" / store
    out_dir = data / "images"
    out_dir.mkdir(exist_ok=True)
    models_doc = json.loads((data / "models.json").read_text(encoding="utf-8"))
    models = models_doc["models"]
    ids = sorted((m["modelId"] for m in models), key=len, reverse=True)
    stand_ins = json.loads((data / "image-standins.json").read_text(encoding="utf-8"))["standIns"]

    # 1. Match source files to models.
    found = {}
    unmatched = []
    for f in sorted(p for p in src.rglob("*") if p.suffix.lower() in EXTS):
        stem = f.stem.lower()
        model_id = next((i for i in ids if stem == i or stem.startswith(i + "-")), None)
        if not model_id:
            unmatched.append(f.name)
            continue
        m = re.search(r"-(\d{2})$", stem)
        rank = (0, int(m.group(1))) if m else (1, 0 if "front" in stem else 1 if "side" in stem else 2 if "back" in stem else 3, stem)
        found.setdefault(model_id, []).append((rank, f))

    # 2. Convert to WebP, numbered per model.
    written = {}
    for model_id, files in found.items():
        written[model_id] = []
        for n, (_, f) in enumerate(sorted(files, key=lambda x: x[0]), start=1):
            im = Image.open(f)
            im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") and "transparency" in im.info or im.mode == "RGBA" else "RGB")
            im.thumbnail((MAX, MAX))
            name = f"{model_id}-{n:02d}.webp"
            im.save(out_dir / name, "WEBP", quality=82, method=6)
            written[model_id].append({"file": name, "width": im.width, "height": im.height, "from": f.name})

    # 3. Point each model at its photos (or a stand-in's).
    by_id = {m["modelId"]: m for m in models}
    report = []
    for m in models:
        placeholder = m["images"][0].get("placeholder") if m.get("images") else {"tint": "#E8E6E1", "glyph": ""}
        own = written.get(m["modelId"])
        donor = None if own else stand_ins.get(m["modelId"])
        shots = own or written.get(donor) or []
        if donor and not shots:
            report.append(f"  ! {m['modelId']}: stand-in {donor} has no photos either")
        m["images"] = [
            {
                "id": f"{m['modelId']}-{i:02d}",
                **({"src": f"/images/{s['file']}", "width": s["width"], "height": s["height"]} if s else {}),
                "alt": m["name"],
                "placeholder": placeholder,
                **({"standIn": donor} if donor and s else {}),
            }
            for i, s in enumerate(shots or [None], start=1)
        ]
        report.append(f"  {'✓' if own else '~' if shots else '✗'} {m['modelId']}: " + (f"{len(own)} photo(s)" if own else f"stand-in from {donor}" if shots else "placeholder only"))

    # Remove WebPs no longer produced from the source (e.g. a renamed file).
    keep = {s["file"] for v in written.values() for s in v}
    for old in out_dir.glob("*.webp"):
        if old.name not in keep:
            old.unlink()

    (data / "models.json").write_text(json.dumps(models_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    own_n = sum(1 for m in models if m["modelId"] in written)
    print(f"{sum(len(v) for v in written.values())} photos for {own_n} models → data/{store}/images/")
    print("\n".join(report))
    if unmatched:
        print("Not matched to any model (rename to <modelId>-01.ext):", ", ".join(unmatched))
    missing = [m["modelId"] for m in models if "src" not in m["images"][0]]
    if missing:
        print("Still placeholder only:", ", ".join(missing))


if __name__ == "__main__":
    main()
