# Wave D Video Motion Review — YOLO for ChatGPT launch video

**Wave:** D (independent reviewer)  
**Role:** Video/motion reviewer — did not implement the reviewed assets  
**Date:** 2026-07-17  
**Verdict:** **Content passes.** The 16:9 and 1:1 launch videos meet the technical spec, are product-truthful, readable, on-brand, and free of privacy or endorsement risks. **One P0 release-readiness blocker:** the final deliverables are not present in `devin/launch-prep`; they exist only in `origin/devin/wave-c-hyperframes` and must be merged before launch.

---

## 0. Scope and source-of-truth caveat

The brief asked me to review the final launch video in `devin/launch-prep`. At review time, that branch did **not** contain:

- `marketing/video/hyperframes/yolo-launch-16x9.mp4`
- `marketing/video/hyperframes/yolo-launch-square.mp4`
- their `*.ffprobe.json` files
- `marketing/video/hyperframes/index.html`
- `marketing/video/hyperframes/square/index.html`

These files are present and committed in `origin/devin/wave-c-hyperframes`. I performed the review against the `wave-c-hyperframes` source (which is the source of truth for the final motion assets) and recorded the launch-prep absence as a release blocker.

Reviewed files:

| File | Source branch | Dimensions | Duration | Size |
| --- | --- | --- | --- | --- |
| `yolo-launch-16x9.mp4` | `devin/wave-c-hyperframes` | 1920×1080 | 44.50 s | 8,461,855 bytes (8.1 MB) |
| `yolo-launch-square.mp4` | `devin/wave-c-hyperframes` | 1080×1080 | 44.50 s | 6,913,857 bytes (6.6 MB) |
| `*.ffprobe.json` | `devin/wave-c-hyperframes` | — | — | — |
| `index.html`, `square/index.html`, `README.md` | `devin/wave-c-hyperframes` | — | — | — |

Verification command used: `ffprobe`, `ffmpeg`, `sha256sum -c SHA256SUMS.txt`, and image inspection.

---

## 1. Duration, resolution, fps, codec, pix_fmt

**Result: Pass**

| Spec | 16:9 actual | Square actual |
| --- | --- | --- |
| Duration 35–45 s | 44.500000 s | 44.500000 s |
| Resolution | 1920×1080 | 1080×1080 |
| Frame rate | 30 fps (`r_frame_rate=30/1`) | 30 fps (`r_frame_rate=30/1`) |
| Codec | H.264 (`h264`, High profile, `avc1`) | H.264 (`h264`, High profile, `avc1`) |
| Pixel format | `yuv420p` | `yuv420p` |
| Color | `bt709` primaries/transfer/matrix, `tv` range | `bt709` primaries/transfer/matrix, `tv` range |

Both streams are a single video stream (`nb_streams=1`), no audio.

---

## 2. Fast-start moov atom, no audio, file size < 35 MB

**Result: Pass**

- **Fast-start:** top-level box order is `ftyp` → `moov` → `free` → `mdat` in both files. `moov` begins at byte 32 and ends before `mdat`, confirming the moov atom is at the start.
- **No audio:** `ffprobe -select_streams a` returns an empty stream list for both files.
- **File size:** 16:9 = 8.1 MB, square = 6.6 MB; both well under the 35 MB ceiling.

---

## 3. ffprobe results match the actual file and are committed

**Result: Pass for `devin/wave-c-hyperframes`; FAIL for `devin/launch-prep` (see P0 blocker below).**

For the files that exist, the committed `*.ffprobe.json` values match the actual media:

| Field | Committed JSON | Actual `ffprobe` | Match |
| --- | --- | --- | --- |
| 16:9 duration | 44.500000 | 44.500000 | Yes |
| 16:9 size | 8461855 | 8461855 | Yes |
| 16:9 format bit_rate | 1521232 | 1521232 | Yes |
| 16:9 stream bit_rate | 1520086 | 1520086 | Yes |
| 16:9 width/height/fps/pix_fmt | 1920/1080/30/yuv420p | 1920/1080/30/yuv420p | Yes |
| Square duration | 44.500000 | 44.500000 | Yes |
| Square size | 6913857 | 6913857 | Yes |
| Square format bit_rate | 1242940 | 1242940 | Yes |
| Square stream bit_rate | 1241800 | 1241800 | Yes |
| Square width/height/fps/pix_fmt | 1080/1080/30/yuv420p | 1080/1080/30/yuv420p | Yes |

`sha256sum -c SHA256SUMS.txt` verified both videos and both ffprobe JSONs against committed checksums.

---

## 4. No black/corrupt frames; first and last frames readable

**Result: Pass**

- `ffmpeg -vf blackdetect=d=0.1:pix_th=0.00` on both files returned no black intervals.
- Extracted first frame (`n=0`) and last frame (`n=1334`) for both versions. Image inspection confirms both are fully rendered, readable, and not corrupt.
- First frame: clean ChatGPT-style conversation surface with the headline "Stop babysitting long ChatGPT tasks."
- Last frame: end card with logo, "YOLO for ChatGPT", "Queue the next steps. Stay in control.", support line, repository URL/CTA, and the legal disclaimer.

---

## 5. Smallest text is readable at normal size and when compressed

**Result: Pass with one P2 nit**

- At full 1920×1080 / 1080×1080 resolution, all text is sharp and readable, including the smallest command descriptions (`/goal`, `/loop`, `/review`, `/continue`), the "YOLO command · not a native ChatGPT command" footnote, the iteration labels, the GitHub boundary label, and the end-card legal line.
- At full-resolution heavy JPEG compression (`q=20`), the smallest body text remains readable with only minor pixelation.
- At a downscaled 480 px width (simulating a very small thumbnail), the command descriptions and footnote become partially/barely readable. This is expected for extreme downscaling, but it is the only scenario where the fine print starts to strain.

**P2 nit:** For maximum social-media safety, consider ensuring the footnote and command descriptions have a slightly larger minimum type size in any future re-render, or accept that viewers will see them clearly only at normal playback size.

---

## 6. Storyboard beats, pacing, and transitions

**Result: Pass with one P2 nit**

The timeline follows `marketing/STORYBOARD.md` / Storyboard A:

| Scene | Time | Beat |
| --- | --- | --- |
| 1 Problem | 0.0–4.0 | Cold open on ChatGPT surface; headline rises on lower-left safe zone |
| 2 Queue | 4.0–12.0 | Queue panel masks in; rows insert; reorder nudge; Send next pulses |
| 3 Composer actions | 12.0–19.0 | `/` opens command palette; highlights `/goal`, `/loop`, `/review`, `/continue`; types `/loop 4 audit reliability gaps` |
| 4 Bounded workflow | 19.0–28.0 | 4-segment bound fills to `iteration 2/4`; Pause → Resume |
| 5 Optional GitHub | 28.0–35.0 | ChatGPT generic connected-app chip; YOLO coding sequence queue; boundary label pinned |
| 6 Reliability | 35.0–40.0 | Three quick product-truth beats: draft protected, ambiguous pauses, local/no telemetry |
| 7 End card | 40.0–44.5 | Logo, title, tagline, trust line, CTAs, legal disclaimer |

- Scene timing is within the 35–45 s budget; end card holds 4.5 s, legal line appears at 41.5 s and holds ~3 s, GitHub boundary label appears at 29.0 s and holds the rest of the scene.
- Transitions are GSAP-driven opacity/translate crossfades (0.4–0.55 s, `power2.inOut` / `power2.in`), not hard cuts or jarring flashes.
- Scene 6 uses three ~1.6 s beats; each is readable, but it is the fastest section of the video.

**P2 nit:** Scene 6 is intentionally rapid; if any stakeholder finds the reliability beats hard to absorb, an extra 0.5–1.0 s total would give each claim more breathing room without breaking the duration budget.

---

## 7. Product claims are true

**Result: Pass**

Cross-checked against the extension source (`commands.js`, `popup.html`, `config.js`, `PRIVACY.md`) on `devin/launch-prep`:

| Claim in video | Extension evidence |
| --- | --- |
| Queue | `popup.html` has a Queue section with ordered list, reorder, Send next, Pause, Clear |
| Slash actions (/goal, /loop, /review, /continue) | `commands.js` exports `COMMANDS` with exactly these names and matching descriptions |
| Bounded /goal with iteration limit | `startWorkflow` enforces `maxIterations` clamped to `[1, MAX_ITERATIONS]` (50); `/goal` and `/loop` both respect `maxIterations` |
| Pause / Stop | `popup.html` shows Pause; `commands.js` has `pause`, `resume`, `stop` control commands; `setWorkflowStatus` supports `paused`, `blocked`, `idle` |
| Optional GitHub app | Extension does not ship a GitHub OAuth integration; it can auto-click approval cards only when the user explicitly enables approvals and chooses an approval policy (`config.js` presets). No GitHub credentials are received by YOLO |
| Local-first | `manifest.json` permissions are `alarms`, `scripting`, `storage`; host permissions are ChatGPT only; `PRIVACY.md` states no backend, no telemetry, no remote logging |
| No telemetry | `PRIVACY.md`: "None. YOLO has no analytics, telemetry, advertising, backend, user account, payment system, crash-reporting service, or remote logging endpoint." Confirmed by source grep |

The `/loop 4 audit reliability gaps` invocation matches `parseLoopArgs` in `commands.js` (first number parsed as iteration count, clamped 1–50).

**P2 note:** The video highlights `/goal` in the command palette but does not exercise a `/goal` workflow; it demonstrates bounded iteration via `/loop 4`. This is materially equivalent because both `/goal` and `/loop` share the same bounded `maxIterations` mechanism.

---

## 8. GitHub app shown as optional and connected to ChatGPT, not owned by YOLO

**Result: Pass**

- Scene 5 displays a generic connected-app chip labeled **GitHub** with the sub-line **"Connected to ChatGPT · repository context"** — not a cloned GitHub UI and not branded as YOLO.
- A pinned boundary label reads **"Optional GitHub app · Connected directly to ChatGPT"** for the entire scene.
- The YOLO side of the frame shows only a coding-sequence queue (`inspect → implement → validate → review → summarize`), reinforcing that YOLO coordinates prompts, not GitHub access.

---

## 9. No OpenAI endorsement; end card has independent-project / not-affiliated line

**Result: Pass**

- No OpenAI logo, glyph, or "official" / "endorsed by" language appears anywhere.
- ChatGPT is referenced only as the platform on which the extension runs.
- The end card at 40.0–44.5 s includes:
  > **Independent project. Not affiliated with OpenAI.**

---

## 10. No private data, personal info, real repos, tokens, or browser profile leaks

**Result: Pass**

- The on-screen ChatGPT conversation is an invented demo scenario (disclosed in the `README.md` provenance note).
- The only user identifier is a single-letter avatar "K" — not a name, email, or account info.
- No API keys, tokens, session IDs, or browser profile data are visible.
- The repository URL on the end card (`github.com/kartikkabadi/chatgpt-yolo`) is the product's own public repo, which is appropriate for an end card and not a private third-party repo.

---

## 11. Color/contrast and animation consistent with Visual Direction A

**Result: Pass**

- Warm off-white canvas (`#f6f6f4`), white surfaces, graphite text ramp (`#181817` / `#55554f` / `#6a6963`) match `marketing/visual-direction-a/DIRECTION.md`.
- Semantic color usage is consistent:
  - **Green** (`#24784b`) for success / running / sending states.
  - **Amber** (`#9b640d`) for paused / caution states.
  - **Red** (`#b33232`) used only for the Stop / danger × actions.
- Motion is GSAP-driven, restrained: no neon, no 3D, no parallax gimmicks, no motion blur.
- Shadows are soft and low-opacity; corner radii are moderate (9–22 px).
- Typography uses the product's system-ui stack and monospace only for machine-meaningful tokens.

---

## 12. Square version is a genuine recomposition, not a blind crop

**Result: Pass**

- `yolo-launch-square.mp4` is 1080×1080, H.264, yuv420p, 30 fps, same duration as the 16:9 cut.
- `square/index.html` and `square/square.css` contain independent absolute positioning and layout rules (e.g., queue panel is centered vertically rather than right-docked; the composer hint is stacked below the palette).
- Extracted square frames show vertically stacked compositions (headline above product surface, scene 3 palette above composer hint) rather than a center-crop of the 16:9 frame.
- The same copy, tokens, and GSAP timeline are reused, so the two versions do not drift.

---

## Findings with severity

| Severity | Item | Action |
| --- | --- | --- |
| **P0** | Final launch video files (`yolo-launch-16x9.mp4`, `yolo-launch-square.mp4`, `*.ffprobe.json`, `index.html`, `square/index.html`) are **not in `devin/launch-prep`**; they exist only in `origin/devin/wave-c-hyperframes`. | Merge `devin/wave-c-hyperframes` into `devin/launch-prep` (or fast-forward the launch branch) and re-run `sha256sum -c marketing/video/hyperframes/SHA256SUMS.txt` before publishing. |
| P2 | `square/index.html` meta viewport is still `width=1920, height=1080` even though the rendered output is 1080×1080. The `#root` data attributes are correct and HyperFrames honors them, but aligning the meta tag would make the source less confusing. | Update `<meta name="viewport" content="width=1080, height=1080" />` in `square/index.html` and verify the square render still outputs 1080×1080. |
| P2 | Scene 6's three reliability beats are the fastest section of the video (~1.6 s each). They are readable, but could absorb an extra 0.5–1.0 s if stakeholders want more dwell time. | Optionally stretch Scene 6 by ≤1 s and compress an equivalent amount elsewhere if the 44.5 s duration must remain unchanged. |
| P2 | Fine command descriptions and the "not a native ChatGPT command" footnote become marginal at very small downscaled thumbnails (480 px wide). They are fine at full resolution and normal social playback sizes. | Consider a slightly larger minimum font size only if the video will frequently be viewed at very small embeds. |

---

## Final recommendation

The video content is **launch-ready**. Fix the P0 branch-merge issue so the approved files actually ship from `devin/launch-prep`, then the video suite can be published.
