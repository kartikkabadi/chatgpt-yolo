# Contributing

Thanks for helping improve YOLO.

## Before opening a pull request

1. Open or reference an issue for substantial behavior changes.
2. Keep the change focused; do not mix UI redesign, queue semantics, and automation policy in one PR.
3. Run `npm run validate`.
4. Run `npm run package` and confirm `dist/yolo` contains only runtime files.
5. Smoke-test the unpacked extension when changing ChatGPT selectors or browser behavior.

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

## Style

- Prefer dependency-free JavaScript and pure state-machine helpers.
- Keep the everyday UI simple; use progressive disclosure for advanced controls.
- Add regression tests for every correctness or accessibility fix.
- User-visible failures must explain what happened and the next safe action.

## Commits and reviews

Use descriptive commit messages. PR descriptions should state scope, exclusions, validation, security/privacy impact, and manual test coverage.

By contributing, you agree that your contribution is licensed under the MIT License.
