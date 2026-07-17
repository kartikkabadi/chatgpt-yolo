# Image production — launch static assets

Wave C repository image production for the YOLO for ChatGPT launch. This directory
generates the final, optimized, launch-ready static images that ship in
[`docs/assets/`](../../docs/assets/).

The visuals implement **Visual Direction A — "Instrument Panel"** (selected in
Wave B; see `marketing/visual-direction-a/DIRECTION.md` on
`origin/devin/wave-b-visual-a`): YOLO shown as a calm, disciplined instrument
panel built from the extension's own UI, on a warm off-white field with a faint
blueprint grid, using the product's real semantic status colors.

## Deliverables

| File | Dimensions | Format | Size | Budget | Purpose |
| --- | --- | --- | --- | --- | --- |
| `docs/assets/hero.webp` | 1536×864 | WebP (opaque) | ~56 KB | < 500 KB | README hero — queue + ChatGPT context in one glance |
| `docs/assets/social-preview.png` | 1280×640 | PNG (opaque) | ~187 KB | < 1 MB | Open Graph / social link preview |
| `docs/assets/demo-poster.webp` | 1920×1080 | WebP (opaque) | ~67 KB | < 500 KB | First video frame · X thumbnail · README demo cover · launch/release image |
| `docs/assets/yolo-mark.svg` | 128×128 (scalable) | SVG | ~0.6 KB | — | Source-quality brand mark (near-black rounded square + bold "Y") |

All raster outputs are RGB (no alpha) so social/link previews render on an opaque
background as required.

## Generation

```bash
pip install playwright pillow
python marketing/image-production/render.py
```

The script writes all raster assets into `docs/assets/`. Chromium is auto-detected
from the environment; override with `CHROME_BIN=/path/to/chrome` if needed. No
browser download is required when a system Chromium/Chrome is present.

### Pipeline

Static HTML + inline CSS (reusing the extension's design tokens)
→ headless Chromium at `device_scale_factor=2` (2× supersample)
→ Pillow Lanczos downscale to the exact target dimension (retina-grade edges)
→ optimized **WebP** (`quality=90, method=6`) / **PNG** (`optimize=True`).

Editing copy, queue contents, or status states is plain markup in the `src/`
files, so every asset is trivially reproducible and re-parametrizable (other
aspect ratios, localized variants, or a refreshed direction).

## Source files

```
marketing/image-production/
  render.py                 # render + downscale + optimize pipeline
  src/
    tokens.css              # design tokens copied verbatim from ../../styles.css :root
    hero.html               # 1536×864 hero composition
    social-preview.html     # 1280×640 social preview composition
    demo-poster.html        # 1920×1080 demo poster / video poster frame
```

`src/tokens.css` mirrors the extension's `styles.css` `:root` light-theme tokens
(`--canvas #f6f6f4`, `--text #181817`, `--success #24784b`, `--warning #9b640d`,
`--danger #b33232`, etc.). Keep it in sync if the product tokens change. Type is
the product's native system-UI stack with monospace reserved for
machine-meaningful tokens (slash commands, receipts, the `⌘/Ctrl ↵` hint, the
trust line).

## Staging disclosure

Live authenticated ChatGPT capture is unavailable, so the ChatGPT conversation
and YOLO panel shown in these assets are a **faithful, staged reconstruction**
built from the extension's real UI (`popup.html`, `styles.css`, `options.html`,
`onboarding.css`) and populated with **invented demonstration content** using the
brief's staged coding scenario (audit a repository, fix reliability gaps one by
one, validate, and stop). No real conversation, account, repository, token, or
personal data appears. No feature is fabricated: every control depicted
(numbered queue, `Sending`/`Queued` states, bounded `/goal` workflow with
`Turn 2 of 5` and Pause/Edit/Stop) reflects behavior the product actually ships.

**Product boundary preserved.** Where GitHub is referenced, the assets show an
`Optional · GitHub app connected to ChatGPT` chip — the GitHub app connects
directly to ChatGPT, never to YOLO. Slash commands carry a `YOLO ACTION` label so
they are not mistaken for native ChatGPT commands. No OpenAI logo, no fake GitHub
UI, and no implied endorsement.

## Scope

Marketing tooling only — no product/runtime code is modified. `node_modules`,
browser profiles, caches, and temporary frames are not committed.
