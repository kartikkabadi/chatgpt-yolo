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

## Error-handling conventions

The codebase intentionally uses two error-handling conventions side by side. Keep them distinct and do not silently weaken either.

1. **Strict reject convention**: core state machines, locks, and storage transactions are strict. On failure they return `{ ok: false, reason }`, throw, or reject so the caller decides whether retry, block, or surface the failure to the user.
2. **Soft resolve-null convention**: browser extension entry points that cross the content-script, tab, or runtime boundary (e.g. message sends, tab queries, health checks) resolve to `null` or `false` instead of rejecting. Callers treat the soft value as "the requested spot is currently unavailable" and degrade gracefully without an unhandled rejection.

When you add or touch one of these soft paths, preserve the resolve-null semantics and add a `console.error` label so the failure is visible in extension logs:

```js
chrome.tabs.sendMessage(tabId, message, (response) => {
  if (chrome.runtime.lastError) {
    console.error(`My feature tab message failed: ${chrome.runtime.lastError.message}`);
    resolve(null);
  } else {
    resolve(response || null);
  }
});
```

**Warning**: several content-script fail-soft paths are load-bearing. Returning a rejected promise, throwing, or changing the fallback value can cause background scripts to treat a transient DOM issue as a fatal state reset. If you are unsure which convention applies, prefer the existing surrounding code.

## Module/global naming conventions

Three module patterns coexist. New code should match the file's existing pattern rather than introducing a fourth.

1. **UMD (`shared.js`, `lifecycle.js`)**: exports a value for `module.exports` and also assigns `globalThis.YOLOShared`. Use this for helpers that are used in both extension pages and content scripts.
2. **Plain IIFE (`options.js`, `popup.js`, `command-runtime.js`, `data-background.js`)**: a self-contained `(() => { ... })()` that reads peer globals from `globalThis` and often assigns a singleton back to `window` or `globalThis`. Use this for page-scoped or script-scoped state machines.
3. **Service worker (`background.js`, `background-wrapper.js`)**: a top-level script that runs in the extension service worker context and persists state in `chrome.storage`. No wrapper is used because the worker scope is already isolated.

Global/singleton naming follows two shapes:

- `YOLOCamelCase` for public namespaces: `YOLOShared`, `YOLOConfig`, `YOLOLifecycle`, `YOLOPlatforms`, `YOLOCommands`, `YOLOCommandUI`, `YOLOOptionsController`.
- `__YOLO_UPPER_SNAKE__` for per-context instance guards: `__YOLO_EXTENSION__`, `__YOLO_COMMAND_RUNTIME__`.

Do not introduce ad-hoc `window.*` globals outside these conventions. If a helper needs to be shared, put it in `shared.js` and expose it through `YOLOShared`.

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
