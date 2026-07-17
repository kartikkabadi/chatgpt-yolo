# marketing/video/remotion — Remotion spike

Isolated marketing tooling for the launch-video **Remotion technical spike** (Wave C).
This directory is **not** part of the extension runtime and must never be bundled into `dist/yolo`
or added to the root/extension dependency model. It has its own `package.json`.

See **`SPIKE_REPORT.md`** for the full evaluation, ffprobe highlights, and the framework
recommendation. This README documents how to reproduce the artifacts.

## Requirements
- Node 20+, npm 10+
- `ffmpeg`/`ffprobe` (bundled with Remotion for rendering; system `ffprobe` used for inspection)
- A Chromium the render can use — Remotion downloads `chrome-headless-shell` on first render
  (needs network once), or set one via its config.

## Install & render
```bash
cd marketing/video/remotion
npm install
npm run render     # -> spike.mp4  (1920x1080, H.264, yuv420p, 30fps, faststart, muted)
```

## Other commands
```bash
npm run capture    # regenerate public/product-queue.png from the real popup.html + styles.css
npm run lint       # tsc --noEmit
npm run still      # -> out/still-frame60.png (single-frame workflow)
npm run studio     # interactive preview
```

## Layout
```
package.json            pinned deps (remotion 4.0.487, react 19.1.0, typescript 5.8.3)
remotion.config.ts      codec / pixel-format / png-frame settings
tsconfig.json
src/
  index.ts              registerRoot
  Root.tsx              <Composition id="Spike" 1920x1080 30fps 225f>
  Spike.tsx             scene sequencing + clip-wipe transition
  theme.ts              design tokens copied verbatim from the extension styles.css
  components/YoloCard.tsx   reconstructed popup with animated queue insertion
  scenes/QueueScene.tsx     Storyboard A Scene 2 (Queue) + real capture panel
  scenes/WorkflowScene.tsx  Storyboard A Scene 4 (Bounded workflow)
scripts/
  capture-popup.html    real markup + styles.css, populated Scene-2 queue
  capture-popup.mjs      headless-Chrome capture -> public/product-queue.png
public/
  product-queue.png     real product capture used in the video
spike.mp4               rendered spike output (committed artifact)
```

## Licensing note
Remotion is **not** OSI-licensed. It uses a two-tier model (free for individuals / ≤3-employee
for-profits / non-profits / evaluation; paid Company License otherwise). See `SPIKE_REPORT.md` §4
and the upstream `remotion/LICENSE.md`. Confirm eligibility before adopting for the full video.
