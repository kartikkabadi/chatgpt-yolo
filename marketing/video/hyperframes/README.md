# HyperFrames — YOLO for ChatGPT launch video

Isolated Wave C HyperFrames project that produces the *YOLO for ChatGPT* launch
video from **Visual Direction A + Motion Storyboard A**. Two deliverables are
rendered from a single shared design system (tokens, components, copy, timeline):

| Output | Composition | Dimensions | Notes |
| --- | --- | --- | --- |
| `yolo-launch-16x9.mp4` | [`index.html`](./index.html) | 1920×1080 | primary landscape cut |
| `yolo-launch-square.mp4` | [`square/index.html`](./square/index.html) | 1080×1080 | true 1:1 recomposition (not a crop) |

Both are **44.5 s · 30 fps · H.264 (High) · yuv420p · fast-start · no audio**.

The square build is a genuine recomposition: every scene is re-laid-out
vertically for a 1:1 frame (see [`square/square.css`](./square/square.css)); it
reuses the same copy, tokens, component markup, and GSAP timeline as the 16:9
cut, so the two never drift.

**This tooling is fully isolated from the extension runtime** — separate
`package.json`, no root-level framework, no `node_modules` committed, and no
extension code changes.

- The 7-scene composition + timeline: [`index.html`](./index.html) (styles in
  [`launch.css`](./launch.css))
- Original 7.6 s framework spike (evidence, preserved): [`spike/index.html`](./spike/index.html),
  [`spike.mp4`](./spike.mp4), [`SPIKE_REPORT.md`](./SPIKE_REPORT.md)
- Real-UI capture harness: [`source/capture-popup.html`](./source/capture-popup.html)
  + [`scripts/capture.mjs`](./scripts/capture.mjs)

## Quick start

```bash
nvm use 22            # Node >= 22 required
npm install

npm run lint          # hyperframes lint .          (16:9 composition)
npm run inspect       # hyperframes inspect .        (layout + transition seams)
npm run validate      # hyperframes validate .       (console errors + WCAG AA)
npm run render:16x9   # -> yolo-launch-16x9.mp4

npm run lint:square && npm run inspect:square && npm run validate:square
npm run render:square # -> yolo-launch-square.mp4

npm run render:spike  # -> spike.mp4 (reproduce the preserved framework spike)
```

Optional fast render path (recommended on machines >8 GB RAM):

```bash
npx @puppeteer/browsers install chrome-headless-shell
export HYPERFRAMES_BROWSER_PATH="$PWD/$(ls chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell)"
```

**Requirements:** Node.js ≥22, FFmpeg, a Chrome/Chromium binary. The CLI's
anonymous telemetry is on by default — run `npx hyperframes telemetry disable`.

## Provenance & staged-capture disclosure

Every on-screen surface is **staged from the real extension's design system** —
the design tokens, component structure, slash-command copy (`commands.js`), and
queue/workflow labels (`popup.html`) are copied from the product so the video
reflects true product states. The scenes are **rendered HTML mockups**, not
screen recordings of a live ChatGPT session, and the conversations shown are
**invented demo scenarios** — no live ChatGPT capture, no real account, and no
private or personal data are used (see the disclosure comment in
[`source/capture-popup.html`](./source/capture-popup.html)).

Product-truth guarantees enforced by the composition:

- Slash actions are labeled as **YOLO commands**, with a pinned
  *"YOLO command · not a native ChatGPT command"* footnote (Scene 3).
- The workflow is **visibly bounded** (`iteration 2/4`) and **pauses** — it never
  implies an endless or fully autonomous loop (Scene 4).
- Scene 5 uses a **generic connected-app chip**, not fake GitHub UI, with a
  pinned boundary label: *"Optional GitHub app · Connected directly to ChatGPT"*.
  YOLO is never shown owning GitHub access.
- The end card states *"Independent project. Not affiliated with OpenAI."* — no
  OpenAI endorsement is implied anywhere.
- No audio track; the cut is designed to read fully muted.

Verification artifacts live in [`../renders/`](../renders/) (contact sheet +
per-scene / per-transition frame samples) and alongside the videos
(`*.ffprobe.json`, `SHA256SUMS.txt`).
