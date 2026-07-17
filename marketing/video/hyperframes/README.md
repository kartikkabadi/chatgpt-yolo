# HyperFrames — YOLO for ChatGPT launch video

This directory contains the final, vendored source for the *YOLO for ChatGPT* launch video.

| Output | Composition | Dimensions | Notes |
| --- | --- | --- | --- |
| `yolo-launch-16x9.mp4` | `index.html` | 1920×1080 | primary landscape cut |
| `yolo-launch-square.mp4` | `square/index.html` | 1080×1080 | true 1:1 recomposition (not a crop) |

Both are **44.5 s · 30 fps · H.264 (High) · yuv420p · fast-start · no audio**.

The 7-scene composition uses only local vendored GSAP (`vendor/gsap.min.js` and `vendor/TextPlugin.min.js`); no remote executable resources are loaded. The square build is a genuine recomposition: every scene is re-laid-out vertically in `square/square.css` and reuses the same copy, tokens, and timeline as the 16:9 cut.

## Verification

```bash
cd marketing/video/hyperframes
sha256sum -c SHA256SUMS.txt
ffprobe -v quiet -print_format json -show_streams -show_format yolo-launch-16x9.mp4
ffprobe -v quiet -print_format json -show_streams -show_format yolo-launch-square.mp4
```

## Provenance & staged-capture disclosure

Every on-screen surface is **staged from the real extension's design system** — the design tokens, component structure, slash-command copy (`commands.js`), and queue/workflow labels (`popup.html`) are copied from the product so the video reflects true product states. The scenes are **rendered HTML mockups**, not screen recordings of a live ChatGPT session, and the conversations shown are **invented demo scenarios** — no live ChatGPT capture, no real account, and no private or personal data are used.

Product-truth guarantees enforced by the composition:

- Slash actions are labeled as **YOLO commands**, with a pinned *"YOLO command · not a native ChatGPT command"* footnote (Scene 3).
- The workflow is **visibly bounded** (`iteration 2/4`) and **pauses** — it never implies an endless or fully autonomous loop (Scene 4).
- Scene 5 uses a **generic connected-app chip**, not fake GitHub UI, with a pinned boundary label: *"Optional GitHub app · Connected directly to ChatGPT"*. YOLO is never shown owning GitHub access.
- The end card states *"Independent project. Not affiliated with OpenAI."* — no OpenAI endorsement is implied anywhere.
- No audio track; the cut is designed to read fully muted.

Verification artifacts live alongside the videos (`*.ffprobe.json`, `SHA256SUMS.txt`) and in `marketing/renders/contact-sheet.png`.
