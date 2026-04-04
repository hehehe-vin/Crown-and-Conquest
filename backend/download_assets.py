"""
download_assets.py  ·  Crown & Conquest – DAA-IV-T241
Run this ONCE on any machine to download all external assets.
After running, everything works fully offline.

Usage:
    python download_assets.py
"""

import os, requests, base64, re

STATIC = os.path.join(os.path.dirname(__file__), "static")
FONTS  = os.path.join(STATIC, "fonts")
os.makedirs(FONTS, exist_ok=True)

# ── Map image ────────────────────────────────────────────────
MAP_URL = (
    "https://lh3.googleusercontent.com/aida-public/"
    "AB6AXuDiRJOXm8KreCSMxoCsMCdJovSI1cKnKpwvWktTwuuwL99O99yyOOp9fDy7SYYwPlbst9dSzNnJZwGvv-"
    "VjinvPG9mfche-01By405NSzhewloGx5P30S7v6W2Yh_gxHjNEgLG-MvEDzNEhBvfv8V-5rFgyJOEyZcLb_MGsd1"
    "Irnv9c246zBUYyu8OGgXeY64We6rzUCXTGwE2hYv7mqQZTRjveyGeC3DsFbFa32Q0zGLlGLWUYqPuysdYhOkq5K1"
    "-rUmtFwNEsrnQ"
)

print("Downloading map image...", end=" ", flush=True)
try:
    r = requests.get(MAP_URL, timeout=20)
    r.raise_for_status()
    ct = r.headers.get("content-type", "image/jpeg")
    ext = "jpg" if "jpeg" in ct else "png" if "png" in ct else "jpg"
    map_path = os.path.join(STATIC, f"map.{ext}")
    with open(map_path, "wb") as f:
        f.write(r.content)
    print(f"✓  saved as static/map.{ext}  ({len(r.content)//1024} KB)")
except Exception as e:
    print(f"✗  FAILED: {e}")
    print("   → Place your map image manually at static/map.jpg")

# ── Google Fonts ─────────────────────────────────────────────
# We fetch the CSS with a desktop user-agent so Google returns woff2 URLs,
# then download each woff2 file and rewrite the CSS to use local paths.

FONT_SETS = [
    {
        "name": "cinzel_crimson_imfell",
        "css_file": "fonts/cinzel_crimson_imfell.css",
        "url": (
            "https://fonts.googleapis.com/css2?"
            "family=Cinzel:wght@400;600;700;900"
            "&family=Crimson+Text:ital,wght@0,400;0,600;1,400"
            "&family=IM+Fell+English:ital@0;1"
            "&display=swap"
        ),
    },
    {
        "name": "material_symbols",
        "css_file": "fonts/material_symbols.css",
        "url": (
            "https://fonts.googleapis.com/css2?"
            "family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD"
            "@20..48,100..700,0..1,-50..200"
            "&display=swap"
        ),
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

for fs in FONT_SETS:
    print(f"\nFetching font CSS: {fs['name']}...", end=" ", flush=True)
    try:
        css_r = requests.get(fs["url"], headers=HEADERS, timeout=15)
        css_r.raise_for_status()
        css_text = css_r.text
        print("✓")
    except Exception as e:
        print(f"✗  FAILED: {e}")
        continue

    # Find all woff2 URLs in the CSS
    woff_urls = re.findall(r'url\((https://[^)]+\.woff2[^)]*)\)', css_text)
    woff_urls = list(dict.fromkeys(woff_urls))  # deduplicate preserving order

    print(f"  Downloading {len(woff_urls)} font files...")
    for url in woff_urls:
        # Create a safe local filename from the URL
        fname = re.sub(r'[^a-zA-Z0-9_.-]', '_', url.split("/")[-1].split("?")[0])
        if not fname.endswith(".woff2"):
            fname += ".woff2"
        local_path = os.path.join(FONTS, fname)

        if os.path.exists(local_path):
            print(f"    skip (exists): {fname}")
            css_text = css_text.replace(url, f"/static/fonts/{fname}")
            continue

        try:
            fr = requests.get(url, headers=HEADERS, timeout=15)
            fr.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(fr.content)
            print(f"    ✓  {fname}  ({len(fr.content)//1024} KB)")
        except Exception as e:
            print(f"    ✗  {fname}  FAILED: {e}")
            continue

        # Rewrite CSS to point to local file
        css_text = css_text.replace(url, f"/static/fonts/{fname}")

    # Save rewritten CSS
    css_out = os.path.join(STATIC, fs["css_file"])
    with open(css_out, "w", encoding="utf-8") as f:
        f.write(css_text)
    print(f"  ✓  CSS saved: static/{fs['css_file']}")

# ── Summary ──────────────────────────────────────────────────
print("\n" + "="*56)
print("  Assets downloaded. Now update templates/index.html:")
print()
print("  Replace these two <link> tags:")
print("    <link href='https://fonts.googleapis.com/css2?family=Cinzel...'/>")
print("    <link href='https://fonts.googleapis.com/css2?family=Material...'/>")
print()
print("  With these:")
print("    <link href='/static/fonts/cinzel_crimson_imfell.css' rel='stylesheet'/>")
print("    <link href='/static/fonts/material_symbols.css' rel='stylesheet'/>")
print()
print("  And replace the map <img> src with:")
print("    <img id='map-bg-img' src='/static/map.jpg' alt='Napoleonic Europe Map'/>")
print("="*56)
