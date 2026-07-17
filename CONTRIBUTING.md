# Contributing

Thanks for helping improve YOLO.

Read [Product direction](docs/PRODUCT_DIRECTION.md) before proposing substantial behavior or architecture changes. YOLO is intentionally a normal local-first Chromium extension, not an agent platform or local service.

## Before opening a pull request

1. Open or reference an issue for substantial behavior changes.
2. Keep the change focused; do not mix UI redesign, queue semantics, and automation policy in one PR.
3. Run `npm run validate:core`.
4. Run `npm run package` and confirm `dist/yolo` contains only allowlisted runtime files.
5. Smoke-test the unpacked extension when changing ChatGPT selectors or browser behavior.
6. Include screenshots for UI changes and describe storage, permission, compatibility, and migration impact.

## Engineering invariants

Changes must preserve:

- Background-owned serialized queue mutations.
- Persisted submission intent before composer interaction.
- Exact claim/completion identity and fail-closed ambiguous delivery.
- Per-conversation scoping and route checks.
- Draft protection and bounded automation.
- Safe approval policy as the default.
- Content-script order in `manifest.json`.
- No remote code, analytics, telemetry, or unnecessary host permissions.
- No CLI, local daemon, MCP/native-messaging host, agent integration, filesystem access, or hosted backend in the core repository.

`npm run verify:extension` enforces the public runtime boundary. Do not weaken it merely to make a feature pass.

## Style

- Prefer dependency-free JavaScript and pure state-machine helpers.
- Keep the everyday UI simple; use progressive disclosure for advanced controls.
- Add regression tests for every correctness or accessibility fix.
- User-visible failures must explain what happened and the next safe action.
- Minimize selectors and isolate ChatGPT DOM assumptions inside the platform adapter.

## Commits and reviews

Use descriptive commits. PR descriptions should state the problem, smallest change, exclusions, validation, security/privacy impact, and manual test coverage.

Do not squash a contributor's carefully structured commit history by default. Use a merge commit when the commits are coherent and independently useful; clean up only genuinely noisy history.

By contributing, you agree that your contribution is licensed under the MIT License.
