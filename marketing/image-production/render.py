#!/usr/bin/env python3
"""
Render the launch-ready static images for YOLO for ChatGPT (Visual Direction A).

Pipeline: static HTML + inline CSS (reusing the extension's design tokens)
-> headless Chromium at device_scale_factor=2 (2x supersample)
-> Pillow Lanczos downscale to the target dimension (retina-grade edges)
-> optimized WebP (quality=90, method=6) / PNG (optimize).

Usage:
    pip install playwright pillow
    python marketing/image-production/render.py

Chromium is auto-detected from the environment; override with the
CHROME_BIN environment variable if needed.
"""
import io
import os
import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "src"
OUT = HERE.parent.parent / "docs" / "assets"
SCALE = 2  # supersample factor

# name, source html, (width, height), output filename, format
TARGETS = [
    ("hero",           "hero.html",           (1536, 864),  "hero.webp",           "webp"),
    ("social-preview", "social-preview.html", (1280, 640),  "social-preview.png",  "png"),
    ("demo-poster",    "demo-poster.html",    (1920, 1080), "demo-poster.webp",    "webp"),
]

CHROME_CANDIDATES = [
    os.environ.get("CHROME_BIN"),
    "/opt/.devin/playwright_browsers/chromium-1097/chrome-linux/chrome",
    "/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome",
    "/usr/bin/google-chrome",
]


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and pathlib.Path(c).exists():
            return c
    return None  # fall back to Playwright's bundled browser


def render():
    OUT.mkdir(parents=True, exist_ok=True)
    exe = find_chrome()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe, args=["--force-color-profile=srgb"])
        for name, html, (w, h), outfile, fmt in TARGETS:
            page = browser.new_page(
                viewport={"width": w, "height": h}, device_scale_factor=SCALE
            )
            page.goto((SRC / html).as_uri())
            page.wait_for_timeout(250)
            raw = page.screenshot(clip={"x": 0, "y": 0, "width": w, "height": h})
            page.close()

            img = Image.open(io.BytesIO(raw)).convert("RGB")
            img = img.resize((w, h), Image.LANCZOS)
            dest = OUT / outfile
            if fmt == "webp":
                img.save(dest, "WEBP", quality=90, method=6)
            else:
                img.save(dest, "PNG", optimize=True)
            kb = dest.stat().st_size / 1024
            print(f"{name:14s} -> {dest.relative_to(OUT.parent.parent)}  {w}x{h}  {kb:.0f} KB")
        browser.close()


if __name__ == "__main__":
    render()
