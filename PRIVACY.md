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

## Network behavior

YOLO does not call a project-owned server or the OpenAI API. It interacts with the ChatGPT page already open in your browser. The onboarding page opens `https://chatgpt.com/` only after you press its button.

## Browser and ChatGPT

Your use of Chrome/Chromium and ChatGPT remains subject to those products’ own privacy policies. YOLO cannot control what the browser or ChatGPT records.

## Removing data

Remove the extension and choose to clear its site/extension data in your browser, or use the reset controls in Advanced settings. Clearing one queue/workflow removes that conversation’s active state; restoring defaults does not delete templates unless you explicitly restore template defaults.

## Changes

Privacy-affecting changes must be called out explicitly in pull requests and release notes.
