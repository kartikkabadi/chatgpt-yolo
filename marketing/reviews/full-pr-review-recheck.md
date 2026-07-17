# Full PR Review Recheck — `devin/launch-prep` vs `main`

**Branch reviewed:** `devin/launch-prep`  
**Reviewer role:** Independent final-PR reviewer (did not participate in implementation)  
**Report location:** `marketing/reviews/full-pr-review-recheck.md`  
**Previous review:** `marketing/reviews/full-pr-review.md`

## P0 resolution

The previous P0 blocker — missing `marketing/video/hyperframes/yolo-launch-16x9.mp4` and `yolo-launch-square.mp4` — is **resolved**. Both MP4s, their `.ffprobe.json` files, and an updated `SHA256SUMS.txt` are present and verified.

## Checklist

| # | Item | Result | Notes |
|---|---|---|---|
| 1 | `npm run check` / `test` / `verify:extension` / `validate` / `package` | **PASS** | All five commands completed successfully. 208/208 tests pass. `verify:extension` reports 35 packaged files. `package` emits a clean `dist/yolo`. |
| 2 | `dist/yolo` is clean and excludes marketing/tests/dev files | **PASS** | Contains 35 files: runtime JS/HTML/CSS/icons plus `README.md`, `LICENSE`, `NOTICE.md`, `PRIVACY.md`. No `marketing/`, `tests/`, `scripts/`, `.github/`, or other dev artifacts. |
| 3 | Launch videos: 16:9 and square specs | **PASS** | `yolo-launch-16x9.mp4`: 1920×1080, H.264, yuv420p, 30 fps, 44.5 s, no audio, faststart, 8.1 MB. `yolo-launch-square.mp4`: 1080×1080, H.264, yuv420p, 30 fps, 44.5 s, no audio, faststart, 6.6 MB. Both under 35 MB. |
| 4 | `*.ffprobe.json` files present and match MP4s | **PASS** | Both `.ffprobe.json` files are present. Re-run `ffprobe` confirms matching width, height, codec, pixel format, frame rate, duration, and stream count. |
| 5 | `SHA256SUMS.txt` verifies | **PASS** | `sha256sum -c SHA256SUMS.txt` reports OK for all 29 listed entries. |
| 6 | README demo video links resolve | **PASS** | `<video>` source and both download links point to existing files. Poster `docs/assets/demo-poster.webp` exists. All other README internal links resolve; external URLs are valid. |
| 7 | Static assets present with correct dimensions/sizes | **PASS** | `hero.webp` 1536×864 ~59 KB; `social-preview.png` 1280×640 ~199 KB; `demo-poster.webp` 1920×1080 ~71 KB; 5 screenshots 1440×900, all under 100 KB; `yolo-mark.svg` 128×128. Sizes match `marketing/asset-manifest.json`. |
| 8 | README, manifest, PRIVACY.md, NOTICE.md, docs/PERMISSIONS.md consistent and truthful | **PASS with nit** | Permission claims, profiles, queue behavior, privacy statements, and product boundary all match `manifest.json` and source. **Nit:** `README.md` calls the demo "A 40-second walkthrough" while the videos are 44.5 s. Update the caption to "44.5-second" or "~45-second" for truthfulness. |
| 9 | No new extension permissions, host access, or runtime features added for marketing | **PASS** | `manifest.json` permissions remain `alarms`, `scripting`, `storage`; host access remains `https://chatgpt.com/*` and `https://*.chatgpt.com/*`. Diffs in `commands.js`, `options.css`, `options.html`, `styles.css`, `tests/ui.test.js`, `onboarding.html` are copy/style/clarity changes only. |
| 10 | No secrets, private data, local paths in committed files | **PASS** | Repo-wide scan for tokens, keys, credentials, and absolute local paths found none in runtime or source. `marketing/video/hyperframes/scripts/capture.mjs` includes fallback Chrome search paths (`/home/ubuntu/.local/bin/google-chrome`, `/usr/bin/google-chrome`) for the dev-only capture harness, but these are not secrets and are not rendered into the shipped extension or videos. |
| 11 | The PR is ready to merge | **PASS** | P0 resolved; automated validation green; scope, asset, and consistency checks complete. |

## Verdict

**PASS.** The `devin/launch-prep` branch is mechanically sound, the missing launch videos are present and within spec, and the full deliverable is consistent. The only remaining item is the README caption duration nit, which is non-blocking.
