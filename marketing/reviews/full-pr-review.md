# Full PR Review — `devin/launch-prep` vs `main`

**Branch reviewed:** `devin/launch-prep`
**Reviewer role:** Independent final-PR reviewer (did not participate in implementation)
**Report location:** `marketing/reviews/full-pr-review.md`

## Automated validation

| Command | Result |
|---|---|
| `npm run check` | PASS |
| `npm test` | PASS (208/208 tests) |
| `npm run verify:extension` | PASS (35 packaged files) |
| `npm run validate` | PASS |
| `npm run package` | PASS — produced clean `dist/yolo` |

## Scope checks

1. **Automated scripts all pass** — PASS.
2. **`npm run package` excludes marketing files and produces a clean `dist/yolo`** — PASS. Output contains 35 files: runtime JS/HTML/CSS/icons plus `README.md`, `LICENSE`, `NOTICE.md`, and `PRIVACY.md`. No `marketing/`, `tests/`, or dev scripts are included.
3. **README is the primary conversion doc** — PASS with nits. Contains hero image, three-value summary, product boundary, GitHub-app separation, source install instructions, demo video link/poster, sponsor copy, and permissions/privacy section. Claims are consistent with `manifest.json`, `PRIVACY.md`, and `docs/PERMISSIONS.md`. **Nit:** there is no dedicated FAQ section.
4. **`manifest.json` description and permissions match the README** — PASS. Permissions remain exactly `alarms`, `scripting`, `storage`; host access remains `https://chatgpt.com/*` and `https://*.chatgpt.com/*`; description aligns with README and `REPO_METADATA.md`.
5. **Hero, social preview, demo poster, and 5 screenshots exist with correct dimensions/sizes** — PASS.
   - `docs/assets/hero.webp` — 1536×864, ~59 KB
   - `docs/assets/social-preview.png` — 1280×640, ~199 KB
   - `docs/assets/demo-poster.webp` — 1920×1080, ~71 KB
   - 5 screenshots — 1440×900, all under 350 KB
6. **`docs/assets/social-preview.png` is 1280×640 PNG and suitable as GitHub social preview** — PASS.
7. **Final launch videos** — **FAIL (P0)**. `marketing/video/hyperframes/yolo-launch-16x9.mp4` and `yolo-launch-square.mp4` do **not** exist. Only a 7.6 s `spike.mp4` (a framework evaluation spike) is present. The required `yolo-launch-16x9.ffprobe.json` and `yolo-launch-square.ffprobe.json` are also missing.
8. **`marketing/LAUNCH_COPY.md` has launch post, first reply, repository description, topics** — PASS with P2 nit. Contains launch post, first reply, and repository description; does not list repository topics (topics are in `REPO_METADATA.md`).
9. **`marketing/REPO_METADATA.md` has description, topics, homepage guidance** — PASS.
10. **`marketing/asset-manifest.json` accurately lists all assets with sizes** — FAIL (blocked by #7). Image entries are accurate and verified. Video entries reference files that do not exist and cannot be verified.
11. **`NOTICE.md`, `PRIVACY.md`, `SECURITY.md`, `docs/PERMISSIONS.md` are consistent and truthful** — PASS.
12. **`.github/FUNDING.yml` sponsor link is present; README copy says sponsorship is optional** — PASS.
13. **No new extension permissions, host access, or runtime features added for marketing** — PASS. Manifest permissions/hosts are unchanged; implementation diffs (`commands.js`, `onboarding.html`, `options.html`, `styles.css`, `tests/ui.test.js`) are copy/style updates only.
14. **No secrets, credentials, private data, or local paths committed** — PASS.
15. **The PR is ready to merge and meets the orchestration brief deliverables** — **FAIL (P0)** because the final launch videos are missing.

## Blockers and actionable fixes

- **P0 — Final launch videos are missing.** The README demo links point to `marketing/video/hyperframes/yolo-launch-16x9.mp4` and `yolo-launch-square.mp4`, which are not present. Only the 7.6 s framework spike exists.
  - **Fix:** Render the final 35–45 s 16:9 and 1:1 videos (H.264, yuv420p, 30 fps, faststart, no audio, < 35 MB), produce their `ffprobe` JSON files, and confirm they land in `marketing/video/hyperframes/`. Update `marketing/asset-manifest.json` with final actual sizes/durations if they differ from the current placeholders.
- **P2 — README lacks a dedicated FAQ section.** The scope expects an FAQ; none is present.
  - **Fix:** Add a short FAQ section to `README.md` or explicitly link to `docs/TROUBLESHOOTING.md` as the FAQ.
- **P2 — `LAUNCH_COPY.md` omits repository topics.** Topics are defined in `REPO_METADATA.md` but not duplicated in `LAUNCH_COPY.md`.
  - **Fix:** Add the final topic list to `LAUNCH_COPY.md` or document `REPO_METADATA.md` as the single source of truth.

## Overall verdict

**BLOCKED.** The branch is mechanically healthy, all automated validation passes, and the static image/marketing docs are in good shape. The missing final launch videos and the resulting dead demo links in `README.md` are a **P0** merge blocker that must be resolved before this PR can be considered ready to merge.
