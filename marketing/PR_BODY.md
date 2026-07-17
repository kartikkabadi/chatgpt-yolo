<!-- Use file:///home/ubuntu/repos/chatgpt-yolo/marketing/PR_BODY.md when calling git_create_pr -->

## Executive summary

This PR makes `kartikkabadi/chatgpt-yolo` launch-ready. It does **not** add product features, refactor the extension, or broaden permissions. Instead it:

- Redesigns the README into a conversion-first public landing page.
- Replaces public-facing "Codex" / "autonomous" wording with product-truthful, bounded-workflow language.
- Produces a full launch asset package: hero, social preview, demo poster, five staged product screenshots, and a 35–45 second HyperFrames launch video in 16:9 and 1:1 square formats.
- Adds a `Sponsor` button pointing to the existing Whop one-time support page, with explicit copy that sponsorship is optional.
- Documents the recommended ChatGPT GitHub app setup as a **separate, optional** ChatGPT feature that YOLO never accesses.
- Includes an asset manifest, contact sheet, and the deterministic capture / image-production harnesses so the brand package can be regenerated.

The extension's runtime permissions, host access, and CSP remain unchanged. `npm run validate` and `npm run package` pass.

## Product positioning

YOLO for ChatGPT is a local-first Manifest V3 Chromium extension that adds persistent instruction queues, composer-native slash actions, and bounded `/goal` / `/loop` workflows to long ChatGPT conversations. It is not an AI model, agent, backend, GitHub integration, or CLI.

## Orchestration model

This PR was prepared by a temporary team of specialized Devin agents across four waves:

- **Wave A — Research:** product truth, repo/docs audit, target-user positioning, ChatGPT GitHub app docs, sponsorship strategy, GitHub metadata/discoverability.
- **Wave B — Creative:** three visual directions, two storyboards, README copy architecture.
- **Wave C — Production:** deterministic product capture, static image rendering, HyperFrames and Remotion spikes, full launch video production.
- **Wave D — Reviews:** product-claims audit, visual-design review, privacy/security/accessibility review, technical/repository review, README conversion reviews, and a final full-PR review.

All Wave D findings were triaged. P0 product-truth issues and P1 accessibility contrast issues were fixed; M1 sponsor-page context was escalated as an external Whop listing outside this repo.

## Creative concepts considered

- Visual Direction A — "Instrument Panel" (selected): calm, technical, local-first.
- Visual Direction B — "Momentum / Speed" (rejected): too kinetic, risked implying unbounded automation.
- Visual Direction C — "Minimal Gallery" (rejected): not enough product-context.
- Storyboard A — problem → queue → slash actions → bounded workflow → GitHub setup → reliability → end card (selected).
- Storyboard B — feature-tour carousel (rejected): weaker narrative.

## Selected video framework

**HyperFrames** (Apache-2.0, HTML/GSAP) was selected over **Remotion** (non-OSI license, size-gated). The decision is recorded in `marketing/video/README.md`. HyperFrames gives a deterministic, inspectable, lintable composition and a fast render/inspect loop. Remotion was evaluated and rejected because its free license restricts public/repo use and does not fit an OSI-compatible launch package.

## Capture method

The five product screenshots in `docs/assets/` are produced by `marketing/capture/capture.mjs`, which composes the repository's own `popup.html`, `styles.css`, and `options.css` into deterministic HTML fixtures. Each screenshot carries a "Staged demo · no live data" disclosure. No real ChatGPT conversations, emails, tokens, or private repos appear in any asset.

## README changes

- New hero, three-value summary, product boundary statement, and GitHub-app separation section.
- Source-install path is primary; no release badge (no release exists yet).
- Embedded 16:9 demo video with poster and direct MP4 download links.
- Sponsor section explicitly states sponsorship is optional and never required.
- Permissions/privacy and FAQ sections mirror `PRIVACY.md` and `docs/PERMISSIONS.md`.

## GitHub app wording and safeguards

README and onboarding/options copy now clearly describe the GitHub app as an **optional ChatGPT integration** that the user enables inside ChatGPT. YOLO never receives GitHub credentials, repo data, or `github.com` host permissions. The extension's `manifest.json` host access remains limited to `https://chatgpt.com/*` and `https://*.chatgpt.com/*`.

## Sponsorship changes

`.github/FUNDING.yml` already points to `https://whop.com/vex-app/support-for-oss/`. This PR adds the `Sponsor` button metadata, README copy, and verifies the page is public and offers one-time $5 / $10 / $20 tiers. The `vex-app` slug is external and not modified by this PR.

## Repository metadata (to apply manually after merge)

- **Description:** Local-first Chromium extension for reliable queues and bounded workflows in long ChatGPT conversations.
- **Topics:** chatgpt, chrome-extension, browser-extension, manifest-v3, productivity, open-source, local-first, workflow-automation, chatgpt-extension, instruction-queue
- **Homepage:** leave blank (the repository README is the landing page).
- **Social preview:** upload `docs/assets/social-preview.png` in repository Settings → General → Social preview.

## Asset inventory

See `marketing/asset-manifest.json` for the full list. Key assets:

| Asset | Path | Dimensions | Size |
|-------|------|------------|------|
| README hero | `docs/assets/hero.webp` | 1536×864 | ~59 KB |
| Social preview | `docs/assets/social-preview.png` | 1280×640 | ~199 KB |
| Demo poster | `docs/assets/demo-poster.webp` | 1920×1080 | ~71 KB |
| Screenshots (5) | `docs/assets/screenshot-*.webp` | 1440×900 | 43–62 KB each |
| Brand mark | `docs/assets/yolo-mark.svg` | scalable | ~1 KB |
| Contact sheet | `marketing/renders/contact-sheet.png` | varies | ~1.7 MB |
| Launch video 16:9 | `marketing/video/hyperframes/yolo-launch-16x9.mp4` | 1920×1080 | ~40 s, 30 fps, H.264 yuv420p |
| Launch video square | `marketing/video/hyperframes/yolo-launch-square.mp4` | 1080×1080 | ~40 s, 30 fps, H.264 yuv420p |

## Video storyboard

1. **Problem (0–5 s):** long ChatGPT threads need constant prompting.
2. **Queue (5–12 s):** queue the next instructions; YOLO manages the order.
3. **Slash actions (12–19 s):** `/goal`, `/loop`, `/fix`, `/review`, `/handoff` in the composer.
4. **Bounded workflow (19–27 s):** `/goal` limits turns, shows progress, and can stop.
5. **Optional GitHub setup (27–33 s):** ChatGPT GitHub app is separate and optional.
6. **Reliability (33–38 s):** pause, edit, stop; local-first, no telemetry.
7. **End card (38–40 s):** YOLO logo, tagline, install CTA, legal line.

## Downloadable renders and render commands

- `marketing/video/hyperframes/yolo-launch-16x9.mp4`
- `marketing/video/hyperframes/yolo-launch-square.mp4`
- `ffprobe` JSONs and a contact sheet are in `marketing/video/hyperframes/`.

Render command (from `marketing/video/hyperframes`):
```bash
npx hyperframes render . --output yolo-launch-16x9.mp4 --fps 30
```

The square render uses the same source with a separate square composition.

## Release / installation readiness

- `npm run check`, `npm test`, `npm run verify:extension`, `npm run validate`, and `npm run package` pass.
- `scripts/verify-extension.mjs` confirms no new host/optional/sensitive permissions and no forbidden permissions.
- `npm run package` produces `dist/yolo` with the same 35 packaged files; no marketing files are bundled.
- No GitHub release is created yet per the brief; the source install path is documented.

## Validation results

- `npm run validate`: **208 pass / 0 fail**, extension boundary clean.
- `npm run package`: `dist/yolo` produced, 35 packaged files.
- `ffprobe` verification: 1920×1080, ~40 s, 30 fps, H.264 (h264), yuv420p, faststart moov, no audio, < 35 MB.
- Image verification: all dimensions correct, sizes under budget, optimized WebP/PNG.
- Sensitive-data scan: no tokens, emails, private conversations, cookies, or local paths in assets.
- Accessibility: color-contrast token darkened to `#6b6a63` to clear WCAG 2.1 AA failures flagged in Wave D.

## Live smoke-test status

Marketing screenshots are staged composites from `capture.mjs`; they do not depend on a live ChatGPT session. The extension was not smoke-tested against a live ChatGPT conversation in this run, but `npm run validate` exercises the core queue, workflow, and command logic.

## Staged-capture disclosure

The product screenshots in `docs/assets/` are deterministic, local-HTML renders. They are labeled "Staged demo · no live data" and do not contain real user data. The capture harness itself is excluded from the packaged extension.

## Remaining manual settings steps after merge

1. In repository Settings → General, set the description, topics, and homepage values listed above.
2. Upload `docs/assets/social-preview.png` as the repository social preview.
3. In Settings → Sponsorships, ensure the Sponsorships / Sponsor button is enabled.
4. Optionally enable the GitHub Discussion category for launch replies.

## Exact launch sequence

1. Merge this PR.
2. Set repository metadata and social preview.
3. Download `yolo-launch-16x9.mp4` and `yolo-launch-square.mp4` from `marketing/video/hyperframes/`.
4. Copy the launch post from `marketing/LAUNCH_COPY.md`.
5. Publish the launch post; optionally attach the square video.
6. Optionally create a `v1.0.0` release with the `dist/yolo` package after manual end-to-end testing.

## Confirmation: extension permissions and runtime scope were not expanded

- `manifest.json` permissions remain `alarms`, `scripting`, `storage`.
- Host access remains `https://chatgpt.com/*` and `https://*.chatgpt.com/*`.
- CSP remains `script-src 'self'; object-src 'none'; base-uri 'none';`.
- No new backend, analytics, telemetry, GitHub integration, CLI, or native messaging was added.
- No browser-store behavior or runtime product features were modified for marketing.

## Visual contact sheet

![Contact sheet](marketing/renders/contact-sheet.png)
