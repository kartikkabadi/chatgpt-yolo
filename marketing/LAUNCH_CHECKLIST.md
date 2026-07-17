# Launch checklist — YOLO for ChatGPT

This is the exact sequence for Kartik to publish the launch once the final PR is merged.

## Before merge

- [ ] Review the final PR diff.
- [ ] Confirm `npm run validate` passes on the PR head.
- [ ] Confirm the README install path points to the verified `v1.1.0` release archive with `gh attestation verify`.
- [ ] Confirm the GitHub-app section wording is acceptable.
- [ ] Confirm sponsor copy matches the live Whop page.

## Merge and live smoke test

- [ ] Merge the PR into `main` on the explicit reviewed merge commit.
- [ ] Pull `main` locally and run a live smoke test:
  - Load the `dist/yolo` extension from a local `npm run validate && npm run package` build.
  - Open `https://chatgpt.com` and confirm the YOLO popup mounts, the queue can be added/reordered, and a `/loop` workflow runs and pauses as expected.
  - Confirm no extension console errors in the background/page context.
  - If the smoke test fails, do **not** tag; open a follow-up issue and fix before release.
- [ ] Only after the live smoke test passes, tag the exact reviewed merge commit:
  ```bash
  git fetch origin
  git checkout origin/main
  git tag v1.1.0 $(git rev-parse HEAD)
  git push origin v1.1.0
  ```
- [ ] The `release.yml` workflow will build `yolo-v1.1.0.zip`, generate `SHA256SUMS`, and create the GitHub release.
- [ ] Download the generated `yolo-v1.1.0.zip`, verify the SHA-256 checksum, and verify the GitHub artifact attestation:
  ```bash
  gh attestation verify yolo-v1.1.0.zip --repo kartikkabadi/chatgpt-yolo
  ```

## Repository metadata (manual or `gh repo edit`)

Run the commands in `marketing/REPO_METADATA.md`, or update via the GitHub web UI:

- [ ] Description: `Local-first Chrome extension for reliable queues and bounded workflows in long ChatGPT conversations. Open source, no telemetry.`
- [ ] Topics: `chatgpt`, `chatgpt-extension`, `chrome-extension`, `browser-extension`, `manifest-v3`, `javascript`, `productivity`, `workflow-automation`, `automation`, `local-first`, `privacy`, `open-source`, `developer-tools`
- [ ] Website/homepage: leave blank.
- [ ] Social preview: upload `docs/assets/social-preview.png` in Settings → General → Social preview.
- [ ] Sponsor button: confirm it renders from `.github/FUNDING.yml`.

## Launch assets

- [ ] Final 16:9 MP4 downloaded from the PR / release artifacts.
- [ ] Final 1:1 square MP4 downloaded.
- [ ] Poster / first frame (`docs/assets/demo-poster.webp`) available.
- [ ] Contact sheet and frame samples available in `marketing/renders/`.

## Publish

- [ ] Post the recommended launch post on X / LinkedIn / HN / Product Hunt (do not publish the launch post before the PR is merged and the release tag is pushed).
- [ ] Pin the first reply with the install/GitHub/sponsor guidance.
- [ ] Monitor the first hour for reproducible bug reports and respond with the bug-report issue template.

## Post-launch

- [ ] Watch issue volume and selector-regression reports.
- [ ] Keep the release archive and checksums linked from the README after the first release exists.
