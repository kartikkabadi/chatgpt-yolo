# Wave D — Launch video / motion review

**Reviewer:** independent Wave D reviewer (video-motion)  
**Branch reviewed:** `devin/launch-prep` (`eba748a`)  
**Scope:** `marketing/video/hyperframes/yolo-launch-16x9.mp4`, `yolo-launch-square.mp4`, their `.ffprobe.json` files, `marketing/video/hyperframes/index.html`, `README.md`, and `square/index.html`  
**Date:** 2026-07-17

## Verdict

**FAIL — launch-blocker.** The final launch videos are not present on `devin/launch-prep`. The only rendered MP4 is `spike.mp4`, a 7.6 s HyperFrames technical spike containing only Storyboard A Scene 2 (Queue) and Scene 4 (Bounded workflow). The full 35–45 s launch video, the 1:1 square recomposition, and their ffprobe metadata do not exist, so most of the requested checks cannot be verified.

The existing spike is encoded correctly (H.264 `yuv420p`, 30 fps, fast-start moov, no audio, <35 MB), but it is not the requested deliverable and is not launch-ready.

## What was reviewed

| Artifact | Status |
| --- | --- |
| `yolo-launch-16x9.mp4` | **Missing** |
| `yolo-launch-square.mp4` | **Missing** |
| `yolo-launch-16x9.ffprobe.json` | **Missing** |
| `yolo-launch-square.ffprobe.json` | **Missing** |
| `square/index.html` | **Missing** — no 1:1 composition exists |
| `marketing/video/hyperframes/index.html` | Present, but it is the 7.6 s `spike` composition (Scenes 2 + 4 only) |
| `marketing/video/hyperframes/spike.mp4` | Present; reviewed as a proxy for encode quality and source hygiene |
| `marketing/video/hyperframes/spike.ffprobe.json` | Present but stale relative to `spike.mp4` |

## Checks

| # | Check | Result | Notes / severity |
| --- | --- | --- | --- |
| 1 | Duration 35–45 s; 1920×1080 @ 30 fps H.264 `yuv420p`; square 1080×1080 | **FAIL P0** | Final videos missing. `spike.mp4` is 7.6 s, 1920×1080, 30 fps, H.264 `yuv420p` — correct encode but wrong duration and not the requested asset. Square version absent. |
| 2 | Fast-start moov, no audio, <35 MB | **PARTIAL** | `spike.mp4` passes: moov before mdat, one video stream, no audio, 2.46 MB. Cannot verify final videos. |
| 3 | ffprobe results match actual file and are committed | **FAIL P1** | Target `.ffprobe.json` files do not exist. Committed `spike.ffprobe.json` is stale: it records size `2458381` and `bit_rate` `2585847`, while the actual `spike.mp4` is `2459133` bytes with `bit_rate` `2586638`. `SHA256SUMS.txt` for `spike.mp4` is also stale (`191e6f…` committed vs `c4157b…` actual). |
| 4 | No black/corrupt frames; first and last frames readable | **FAIL P1** | `spike.mp4` first frame is a blank warm-white background with no UI or text; last frame is readable (Scene 4 paused state). A blank first frame is not acceptable for a launch video, and the storyboard specifies the first legible frame should be the ChatGPT surface + problem headline. |
| 5 | Smallest text readable at normal size and when compressed | **FAIL P1 (spike)** | `spike` composition uses 15 px text for `.shot-tag` and `.queue-meta`. The storyboard minimum is 34 px for body text. At 15 px the smallest copy will be illegible when compressed to a social timeline. Other text (76 px headline, 34 px `.wf-title`) is crisp at 1080p. |
| 6 | Storyboard beats clear; pacing not rushed; transitions not jarring | **FAIL P0** | Final video missing. `spike.mp4` only contains Scenes 2 and 4, so Problem, Slash actions, Optional GitHub, Reliability, and End-card beats are absent. The wipe/crossfade between the two scenes is calm and controlled. |
| 7 | Product claims true (queue, slash actions, bounded `/goal`, pause/stop, optional GitHub, local-first, no telemetry) | **UNVERIFIED P0** | Final video missing. `spike` source shows queue, a bounded `/loop` workflow (`Audit reliability gaps`, 2/4, paused), Pause/Edit/Stop, and a `Local-only automation` tag. It does not show slash actions, optional GitHub setup, or the full reliability beats, so claims cannot be verified in motion. |
| 8 | GitHub app shown as optional and connected to ChatGPT, not owned by YOLO | **UNVERIFIED P0** | Final video missing. `index.html`/`spike` contains no GitHub scene. The README and storyboard wording is correct ("ChatGPT's GitHub app", optional, YOLO never receives credentials), but the visual beat is absent. |
| 9 | No OpenAI endorsement; end card has independent-project / not-affiliated line | **UNVERIFIED P1** | Final video missing. `spike` source contains no OpenAI logos or endorsements, but it also contains no end card, so the `Independent project. Not affiliated with OpenAI.` line cannot be verified for dwell ≥3 s. |
| 10 | No private data, PII, real repos, tokens, browser profile leaks | **PASS** | Searched source, frames, and `spike.mp4` output: no emails, API keys (`sk-`, `ghp_`, `gho_`), tokens, cookies, private conversations, or local paths appear in rendered content. `public/screenshot-queue.png` is a staged demo with no live data. `scripts/capture.mjs` references local Chrome paths (`/home/ubuntu/...`) for the capture harness, but these are not rendered into the video. Public `github.com/kartikkabadi/chatgpt-yolo` URLs are expected. |
| 11 | Color/contrast/animation consistent with Visual Direction A | **PASS (spike)** | `index.html` uses the product design tokens (`--canvas #f6f6f4`, `--text #181817`, `--success #24784b`, `--warning #9b640d`, `--danger #b33232`). Motion is calm, with restrained ease-out, clip/mask reveals, and a gentle push-in. Green = running/sending, amber = paused, red reserved for destructive actions — consistent with Visual Direction A. |
| 12 | Square version is a genuine recomposition, not a blind crop | **FAIL P0** | No square composition or rendered MP4 exists. `square/index.html` is missing. `marketing/video/README.md` says `npm run render` produces both, but `package.json` only renders `spike.mp4`. |

## Evidence

### File inventory

```
marketing/video/hyperframes/
  index.html              # 7.6 s spike composition (Scenes 2 + 4)
  spike.mp4               # 7.6 s rendered spike
  spike.ffprobe.json      # stale metadata
  README.md               # spike docs (correctly labels spike.mp4)
  package.json            # "render": "hyperframes render . --output spike.mp4 --fps 30"

Requested but missing:
  yolo-launch-16x9.mp4
  yolo-launch-square.mp4
  yolo-launch-16x9.ffprobe.json
  yolo-launch-square.ffprobe.json
  square/index.html
```

### `spike.mp4` ffprobe

```
Duration: 7.600 s
Size: 2,459,133 bytes (~2.35 MB)
Video: h264 (High), yuv420p, 1920x1080 [SAR 1:1 DAR 16:9], 30 fps
Streams: 1 (video only, no audio)
Color: tv/bt709/bt709/bt709
Moov atom: before mdat -> faststart
```

### Frame inspection

- **First frame:** blank radial-gradient background; no text or UI. Extracted with `ffmpeg -i spike.mp4 -vf select=eq(n\,0) -vframes 1`.
- **Last frame:** Scene 4 bounded workflow paused at iteration 2/4; Pause→Resume, Edit, Stop controls visible.
- **Contact sheet and key frames** in `marketing/video/hyperframes/frames/` confirm the same two-scene arc.

### Source/document inconsistencies

- `marketing/video/README.md` claims `npm run render` outputs `yolo-launch-16x9.mp4 + square`; `package.json` only renders `spike.mp4`.
- `marketing/PR_BODY.md` lists `yolo-launch-16x9.mp4` and `yolo-launch-square.mp4` as existing final assets.
- `README.md` embeds `<source src="marketing/video/hyperframes/yolo-launch-16x9.mp4">` and a download link for the square MP4, both of which 404.

## Actionable findings

### P0 — must fix before launch

1. **Render the full 35–45 s 16:9 launch video** from a composition that implements all seven Storyboard A beats (Problem → Queue → Slash actions → Bounded workflow → Optional GitHub → Reliability → End card). The current `index.html` is a 7.6 s spike and is not sufficient.
2. **Create `square/index.html`** as a real 1080×1080 recomposition, then render `yolo-launch-square.mp4`. Do not blind-crop the 16:9 output.
3. **Generate `yolo-launch-16x9.ffprobe.json` and `yolo-launch-square.ffprobe.json`** from the actual rendered files and commit them.
4. **Update `package.json` / README / PR_BODY** so the documented render command, output filenames, and asset manifest are consistent and accurate.

### P1 — should fix before launch

5. **Ensure the first frame is legible**, not a blank background. The storyboard specifies the ChatGPT surface + problem headline as the first/poster frame.
6. **Raise or caption-safe the smallest on-screen text** (target ≥34 px body copy per storyboard) so it survives compression to social timelines.
7. **Regenerate and commit matching ffprobe/SHA256 metadata** for the final videos; do not let stale checksums carry into launch.
8. **Verify the end card holds all required text for ≥3 s** including `Independent project. Not affiliated with OpenAI.` and the sponsor/repo CTAs.
9. **Verify the optional GitHub beat** clearly pins the boundary label `Optional GitHub app · Connected directly to ChatGPT` on the ChatGPT side and never implies YOLO owns or accesses GitHub.

### P2 — polish

10. Consider pinning the GSAP dependency locally (or ensuring `hyperframes` uses the exact same version on every render) so re-renders remain visually deterministic.
11. If the final first frame is intended as the poster for the README `<video>` tag, use `docs/assets/demo-poster.webp` or render the first frame explicitly.

## Minor nits (spike only, not blocking if fixed in final)

- The `spike` wipe from Scene 2 to Scene 4 is calm and controlled.
- The color token usage in `index.html` matches Visual Direction A and avoids neon/gradient AI clichés.
- `spike.mp4` encode is technically clean (correct codec, pixel format, framerate, fast-start, silent, small file).

## Reproduction

```bash
cd marketing/video/hyperframes

# inventory
ls -la yolo-launch-*.mp4 yolo-launch-*.ffprobe.json square/index.html 2>&1

# ffprobe
ffprobe -v error -show_format -show_streams -of json spike.mp4 > spike.ffprobe.actual.json

# frames
ffmpeg -y -i spike.mp4 -vf "select=eq(n\,0)" -vframes 1 first.png
ffmpeg -y -sseof -0.1 -i spike.mp4 -vframes 1 last.png

# integrity
sha256sum spike.mp4
# compare to SHA256SUMS.txt and committed spike.ffprobe.json
```
