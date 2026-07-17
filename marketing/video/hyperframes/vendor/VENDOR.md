# Vendored GSAP

These files are vendored for the `chatgpt-yolo` launch video so the render pipeline does not depend on a live CDN.

| File | Source | Version | License |
|------|--------|---------|---------|
| `gsap.min.js` | npm package `gsap@3.14.2` | 3.14.2 | GSAP Standard "no charge" license: https://gsap.com/standard-license/ |
| `TextPlugin.min.js` | npm package `gsap@3.14.2` | 3.14.2 | GSAP Standard "no charge" license: https://gsap.com/standard-license/ |

## SHA-256

```
c174bfce53a729418d57a8ad8625e7247c793a22fef8e2851e3cfa3de9cd8280  gsap.min.js
14f3898c5e985cd5d985918e2368813d35e9629da4884f05d03bb3d0d10f170f  TextPlugin.min.js
```

## Vendoring command

```bash
npm pack gsap@3.14.2
tar -xzf gsap-3.14.2.tgz
cp package/dist/gsap.min.js package/dist/TextPlugin.min.js vendor/
sha256sum vendor/gsap.min.js vendor/TextPlugin.min.js
```

No source modifications were made.
