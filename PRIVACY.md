# Privacy

YOLO is designed to operate locally in the browser.

## Data collected by the project maintainer

None. YOLO has no analytics, telemetry, advertising, backend, user account, payment system, crash-reporting service, or remote logging endpoint.

## Local data

The extension stores the following in `chrome.storage.local`:

- Per-conversation settings and runtime counters.
- Queued instruction text and bounded queue event metadata.
- User-created templates.
- Active goal/loop objectives, bounded iteration state, runner leases, and response/user fingerprints.

YOLO does not intentionally persist full ChatGPT assistant responses. Queue event history is bounded and does not store full queued-message contents.

## Backups and diagnostics

Backup files are created only after an explicit export action and remain on your device unless you move or share them. They contain global settings, per-conversation settings, and template text, so treat them as private.

Backups do not include active queues, queued instructions, workflow objectives, delivery claims, retries, runtime history, or ChatGPT messages. Imports are fully validated, require confirmation, and use an expiring one-time preview token to reject changed files, replay, and concurrent portable-data changes.

Copied diagnostics contain only YOLO/browser versions, feature toggles, counts, queue states, and error/action codes. They exclude conversation identifiers and all prompt, template, queue, workflow-objective, and message text.

## Network behavior

YOLO does not call a project-owned server or the OpenAI API. It interacts with the ChatGPT page already open in your browser. The onboarding page opens `https://chatgpt.com/` only after you press its button.

## Browser and ChatGPT

Your use of Chrome/Chromium and ChatGPT remains subject to those products’ own privacy policies. YOLO cannot control what the browser or ChatGPT records.

## Removing data

Remove the extension and choose to clear its site/extension data in your browser, or use the reset controls in Advanced settings. Clearing one queue/workflow removes that conversation’s active state; restoring defaults does not delete templates unless you explicitly restore template defaults.

## Changes

Privacy-affecting changes must be called out explicitly in pull requests and release notes.
