# Remotion technical spike — YOLO for ChatGPT launch video

> Wave C · Remotion spike. Produced independently of the HyperFrames spike.
> Deliverable: a small representative sequence + an evidence-based recommendation on
> whether to select **Remotion** for the full 35–45 s launch video.

- **Framework:** [Remotion](https://www.remotion.dev) — React-based programmatic video.
- **Pinned version:** `remotion` / `@remotion/cli` **4.0.487** (published 2026-07-09; chosen as the
  most recent release ≥7 days old at spike time — `4.0.490` was 1 day old and skipped for
  supply-chain hygiene). React `19.1.0`, TypeScript `5.8.3`.
- **Content:** Storyboard A **Scene 2 (Queue)** transitioning into **Scene 4 (Bounded workflow)**.
- **Output:** `spike.mp4` — 7.5 s, 1920×1080, H.264, `yuv420p`, 30 fps, fast-start, no audio.

---

## 1. What was built

A 7.5 s (225-frame) composition (`src/Spike.tsx`) that exercises every element the orchestrator
requires from a representative sequence:

| Requirement | How it is demonstrated |
| --- | --- |
| Real product screenshot | `public/product-queue.png` — captured from the **real** `popup.html` + `styles.css` (see `scripts/capture-popup.mjs`), shown as a masked "Real capture · popup.html" panel. |
| Controlled camera / mask motion | Scene 2 has a slow camera push-in (`scale 1.0→1.035`) and the capture panel reveals via an animated `clip-path` inset (mask wipe). |
| Queue-item movement | Three real queue instructions spring/slide into the reconstructed popup (`YoloCard.tsx`), with the `N queued` counter ticking `1→2→3` in sync. |
| Kinetic text | "Queue what should happen next." rises in word-by-word (staggered springs). |
| One scene transition | A directional `clip-path` wipe from Scene 2 (Queue) into Scene 4 (Bounded workflow). |
| Bounded-workflow truth | Scene 4 fills 2 of 4 progress segments, then **pauses** (green→amber, `Resume/Edit/Stop`) — never implies an endless loop. |
| Final encoded MP4 | `spike.mp4` at the exact launch spec. |

The reconstructed UI uses the **verbatim design tokens** from the extension's `styles.css`
(`src/theme.ts`), so it matches the real product; the real capture panel proves fidelity against it.

## 2. Commands

```bash
cd marketing/video/remotion
npm install                 # 185 pkgs, ~13 s; Remotion fetches its own headless Chromium on first render
npm run capture             # regenerate public/product-queue.png from the real popup.html
npm run lint                # tsc --noEmit (type safety, self-correction signal)
npm run render              # -> spike.mp4 (h264 / png frames / yuv420p / muted / faststart)
npm run studio              # interactive preview + timeline (great for iteration)
npm run still               # -> out/still-frame60.png (still-frame workflow)
```

## 3. ffprobe highlights (`spike.mp4`)

```
codec_name       h264            (profile: High)
width x height   1920 x 1080
pix_fmt          yuv420p         (limited range — rendered via PNG frames, not yuvj420p)
r_frame_rate     30/1            avg_frame_rate 30/1
nb_frames        225             duration 7.500000 s
size             872,580 bytes (~856 KB)
bit_rate         ~0.93 Mbit/s
faststart        atom order: ftyp, moov, free, mdat  -> moov precedes mdat (streaming-optimized)
audio            none (rendered --muted)
metadata         stripped (-map_metadata -1); only "Made with Remotion 4.0.487" comment
```

## 4. Evaluation

### Visual fidelity — strong
Browser-grade rendering (Chromium + Skia): real fonts, sub-pixel AA, gradients, `clip-path`
masks, shadows all render exactly as in the product. Because the animated UI is built from the
extension's own CSS tokens, the reconstruction is visually indistinguishable from the real
capture shown beside it.

### Rendering reliability — strong
Renders succeeded first try on 2 vCPU / 7.8 GB. `--enable-multiprocess-on-linux` parallelises
frame capture. No flakiness across repeated renders. The only environment nuance: Remotion
downloads its own `chrome-headless-shell` on first render (works offline afterward).

### Setup complexity — moderate-low
A single `npm install` (185 packages) plus an automatic one-time Chromium fetch. This is heavier
than a pure-ffmpeg pipeline, but everything is standard Node/React tooling and fully scriptable.
No system packages beyond a working Chromium dependency chain (already present here).

### Agent ability to inspect & self-correct — strong
This is Remotion's biggest advantage for an agent-driven pipeline:
- `tsc --noEmit` catches composition errors before rendering.
- `remotion still --frame=N` renders any single frame in ~1 s for fast visual iteration.
- `remotion studio` gives a live, seekable preview.
- The composition is plain, diff-able React/TypeScript — easy to reason about and modify.

### Source maintainability — strong
Declarative React components, typed props, reusable scenes (`QueueScene`, `WorkflowScene`) and a
shared token file. Extending to the full 7-scene, 35–45 s video is straightforward: add scenes and
sequence them. The UI is driven by the same tokens as the product, so brand drift is unlikely.

### Render speed — good
225 frames (1920×1080) encoded in ~16 s of frame rendering (~22 s wall incl. bundling) on 2 vCPU —
roughly 10–14 fps of throughput. A full ~40 s video (~1200 frames) extrapolates to ~1.5–2 min,
comfortably fast for CI. Scales with cores.

### Environment compatibility — good, with one caveat
Runs on Linux/macOS/Windows and in CI. Caveat: it needs a compatible Chromium; Remotion bundles
`chrome-headless-shell` and downloads it on demand, so **network access is required on the first
render** (or the binary must be pre-provisioned in the blueprint/CI cache).

### Responsive aspect-ratio support — supported by the framework; needs layout work here
Remotion natively parametrises `width`/`height` per `<Composition>` and exposes `useVideoConfig()`,
so a second **1080×1080** composition reusing the same scenes is trivial to add for the required
square secondary output. **Caveat:** this spike's scenes use absolute pixel positions tuned for
16:9; a genuine (non-cropped) square needs the layouts refactored to relative units / safe-area
math. The framework fully supports it — the spike simply didn't invest in dual-format layout.

### Deterministic behavior — excellent (verified)
Two independent full renders produced **byte-for-byte identical** files:
`sha256 = 49260e33769142a6ce4fffd4e962cea714e099def8481c63d95e82656127af59`.
Determinism holds because the composition uses only frame-driven interpolation (no `Date.now()`,
no `Math.random()`), and metadata is stripped (`-map_metadata -1`). This makes CI hash-gating and
reproducible re-renders reliable.

### Licensing implications — **must be reviewed before shipping**
Remotion is **not** OSI open source. `remotion/LICENSE.md` defines a two-tier model:
- **Free License** for individuals, for-profit orgs with **≤3 employees**, non-profits, and
  evaluation use — commercial video output is allowed.
- **Company License** (paid, via remotion.pro) **required** for larger for-profit organizations.

For an individual maintainer publishing an open-source project's launch video, the **Free License
almost certainly applies** and no purchase is needed. But this is a real, ongoing obligation that
**depends on who ends up maintaining/using the pipeline** — unlike a permissively licensed tool it
can require payment if the owning entity grows. Remotion 5.0 will change terms further
(see the PR linked at the top of `LICENSE.md`). This is the single biggest strike against Remotion
relative to a permissively/OSS-licensed alternative and must be an explicit, recorded decision.

## 5. Limitations observed
- First render requires network to fetch `chrome-headless-shell` (pre-cache in CI/blueprint).
- Spike layouts are 16:9-absolute; square output needs a responsive layout pass.
- Non-permissive license — see §4 licensing.
- Node + Chromium footprint is heavier than a pure-ffmpeg or single-binary tool.

## 6. Recommendation

**Recommended: yes — select Remotion for the full 35–45 s video, conditional on a recorded
licensing sign-off.**

Rationale: highest visual fidelity, excellent agent self-correction loop (`tsc` + `still` + studio),
maintainable typed React source, and **verified byte-level deterministic renders** — the strongest
possible base for reproducible, CI-gated video. The output already meets the exact launch spec
(1920×1080 / H.264 / `yuv420p` / 30 fps / faststart / ~856 KB).

The one gating item is licensing: confirm the maintaining entity qualifies for Remotion's Free
License (individual / ≤3-employee org / non-profit). For `kartikkabadi/chatgpt-yolo` as an
individual open-source project this holds today. If a larger for-profit entity will own the
pipeline, either budget a Company License or select the permissively/OSS-licensed spike instead.
The square secondary output requires a modest responsive-layout pass regardless of framework.
