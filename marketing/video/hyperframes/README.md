# HyperFrames spike — launch video framework evaluation

Isolated Wave C technical spike evaluating [HyperFrames](https://github.com/heygen-com/hyperframes)
for the *YOLO for ChatGPT* launch video. Builds a 7.6 s representative sequence
(Storyboard A **Scene 2 — Queue** + **Scene 4 — Bounded workflow**) and renders it
to `spike.mp4`.

**This tooling is fully isolated from the extension runtime** — separate
`package.json`, no root-level framework, no `node_modules` committed, and no
extension code changes.

- Findings, evidence, and the framework recommendation: **[`SPIKE_REPORT.md`](./SPIKE_REPORT.md)**
- The composition: [`index.html`](./index.html)
- Real-UI capture harness: [`source/capture-popup.html`](./source/capture-popup.html) + [`scripts/capture.mjs`](./scripts/capture.mjs)

## Quick start

```bash
nvm use 22            # Node >= 22 required
npm install
npm run capture       # (re)generate public/screenshot-queue.png from the real extension UI
npm run lint          # hyperframes lint .
npm run inspect       # hyperframes inspect .  (timeline layout check)
npm run render        # -> spike.mp4  (1920x1080, H.264, yuv420p, 30fps, faststart)
```

Optional fast render path (recommended on machines >8 GB RAM):

```bash
npx @puppeteer/browsers install chrome-headless-shell
export HYPERFRAMES_BROWSER_PATH="$PWD/$(ls chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell)"
```

**Requirements:** Node.js ≥22, FFmpeg, a Chrome/Chromium binary. The CLI's
anonymous telemetry is on by default — run `npx hyperframes telemetry disable`.
