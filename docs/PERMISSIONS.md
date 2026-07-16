# Browser permissions

YOLO uses the smallest practical Manifest V3 permission set.

## `alarms`

Wakes the lightweight background tab supervisor about once per minute. The supervisor restores missing packaged content scripts and updates Chrome's `autoDiscardable` hint for active Goal/Loop tabs. It never reloads, activates, closes, or reads arbitrary tabs.

## `storage`

Stores settings, queue state, templates, counters, and bounded workflow state in `chrome.storage.local`.

## `scripting`

Allows the popup or Advanced settings page to restore YOLO’s declared local content-script files when a ChatGPT tab was already open during installation or update. The injected files are packaged with the extension; no remote code is fetched.

YOLO uses its narrowly declared ChatGPT host access for these injections, so the additional `activeTab` permission is unnecessary.

## Host access

- `https://chatgpt.com/*`
- `https://*.chatgpt.com/*`

Host access also lets YOLO identify matching ChatGPT tabs without requesting the broad `tabs` permission. Creating the local onboarding tab or opening ChatGPT uses Tabs API operations that do not require `tabs` permission.

YOLO does not request broad web access. Adding another host is a privacy/security change and requires explicit review, documentation, and tests.
