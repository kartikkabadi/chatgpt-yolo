# Marketing and launch package

This directory contains the final launch-ready brand, storyboard, copy, and verification artifacts for the YOLO for ChatGPT public launch. It does not contain extension runtime code.

The committed images and videos in `docs/assets/` and `marketing/video/hyperframes/` are the final optimized assets. Heavyweight generation tooling is not included in the extension's build, package, install, or release paths.

## Final deliverables

- `BRAND.md` — Final selected visual identity and copy rules.
- `STORYBOARD.md` — Final 7-scene launch video storyboard.
- `LAUNCH_COPY.md` — Launch post, first reply, and platform variants.
- `LAUNCH_CHECKLIST.md` — Exact publish sequence for the owner.
- `REPO_METADATA.md` — Final description, topics, homepage, social preview instructions, and `gh` commands.
- `asset-manifest.json` — Inventory, SHA-256, provenance, and specs for every launch asset.
- `video/` — Framework decision record and final HyperFrames source/MP4s.
- `renders/` — Contact sheet for visual review.

## Verification

```bash
# Validate extension (no marketing tooling required)
npm run validate:core

# Verify final video integrity
cd marketing/video/hyperframes
sha256sum -c SHA256SUMS.txt
```
