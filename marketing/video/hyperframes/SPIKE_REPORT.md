# HyperFrames technical spike — YOLO for ChatGPT launch video

> Wave C · Framework spike 15 (HyperFrames). Independent evidence for the
> orchestrator's video-framework selection. This is **not** the final video —
> it is a 7.6 s representative sequence built to stress the tool against the
> Wave B **Storyboard A** direction (`origin/devin/wave-b-storyboard-a`).

- **Tool:** [`hyperframes`](https://github.com/heygen-com/hyperframes) — "Write HTML. Render video." (HTML + seekable animation → MP4 via headless Chrome + FFmpeg)
- **Pinned version:** `hyperframes@0.7.46` (published 2026-07-09; pinned in `package.json`, ≥7 days old for supply-chain safety — the package ships multiple releases/day)
- **License:** Apache-2.0
- **Composition:** `index.html` (Storyboard A **Scene 2 — Queue** + **Scene 4 — Bounded workflow**)
- **Output:** `spike.mp4` — 1920×1080 · H.264 (High) · yuv420p · 30 fps · fast-start · no audio · 2.3 MB
- **Environment:** Ubuntu 22.04, Node v22.23.1 (via nvm), FFmpeg 4.4.2, 2 vCPU / 7.8 GB RAM

## What the sequence contains (all required spike elements)

| Required element | How it is demonstrated |
| --- | --- |
| Real product screenshot | `public/screenshot-queue.png` — captured from the **actual** extension `popup.html` + `styles.css` (deterministic capture harness, `source/capture-popup.html` + `scripts/capture.mjs`). Pinned as a context card in Scene 4 with a clip-path mask reveal. |
| Controlled camera / mask motion | Slow push-in (`scale 1.0→1.045`) on Scene 2; clip-path `inset()` mask wipe + gentle zoom on the screenshot in Scene 4. |
| Queue-item movement | Three real queue rows (real component markup/CSS) insert one at a time; `queueCount` chip ticks `0→1→2→3 queued`; small reorder nudge on row 3. |
| Kinetic text | Scene headlines and kicker rise/settle; the workflow sub-line advances `running · 1/4 → running · 2/4 → paused · 2/4`. |
| One scene transition | Scene 2 wipes up + fades while Scene 4 crossfades in (~t=4.0–4.6 s). |
| Final encoded MP4 | `spike.mp4` (see spec above; full metadata in `spike.ffprobe.json`). |

Product-boundary discipline is preserved: only real YOLO UI text/states are shown, the workflow **visibly bounds and pauses** (never an endless loop), and no GitHub/OpenAI chrome is implied.

## ffprobe highlights (`spike.mp4`)

```
codec_name = h264      profile = High       pix_fmt = yuv420p     color_range = tv
width = 1920           height = 1080        r_frame_rate = 30/1   nb_frames = 228
duration = 7.60 s      size = 2,458,381 B   bit_rate ≈ 2.59 Mb/s  audio streams = 0
faststart = yes        (moov atom @ offset 40, before mdat @ 1826)
```

All primary-output constraints from brief §13 are met (H.264 / yuv420p / 30 fps / fast-start / no audio), scaled to a 7.6 s spike.

## Evaluation (brief §12 comparison dimensions)

### Visual fidelity — strong
The composition is plain HTML/CSS rendered by real Chrome, so it inherits the product's exact design tokens (imported verbatim from `styles.css`) and Chrome's text rendering. Output is crisp at 1080p; the real screenshot embeds losslessly. `frames/scene-a-queue.png` and `frames/scene-b-bounded.png` are representative full-res frames; `frames/contact-sheet.png` shows the whole arc.

### Rendering reliability — strong
Every render in this spike succeeded on the first try (MP4 ×2, PNG-sequence ×2, snapshots). No crashes, no stuck frames. The renderer auto-detected the constrained box (≤8 GB RAM) and engaged a **low-memory profile** (1 worker, screenshot capture) without intervention.

### Setup complexity — low
`npm install` (~11 s, 120 pkgs) + one optional `npx @puppeteer/browsers install chrome-headless-shell`. `hyperframes doctor` gives a clear readiness table. The only hard requirement missing from a stock image is **Node ≥22** (this box defaulted to Node 20; resolved via `nvm use 22`). FFmpeg and a Chrome are the only system deps, both already present.

### Agent ability to inspect and self-correct — excellent
This is HyperFrames' standout for an agent workflow:
- `hyperframes lint` caught real authoring bugs (a `gsap.from(opacity:0)` no-op and CSS/GSAP `transform` conflicts) with exact fixes — all cleared to **0 errors / 0 warnings**.
- `hyperframes inspect` samples the timeline and reports **layout** problems (occluded text, box overflow, container overflow) with timestamps; it drove two concrete layout fixes to reach **0 layout issues across 9 samples**.
- `hyperframes snapshot --at <t>` exports still frames + a contact sheet for fast visual verification.
These give an agent a tight, machine-readable correction loop without watching a video.

### Source maintainability — high
One self-contained HTML file with a single paused GSAP timeline; no build step, no framework, no JSX. Design tokens mirror the extension's own CSS, so the marketing look tracks the product. Diffs are readable and reviewable.

### Render speed — good (on constrained hardware)
- `spike.mp4` (228 frames, 1920×1080): **~34 s** (low-memory, 1 worker, screenshot capture).
- PNG-sequence (228 frames): ~54 s. On a machine >8 GB RAM the multi-worker + `chrome-headless-shell` `beginFrame` fast path would be materially faster; the doctor explicitly flags that this box falls back to screenshot capture.

### Environmental compatibility — good, with one caveat
Works cleanly on Linux/Ubuntu with system FFmpeg + Chrome and Docker available. **Caveat:** requires Node ≥22 (enforced), and the perf-optimized `HeadlessExperimental.beginFrame` path is unavailable in regular Chrome builds — install `chrome-headless-shell` (or set `HYPERFRAMES_BROWSER_PATH`) for the fast path. Both are one-time setup and belong in the environment blueprint.

### Responsive aspect-ratio support — good, by re-composition (not blind crop)
`--resolution` scales a composition to a higher DPR **only when the aspect ratio matches** (e.g. 1080p → landscape-4k as an integer 2× scale). Requesting `--resolution square` on this 16:9 composition is **correctly rejected** ("does not match the aspect ratio … use --resolution landscape"). A true 1:1 / 9:16 variant is authored as a **second small HTML composition** — which is cheap because compositions are just HTML. This matches brief §13's "real square composition, not a blind crop."

### Deterministic behavior — visually deterministic; container not byte-reproducible
Measured on this box across repeat renders:
- **PNG-sequence:** 226 / 228 frames byte-identical. The 2 differing frames (148, 156) differ only by sub-pixel anti-aliasing during the mask/segment motion (PSNR 77 dB and 100 dB — imperceptible).
- **MP4 pixels:** run-to-run SSIM **0.9997**, PSNR avg **58.6 dB** — visually identical.
- **MP4 bytes:** SHA-256 differs run-to-run (H.264/x264 encode + MP4 muxer are not bit-reproducible here).

Conclusion: HyperFrames' *frame capture* is effectively deterministic (its documented claim), which is what matters for regression review and re-renders. Do **not** treat the MP4's SHA-256 as reproducible; hash the PNG-sequence (or the source) if a strict CI baseline is needed. `SHA256SUMS.txt` records the committed artifacts' hashes for integrity, not for reproducibility.

### Licensing implications — clean
Apache-2.0: permissive, no per-render fees, no commercial-use thresholds, redistributable. No license blocker for an open-source launch. (Only the isolated marketing tooling depends on it; the extension runtime is untouched — zero new runtime deps.) Note: the CLI ships anonymous telemetry **on by default**; this spike ran `hyperframes telemetry disable`, and any adopting environment should do the same.

## Recommendation

**Select-worthy.** HyperFrames rendered a spec-compliant, product-native sequence on the first pass and — crucially for an agent-driven pipeline — provides a **machine-readable lint + inspect + snapshot correction loop** that let an agent reach zero lint/layout issues without human review. The authoring model (plain HTML + one GSAP timeline, no build step, tokens shared with the extension) is highly maintainable, and the Apache-2.0 license is unambiguous for open source.

Trade-offs to weigh against the Remotion spike: (1) Node ≥22 + `chrome-headless-shell` are prerequisites worth baking into the blueprint; (2) determinism is at the **frame** level, not byte level; (3) square/vertical variants require a second composition (expected, and cheap). None are blockers for the 35–45 s launch video.

**Verdict for the full video: recommend HyperFrames**, conditional on the orchestrator's side-by-side comparison with the Remotion spike (agent self-correction quality and license clarity are its strongest differentiators).

## Reproduce

```bash
cd marketing/video/hyperframes
nvm use 22                     # Node >= 22 required
npm install
npx @puppeteer/browsers install chrome-headless-shell   # optional fast path
export HYPERFRAMES_BROWSER_PATH="$PWD/$(ls chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell)"
npm run capture                # regenerate public/screenshot-queue.png from the real extension UI
npx hyperframes lint . && npx hyperframes inspect .
npm run render                 # -> spike.mp4 (1920x1080, H.264, yuv420p, 30fps, faststart)
ffprobe -v error -show_streams -show_format spike.mp4
```

### Committed artifacts
- `index.html` — the composition
- `source/capture-popup.html`, `scripts/capture.mjs` — deterministic real-UI capture harness
- `public/screenshot-queue.png` — real product capture (input)
- `spike.mp4` — rendered output · `spike.ffprobe.json` — full media metadata
- `frames/` — representative frames + contact sheet
- `SHA256SUMS.txt` — integrity hashes of committed artifacts
