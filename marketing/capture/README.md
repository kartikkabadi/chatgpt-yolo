# Deterministic product capture

This harness produces the five product screenshots in `docs/assets/` for the
YOLO for ChatGPT launch. It renders the extension's **real** UI — the same
HTML, CSS, JavaScript, icons, and design tokens that ship in the extension —
into a small, neutral chat surface, then captures optimized WebP screenshots.

It is isolated marketing tooling. It does **not** modify, depend on, or ship
with the extension runtime, and its dependencies are never bundled into the
extension.

## Staged-capture disclosure

Live, authenticated ChatGPT capture is not available in a clean automated
environment, so these screenshots use the brief's **staged fallback**:

- The extension UI is real and rendered from the repository source.
- The surrounding chat conversation, queue contents, workflow objective, and
  GitHub scene are **invented demonstration content** (`fixtures/scenario.json`).
- There is **no private data, no real ChatGPT conversation, no tokens, and no
  real GitHub credentials**. The GitHub scenes depict GitHub connected to
  ChatGPT (never to YOLO) and use no real repository chrome.
- Each screenshot carries a small "Staged demo · no live data" marker.
- Nothing shown is an impossible interaction or a fabricated feature; every
  state maps to real product behavior (queues, `/goal` and `/loop` workflows,
  the command palette, delivery receipts, and the settings page).

## What each screenshot uses

| Output (`docs/assets/`) | Real source rendered |
| --- | --- |
| `screenshot-queue.webp` | `popup.html` + `styles.css`; queue items built with the exact DOM shape from `popup.js` |
| `screenshot-command-palette.webp` | `command-ui.js` + `commands.js` mounted live (real palette, real command list) |
| `screenshot-workflow.webp` | `command-ui.js` + `commands.js` — real workflow bar and status dialog |
| `screenshot-github-workflow.webp` | `popup.html` + `styles.css`; staged GitHub-to-ChatGPT context |
| `screenshot-settings.webp` | `options.html` + `options.css` (real Advanced settings page) |

The popup is rendered inside a same-origin iframe so the extension's global
`html, body { width: 420px }` rule from `styles.css` stays scoped to the popup
and does not affect the surrounding scene. The command palette, workflow bar,
and status dialog are produced by calling the real `YOLOCommandUI.mount()`
entry point — not a re-implementation.

## Environment

- Node.js >= 20
- [`playwright`](https://playwright.dev) (Chromium) for rendering
- [`sharp`](https://sharp.pixelplumbing.com) for WebP encoding

Dependencies are declared in this directory's own `package.json`. `node_modules`
and the intermediate `output/` PNGs are git-ignored.

## Input fixtures

- `fixtures/scenario.json` — the single, coherent demonstration scenario shared
  across every screenshot (objective, queue steps, staged conversation turns,
  workflow state, and the GitHub scene). Edit this file to change the demo
  content; no code changes are required.
- `lib/surface.css` — marketing-only styling for the staged chat surface
  ("Instrument Panel", Visual Direction A). Its color tokens are copied verbatim
  from the extension's `styles.css` `:root` so the surface stays consistent with
  the real product. This file never ships with the extension.

## Regenerate

From this directory:

```bash
npm install
npx playwright install chromium
npm run capture
```

This writes the five `screenshot-*.webp` files to `docs/assets/` (each rendered
at 1440x900 @2x, downscaled and encoded to WebP under 350 KB). Intermediate
PNGs and generated scene HTML land in `output/` (git-ignored).

To only (re)generate the scene HTML without launching a browser — useful for
inspecting the composed markup:

```bash
npm run capture:scenes
```

## Notes

- Rendering is deterministic: fixed viewport, `reducedMotion`, sRGB color
  profile, light color scheme, and static content. Re-running produces the same
  screenshots.
- Alt text for each screenshot lives in `alt-text.md`.
- To capture real, live authenticated states in the future, replace the staged
  surface with a real ChatGPT capture in a clean profile and keep the same
  filenames and framing; the extension UI rendering is already faithful.
