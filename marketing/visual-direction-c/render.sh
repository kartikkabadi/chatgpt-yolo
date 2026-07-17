#!/usr/bin/env bash
# Renders the Direction C concept HTML to final raster assets.
# Deterministic: fixed viewport, 2x supersample, LANCZOS downscale.
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"
# Real Chrome binary (the `google-chrome` shim only drives the desktop browser).
CHROME="${CHROME_BIN:-/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome}"

render() {
  local html="$1" w="$2" h="$3" out="$4"
  rm -f "$out"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
    --user-data-dir=/tmp/chrome-render-dirc \
    --force-device-scale-factor=2 --window-size="${w},${h}" \
    --screenshot="$out" "file://${DIR}/${html}" 2>/dev/null || true
}

render social-preview.html 1280 640 _social_2x.png
render hero.html 1536 864 _hero_2x.png

python3 - <<'PY'
from PIL import Image
# Social preview -> exact 1280x640 PNG, opaque
im = Image.open("_social_2x.png").convert("RGB").resize((1280,640), Image.LANCZOS)
im.save("social-preview-concept.png", "PNG", optimize=True)
# Hero -> 1536x864 WebP, opaque, optimized under 500KB
im = Image.open("_hero_2x.png").convert("RGB").resize((1536,864), Image.LANCZOS)
q = 90
im.save("hero-concept.webp", "WEBP", quality=q, method=6)
import os
while os.path.getsize("hero-concept.webp") > 500*1024 and q > 60:
    q -= 5
    im.save("hero-concept.webp", "WEBP", quality=q, method=6)
print("social-preview-concept.png", os.path.getsize("social-preview-concept.png"))
print("hero-concept.webp", os.path.getsize("hero-concept.webp"), "q=", q)
PY
rm -f _social_2x.png _hero_2x.png
echo "done"
