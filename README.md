# YOLO

YOLO is a personal Chromium extension that keeps long-running ChatGPT and Grok conversations moving while giving you explicit control over timing, limits, and risk.

The original MVP proved the concept, but it coupled DOM detection, policy, timing, persistence, and UI into one hard-coded script. Version `0.5.0` turns it into a configurable automation engine instead of another pile of selectors and timers.

## What it can do

- Approve supported GitHub action and permission cards in ChatGPT.
- Recover failed conversations with configurable Continue/refresh strategies.
- Send a custom deep-work nudge after a conversation becomes idle.
- Refresh genuinely idle, stale conversations on a bounded schedule.
- Run Continue, nudge, or refresh manually from the popup.
- Keep settings isolated per conversation while reusing your latest defaults for new conversations.

## Controls and guardrails

Every automatic action has user-configurable delays, cooldowns, and rolling hourly limits. YOLO also has a total per-session action cap and pauses input actions whenever the composer contains a draft.

GitHub approvals have three policies:

- **Safe:** permission-style actions such as Allow, Approve, Run, or Confirm.
- **Writes:** safe actions plus Create, Update, Commit, Push, and similar repository writes.
- **All:** includes destructive actions such as Merge, Delete, Remove, Close, Force, Reset, or Revert.

`Safe` is the default. Destructive approvals are never silently enabled during migration.

## Architecture

- `config.js` owns defaults, validation, migration, URL scoping, and rate-limit primitives.
- `platforms.js` isolates ChatGPT/Grok DOM adapters and approval classification.
- `content.js` runs the state machine, action limits, persistence, route changes, and automation.
- `popup.html`, `popup.js`, and `styles.css` provide the control surface.
- `tests/` covers pure configuration and limiting behavior with Node's built-in test runner.

The extension deliberately has no build step and no runtime dependencies. Chromium loads the source files directly.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` (or your Chromium browser's extension page).
3. Enable Developer mode.
4. Select **Load unpacked** and choose the repository folder.
5. Open or refresh a ChatGPT or Grok conversation.
6. Open the YOLO popup and configure that conversation.

After pulling a new version, reload the extension from the extensions page and refresh any already-open chat tabs.

## Validate changes

Requires Node.js 20 or newer.

```bash
npm run validate
```

This performs syntax checks for every JavaScript entry point and runs the test suite.

## Manual acceptance checklist

- Settings persist independently across two different conversation URLs.
- Existing v0.4 boolean settings migrate to the new controls.
- Automatic actions never overwrite non-empty composer text.
- Safe approval mode does not click Merge, Delete, Remove, Close, Reset, or Revert actions.
- Hourly and session limits visibly block additional actions.
- Deep nudges wait for generation to stop and for the configured idle interval.
- Idle refresh never runs while generation is active or a draft is present.
- SPA navigation to another conversation loads that conversation's settings.
- ChatGPT approvals and ChatGPT/Grok prompt submission still work after an extension reload.

## Next work

The highest-value follow-ups are fixture-based DOM adapter tests, an options page for global presets, import/export, an event log, and a browser-driven smoke-test harness against saved ChatGPT/Grok DOM fixtures.
