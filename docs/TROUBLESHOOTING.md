# Troubleshooting

## Popup says Unavailable

Open a ChatGPT conversation, reload YOLO at `chrome://extensions`, and refresh the tab. YOLO intentionally stays unavailable on unsupported sites.

## Commands do not appear

Refresh the ChatGPT tab after installing/updating the extension. Type `/` into an empty composer or use `Cmd/Ctrl + Shift + P`. Advanced settings and the popup can also restore the complete local content-script stack.

## Queue will not send

Check whether:

- ChatGPT is still generating.
- The queue or conversation automation is paused.
- The composer contains a protected draft.
- An hourly/session limit is reached.
- A previous send has an ambiguous delivery outcome and requires manual retry.
- The current profile has queue auto-run disabled.

Open Activity or run `/status` for the current reason.

## Goal or loop pauses

A `/goal` pauses when ChatGPT omits a standalone terminal control marker, when manual user activity changes the conversation, when delivery identity cannot be proven, or when a safety/storage limit is reached. `/loop` also stops at its iteration cap.

## ChatGPT UI changed

ChatGPT’s DOM is not a public stable API. Capture the visible behavior, browser version, and the smallest reproducible page state. Do not include private conversation content. Selector fixes should be isolated in `platforms.js` and accompanied by fixtures/tests.

## Reset

Advanced settings provides separate actions for runtime history, automation defaults, and template defaults. Destructive actions require confirmation.
