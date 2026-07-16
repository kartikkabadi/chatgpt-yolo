# Releasing

1. Update `CHANGELOG.md` and ensure `config.js`, `manifest.json`, and `package.json` use the same version.
2. Run `npm run validate`.
3. Run `npm run package` and inspect `dist/yolo`.
4. Load `dist/yolo` unpacked in a current Chromium browser.
5. Complete the manual smoke checklist in the README and test commands, queue delivery, workflows, approvals, recovery, settings, and onboarding.
6. Merge only a reviewed, exact-head CI-green commit.
7. Tag it as `v<version>` and push the tag.

The release workflow validates the tag/version match, packages the allowlisted runtime tree, creates a ZIP and SHA-256 checksum, uploads the artifact, and creates a GitHub Release.

Never release temporary review scripts, diagnostics, test fixtures, repository metadata, or broad host permissions.
