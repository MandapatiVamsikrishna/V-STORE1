"""
V-STORE — add extra product photos
==================================

1. Put photos in a folder named after the product, inside  assets/products/
       assets/products/Red Apples/1.jpg
       assets/products/Red Apples/2.jpg
   The folder can use the product's name (as shown on the site) or its ID (e.g. p-apple).
   See assets/products/README.md for every product's name and ID.
   Photos appear in file-name order (1.jpg, 2.jpg, 10.jpg ...). Use .jpg, .png or .webp.

2. Double-click  update-photos.bat  (or run:  python update-photos.py)
   This writes assets/products/photos.json, which the product pages read.

3. Commit and push:   git add -A   then   git commit -m "Add product photos"   then   git push

Only Python's standard library is needed.
"""
import difflib
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(ROOT, "assets", "products")
CATALOG = os.path.join(ROOT, "products.json")
MANIFEST = os.path.join(PHOTOS_DIR, "photos.json")
README = os.path.join(PHOTOS_DIR, "README.md")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
BIG_FILE_MB = 1.0
WINDOWS_BAD = '<>:"/\\|?*'


def key(text):
    """Loose match: 'Red Apples', 'red-apples', 'RED_APPLES' all match."""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "", text)


def natural(name):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def folder_name_for(product, duplicate_names):
    """The folder name we suggest in the README: the product name, or the ID if the name is shared."""
    if key(product["name"]) in duplicate_names:
        return product["id"]
    name = "".join(c for c in product["name"] if c not in WINDOWS_BAD).strip().rstrip(".")
    return name or product["id"]


def main():
    if not os.path.isfile(CATALOG):
        sys.exit("Can't find products.json — run this from the V-STORE folder.")
    with open(CATALOG, encoding="utf-8") as fh:
        products = json.load(fh)
    os.makedirs(PHOTOS_DIR, exist_ok=True)

    by_id = {key(p["id"]): p for p in products}
    by_name = {}
    for p in products:
        by_name.setdefault(key(p["name"]), []).append(p)
    duplicate_names = {k for k, v in by_name.items() if len(v) > 1}

    manifest, problems, big = {}, [], []
    for folder in sorted(os.listdir(PHOTOS_DIR), key=natural):
        path = os.path.join(PHOTOS_DIR, folder)
        if not os.path.isdir(path) or folder.startswith("."):
            continue
        k = key(folder)
        product = by_id.get(k)
        if product is None and k in by_name:
            matches = by_name[k]
            if len(matches) > 1:
                ids = ", ".join(m["id"] for m in matches)
                problems.append(f'"{folder}": {len(matches)} products have this name — rename the folder to one of these IDs: {ids}')
                continue
            product = matches[0]
        if product is None:
            close = difflib.get_close_matches(k, list(by_name) + list(by_id), n=3, cutoff=0.6)
            hint = ", ".join(sorted({(by_name.get(c) or [by_id.get(c)])[0]["name"] for c in close})) if close else "check assets/products/README.md"
            problems.append(f'"{folder}": no product with that name or ID (did you mean: {hint}?)')
            continue

        files = sorted((f for f in os.listdir(path) if os.path.splitext(f)[1].lower() in IMAGE_EXTS), key=natural)
        if not files:
            continue
        if product["id"] in manifest:
            problems.append(f'"{folder}": another folder already has photos for {product["name"]} — photos were added together')
        for f in files:
            size_mb = os.path.getsize(os.path.join(path, f)) / 1024 / 1024
            if size_mb > BIG_FILE_MB:
                big.append(f"{folder}/{f} ({size_mb:.1f} MB)")
            manifest.setdefault(product["id"], []).append(f"assets/products/{folder}/{f}")

    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(manifest.items())), fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    write_readme(products, manifest, duplicate_names)

    photo_count = sum(len(v) for v in manifest.values())
    print(f"Done: {photo_count} extra photo(s) for {len(manifest)} product(s) -> assets/products/photos.json")
    for line in problems:
        print("  ! " + line)
    if big:
        print(f"  ! {len(big)} photo(s) are over {BIG_FILE_MB:.0f} MB and will load slowly. Shrink them to about 1200 px wide, e.g.:")
        for line in big[:10]:
            print("      " + line)
    print("Next: git add -A, git commit -m \"Add product photos\", git push")


def write_readme(products, manifest, duplicate_names):
    rows = []
    for p in sorted(products, key=lambda x: (x["department"], x["name"].lower())):
        count = len(manifest.get(p["id"], []))
        rows.append(f'| {folder_name_for(p, duplicate_names)} | {p["id"]} | {p["name"]} | {p["department"]} | {count or ""} |')
    text = f"""# Extra product photos

Each product page shows a gallery: the product's main photo plus any photos you add here.

## How to add photos

1. Make a folder in `assets/products/` named after the product. Use the **Folder name** below. The ID works too.
2. Put the photos inside: `1.jpg`, `2.jpg`, `3.jpg` … They're shown in that order after the main photo.
3. Double-click **update-photos.bat** in the main V-STORE folder (or run `python update-photos.py`).
4. Commit and push. The photos appear on the live site about 2 minutes later.

Tips: square photos about 1200 × 1200 px and under 1 MB look best and load fast. JPG, PNG and WebP all work.
Until a product has its own extra photos, its page shows the main photo plus two close-up views.

A few products also show free sample photos from Wikimedia Commons, listed in `sample-photos.json` with
their photographer and licence (shown under the photo). Your own photos appear before them. To remove a
sample, delete its entry from that file. This script never changes `sample-photos.json`.

## Products ({len(products)})

| Folder name | ID | Product | Department | Extra photos |
|---|---|---|---|---|
""" + "\n".join(rows) + "\n"
    with open(README, "w", encoding="utf-8") as fh:
        fh.write(text)


if __name__ == "__main__":
    main()
