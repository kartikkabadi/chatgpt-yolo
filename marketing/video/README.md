# Video production

## Framework selection

| Dimension | HyperFrames (selected) | Remotion (rejected) |
| - | - | - |
| Visual fidelity | Strong — plain HTML/CSS rendered by real Chrome; product tokens reused verbatim. | Strong — Chromium + Skia; React/TS reconstruction from same tokens. |
| Rendering reliability | Strong; every render in the spike succeeded first try. | Strong; first-try renders, parallel frame capture. |
| Setup complexity | Low — `npm install` + optional `chrome-headless-shell`; Node ≥22 required. | Moderate-low — `npm install` + one-time Chromium fetch; heavier React/TS toolchain. |
| Agent inspect/self-correct | Excellent — `hyperframes lint` and `hyperframes inspect` produced actionable, machine-readable fixes. | Strong — TypeScript, `remotion still`, `remotion studio`. |
| Source maintainability | High — one HTML file + one GSAP timeline, no build. | Strong — typed React components, but more abstraction. |
| Render speed | Good (~34 s for 7.6 s spike on 2 vCPU low-memory path). | Good (~16 s frame render for 7.5 s spike). |
| Environment compatibility | Good on Linux; Node ≥22 + Chrome/headless-shell. | Good; downloads own Chromium on first render. |
| Responsive / square | Requires a second HTML composition (cheap, expected). | Native composition width/height, but scenes need layout refactor for 1:1. |
| Determinism | Frame capture visually deterministic; MP4 bytes not byte-identical (H.264 encode). | Byte-for-byte identical across renders (verified). |
| Licensing | Apache-2.0 — permissive, no fees. | Non-OSI; free tier limited (individuals / ≤3-employee orgs / non-profits / evaluation). Company license required for larger for-profits. |

**Selected framework:** HyperFrames. The Apache-2.0 license removes commercial-use ambiguity, the HTML/GSAP authoring model is the smallest possible surface for an agent-driven launch, and the `lint`/`inspect` loop gave the spike a fast, self-correcting path to zero layout issues. Remotion was rejected due to its non-OSI, size-gated license even though its technical quality was strong.

## Selected video outputs

All final renders live in `marketing/video/hyperframes/`:

- `yolo-launch-16x9.mp4` — 1920×1080, 30 fps, H.264 `yuv420p`, fast-start, no audio.
- `yolo-launch-square.mp4` — 1080×1080 real recomposition, same codec/fps.
- `yolo-launch-16x9.ffprobe.json` and `yolo-launch-square.ffprobe.json` — media metadata.
- `SHA256SUMS.txt` — integrity hashes.
- `frames/` — contact sheet + key frame samples.

## Storyboard

See `marketing/STORYBOARD.md` and the detailed scene breakdown in `marketing/storyboard-a/STORYBOARD.md`.

## Reproducing the final render

```bash
cd marketing/video/hyperframes
nvm use 22              # HyperFrames requires Node >= 22
npm install
npx hyperframes lint .
npx hyperframes inspect .
npm run render          # -> yolo-launch-16x9.mp4 + square
```

The spike source and report are preserved in the same folder as evidence of the framework comparison.
