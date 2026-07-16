# Browser permissions

YOLO uses the smallest practical Manifest V3 permission set.

## `storage`

Stores settings, queue state, templates, counters, and bounded workflow state in `chrome.storage.local`.

## `activeTab`

Allows the popup to address the ChatGPT tab the user is currently using. It does not grant permanent access to unrelated tabs.

## `scripting`

Allows the popup or Advanced settings page to restore YOLO’s declared local content-script files when a ChatGPT tab was already open during installation or update. The injected files are packaged with the extension; no remote code is fetched.

## Host access

- `https://chatgpt.com/*`
- `https://*.chatgpt.com/*`

YOLO does not request broad web access. Adding another host is a privacy/security change and requires explicit review, documentation, and tests.
