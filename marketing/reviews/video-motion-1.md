# Wave D Motion Review — YOLO for ChatGPT Launch Video

**Reviewer:** Independent Wave D reviewer (did not build the video)  
**Date:** 2026-07-17  
**Scope:** `marketing/video/hyperframes/yolo-launch-16x9.mp4`, `yolo-launch-square.mp4`, their `*.ffprobe.json`, `README.md`, `index.html`, and `square/index.html`.  
**Source of truth:** Storyboard A (`marketing/storyboard-a/STORYBOARD.md`), Visual Direction A (`marketing/visual-direction-a/DIRECTION.md`), and the orchestration brief.

## 0. Scope caveat: files are not on `devin/launch-prep`

The brief asked me to review the final launch video on `devin/launch-prep`. At review time, the final deliverables are **not present** there; `devin/launch-prep` only contains the earlier 7.6 s `spike.mp4`. The full final videos live on **`origin/devin/wave-c-hyperframes`** (commit `3996ef7`).

I reviewed the final assets from that branch. The report is filed on `devin/launch-prep` because that is the launch-readiness integration branch, but the video files must be merged into it before launch. The `devin/launch-prep` README already links to `marketing/video/hyperframes/yolo-launch-16x9.mp4`, so the broken links make this a launch-blocking gap.

---

## 1. Verdict

**Video asset quality: PASS.** The 16:9 and square cuts meet the technical spec, follow Storyboard A, honor the product boundary, and contain no legal or privacy leaks. There are minor readability polish items.

**Launch readiness: P0 blocker — the final video files are absent from `devin/launch-prep`.** Merge `devin/wave-c-hyperframes` (or the equivalent final-video commit) into `devin/launch-prep` before publish.

---

## 2. Technical checks

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Duration 35–45 s | **Pass** | Both cuts are **44.500 s**. |
| 1 | Resolution / fps / codec / pix_fmt | **Pass** | 16x9: **1920×1080**, square: **1080×1080**, both **30 fps**, **H.264 High**, **yuv420p**, bt709 color space. |
| 2 | Fast-start moov atom | **Pass** | `moov` starts at byte 32 and ends before `mdat` in both files (`ftyp` → `moov` → `free` → `mdat`). |
| 2 | No audio | **Pass** | No audio streams; only one video stream per file. |
| 2 | File size < 35 MB | **Pass** | 16x9: **8,461,855 bytes (8.1 MB)**; square: **6,913,857 bytes (6.6 MB)**. |
| 3 | `ffprobe` JSONs match files and are committed | **Pass** | Every checked field (`codec_name`, `width`, `height`, `pix_fmt`, `r_frame_rate`, `avg_frame_rate`, `duration`, `bit_rate`, `nb_frames`, `format.size`, `format.bit_rate`) matches. SHA256SUMS.txt also matches the on-disk mp4s. |
| 4 | No black/corrupt frames; first and last frames readable | **Pass** | First frame (`00.00`) shows the Scene 1 ChatGPT conversation clearly; final frame (`44.40`) holds the full end card. Per-frame luminance sampling shows high mean brightness throughout; no all-black frames detected. |
| 5 | Smallest text readable | **Conditional pass** | Full 1080p/1:1 playback: **Pass** — command descriptions, footnote, and queue labels are legible. Compressed social preview (16x9 at 640×360, square at 480×480): **degraded** — the 14–15 px labels (`seg-labels`, `palette-group`, `foot-chip`) blur and the interpunct in the footnote can disappear. See §3.1. |
| 6 | Storyboard beats clear; pacing not rushed; transitions not jarring | **Pass** | Scene timing follows Storyboard A: Problem 0–4 s, Queue 4–12 s, Composer actions 12–19 s, Bounded workflow 19–28 s, Optional GitHub 28–35 s, Reliability 35–40 s, End card 40–44.5 s. Transitions are 0.4–0.6 s opacity + translate easing; calm and never wipe across critical text. |
| 7 | Product claims are true | **Pass** | Persistent per-conversation queue is shown (Scenes 2 and 5). `/goal`, `/loop`, `/review`, `/continue` slash actions are shown in Scene 3 with a YOLO footnote. Bounded `/loop 4` workflow with progress segments and **Pause/Edit/Stop** controls is shown, and it visibly pauses at iteration 2/4. Optional GitHub app is framed as connected to ChatGPT. Local-first / no telemetry is shown in Scene 6 and the end card. |
| 8 | GitHub app shown as optional and connected to ChatGPT | **Pass** | Scene 5 displays a generic connected-app chip with the persistent, pinned label **“Optional GitHub app · Connected directly to ChatGPT”** visually attached to the ChatGPT surface, not the YOLO panel. |
| 9 | No OpenAI endorsement; end card has independent line | **Pass** | No OpenAI logo or endorsement language. End card (both cuts) reads **“Independent project. Not affiliated with OpenAI.”** and holds for ~4 s. |
| 10 | No private data, personal info, real repos, tokens, or browser profile leaks | **Pass** | Scenarios are invented (“Audit reliability gaps”). The only user identifier is a generic “K” avatar. No repo names, tokens, emails, or browser data appear. |
| 11 | Color/contrast/animation consistent with Visual Direction A | **Pass** | Warm off-white canvas, near-black type ramp, quiet graphite borders, restrained shadows. Green = running/sending, amber = paused/caution, red = danger only (`×` and `Stop`). No neon, 3D, particles, or AI hype. |
| 12 | Square version is a genuine recomposition, not a blind crop | **Pass** | `square/index.html` repositions every scene for 1080×1080 (centered/stacked panels, smaller headlines, vertical end-card CTAs) and loads `square/square.css` overrides. Visual inspection confirms elements are not cropped from the 16:9 frame. |

---

## 3. Findings

### 3.1 [P2] Smallest text loses clarity in compressed/social preview

- **Where:** Scene 3 command palette descriptions/footnote, Scene 4 `seg-labels` (`1/4` … `4/4`), Scene 2/5 queue meta labels.
- **What:** At full 1080p the text is readable. When the video is scaled to typical social-preview sizes (16x9 at 640×360, square at 480×480), the 14–15 px copy becomes blurry and the footnote interpunct drops out.
- **Why it matters:** Storyboard A promises “muted-first” comprehension on small screens and states body text should be ≥ ~34 px at 1080p for safety; several labels fall well below that.
- **Recommendation:** Bump the smallest functional copy to at least 18–20 px, or ensure the heaviest claims (footnote, segment labels, queue count) are rendered at ≥20 px. Alternatively, accept for the full-size demo and ship a separate teaser with larger type.

### 3.2 [P2] `/goal` iteration limit is not explicitly shown

- **Where:** Scene 3 command palette.
- **What:** `/goal` is described as “a marker-driven objective that YOLO can continue for bounded turns,” but the video never shows the actual iteration limit the product enforces. Scene 4 demonstrates the bound clearly for `/loop 4`.
- **Recommendation:** Not launch-blocking because `/loop` proves the bounded pattern. If the team wants `/goal` specifically to carry the same concrete bound, add a brief “bounded” cue (e.g., “…for bounded turns / up to the configured limit”) in the description or show a `/goal` card in a later revision.

### 3.3 [P2] `meta.json` still describes the asset as the framework spike

- **Where:** `marketing/video/hyperframes/meta.json`.
- **What:** `id` and `name` are `chatgpt-yolo-hyperframes-spike` and `createdAt` matches the spike timestamp. This is stale now that the directory ships the full 7-scene launch video.
- **Recommendation:** Update `meta.json` to identify the deliverable as the launch video, or remove it from scope if the HyperFrames CLI does not require it.

### 3.4 [P0] Final launch video is not merged into `devin/launch-prep`

- **Where:** `devin/launch-prep` branch.
- **What:** `yolo-launch-16x9.mp4`, `yolo-launch-square.mp4`, and their `*.ffprobe.json` are missing. The `devin/launch-prep` README already links to them, so the links are broken.
- **Recommendation:** Merge the final video commit (`origin/devin/wave-c-hyperframes` @ `3996ef7` or its replacement) into `devin/launch-prep` before launch. Do not rename or re-encode unless the checksums are regenerated.

---

## 4. Validation performed

- `ffprobe` on both mp4s (streams + format).
- Python box parser to confirm `moov` precedes `mdat`.
- `sha256sum -c` against `SHA256SUMS.txt`.
- `ffmpeg` extraction of first, last, and key scene frames at full and compressed sizes.
- Visual inspection of representative frames (Problem, Queue, Composer, Bounded workflow, GitHub, Reliability, End card) for both 16:9 and square, including compressed social-preview sizes.
- Cross-check of scene timing against `marketing/storyboard-a/STORYBOARD.md`.
- Cross-check of color tokens/semantics against `marketing/visual-direction-a/DIRECTION.md`.

---

## 5. Recommended next actions

1. **P0 — Merge the final video commit into `devin/launch-prep`.** This is the only launch-blocking item.
2. **P2 — Decide on small-type legibility.** Increase the smallest on-screen copy to ≥18–20 px if the video will be viewed heavily in compressed/social feeds.
3. **P2 — Update `meta.json`** to reflect the launch video identity.
4. **P2 (optional) — Clarify `/goal` bound** if the team wants that specific claim visualized.

---

## 6. Handoff

- **Files created:** `marketing/reviews/video-motion-1.md` (this file).
- **Files changed:** none.
- **Implementation or video modified:** none.
- **Suitable for another agent:** yes — the P0 merge and P2 type-size polish are concrete and located.
