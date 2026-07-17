# Video production

## Framework selection

| Dimension | HyperFrames (selected) | Remotion (rejected) |
| - | - | - |
| Visual fidelity | Strong — plain HTML/CSS rendered by real Chrome; product tokens reused verbatim. | Strong — Chromium + Skia; React/TS reconstruction from same tokens. |
| Rendering reliability | Strong; every render in the spike succeeded first try. | Strong; first-try renders, parallel frame capture. |
| Setup complexity | Low — HyperFrames CLI + local Chromium; Node ≥ 22 required. | Moderate-low — Remotion CLI + one-time Chromium fetch; heavier React/TS toolchain. |
| Source maintainability | High — one HTML file + one GSAP timeline, no build. | Strong — typed React components, but more abstraction. |
| Render speed | Good (~2 min for the 44.5 s 16:9 cut on a 2 vCPU low-memory path). | Good (~16 s frame render for a 7.5 s spike). |
| Responsive / square | Requires a second HTML composition (cheap, expected). | Native composition width/height, but scenes need layout refactor for 1:1. |
| Determinism | Frame capture visually deterministic; MP4 bytes not byte-identical (H.264 encode). | Byte-for-byte identical across renders (verified). |
| Licensing | Apache-2.0 — permissive, OSI-compatible, no fees. | Source-available free license with use-case limits (≤3-employee individuals/orgs, non-profits, evaluation); paid license required for larger for-profits and some commercial uses. |

**Selected framework:** HyperFrames. The Apache-2.0 license is OSI-compatible and removes the Remotion free-license use-case restrictions for this project. The HTML/GSAP authoring model is the smallest possible surface for an agent-driven launch. Remotion's technical quality was strong, but its free license is limited by organization size and revenue and requires a paid license for some commercial uses, so it was not selected.

## Selected video outputs

All final renders live in `marketing/video/hyperframes/`:

- `yolo-launch-16x9.mp4` — 1920×1080, 30 fps, H.264 `yuv420p`, fast-start, no audio.
- `yolo-launch-square.mp4` — 1080×1080 real recomposition, same codec/fps.
- `yolo-launch-16x9.ffprobe.json` and `yolo-launch-square.ffprobe.json` — media metadata.
- `SHA256SUMS.txt` — integrity hashes.
- `index.html` / `launch.css` / `square/` / `vendor/` — final, vendored composition source.

The committed MP4s are the canonical final assets. The source HTML is provided for transparency; the extension build does not depend on it.

## Storyboard

See `marketing/STORYBOARD.md` for the selected scene summary.

## Verification

```bash
cd marketing/video/hyperframes
sha256sum -c SHA256SUMS.txt
```
