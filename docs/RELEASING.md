# Releasing

## Automated gate

1. Update `CHANGELOG.md` and ensure `config.js`, `manifest.json`, and `package.json` use the same version.
2. Run `npm run validate:core` on Node 20 or newer.
3. Confirm `npm run verify:extension` reports the narrow public-extension boundary.
4. Review the `manifest.json` diff explicitly. New hosts, permissions, optional permissions, remote code, or non-extension runtime surfaces require a separate architecture and security review.
5. Run `npm run package` and inspect the exact files under `dist/yolo`.

The package allowlist must never include tests, repository metadata, development scripts, local daemons, CLIs, agent integrations, native-messaging hosts, credentials, diagnostics dumps, or broad host permissions.

## Manual unpacked-extension smoke pass

Load `dist/yolo` through `chrome://extensions` in a current Chromium browser and verify:

- onboarding opens and does not enable automation by itself
- popup queue add, edit, reorder, remove, pause, and send-next behavior
- a saved `/c/...` conversation owns a durable queue
- a new/transient chat fails closed for durable automatic delivery
- an existing composer draft is never replaced
- Safe and Balanced profiles remain conservative
- `/goal` and `/loop` stop on malformed or missing terminal markers
- pause, resume, stop, retry, and explicit runtime reset behave predictably
- route changes and page refreshes do not duplicate a queued instruction
- two tabs for one conversation do not perform the same side effect
- settings, templates, backup preview/import, diagnostics, and reset actions work
- light/dark appearance, keyboard focus, zoom, and reduced motion remain usable
- the service worker recovers after extension reload and browser restart

Record the tested browser/version and the exact commit SHA in the release notes.

## Publish

1. Merge only a reviewed, exact-head commit after required checks pass.
2. Publish a GitHub pre-release first when selectors, permissions, storage format, or workflow behavior changed materially.
3. Let a small public beta exercise the unpacked/release archive before broader distribution.
4. Tag the verified commit as `v<version>` and push the tag.
5. Download the generated archive and confirm its SHA-256 checksum before announcing it.

The release workflow validates the tag/version match, packages the allowlisted runtime tree, creates a reproducible ZIP and checksum, uploads the artifact, attests the archive with GitHub artifact attestations, and creates a GitHub Release.

Verify a downloaded archive before loading it:

```bash
gh attestation verify yolo-v<version>.zip --repo kartikkabadi/chatgpt-yolo
```

This release plan targets `v1.1.0` as the first public launch archive. Source install remains supported but is secondary to the verified release ZIP.

Chrome Web Store distribution should follow a stable public beta, a current policy/terms review, complete store disclosures, and a repeatable selector-regression response process. GitHub releases remain the source-of-truth artifacts.
