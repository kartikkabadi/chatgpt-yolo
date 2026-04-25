# YOLO

YOLO is a personal-use Manifest V3 Chromium extension for `chatgpt.com`.

It keeps ChatGPT GitHub-agent sessions moving by:

- Auto-approving GitHub permission/action cards by clicking the right-side affirmative button.
- Recovering from ChatGPT error states by typing `Continue` into the composer and submitting it.
- Keeping settings per browser tab via content-script session state, which makes split-view ChatGPT sessions safer.

## Load Unpacked

1. Open `chrome://extensions` or `helium://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder: `/Users/user/Documents/Projects/chatgpt-github-continue`.
5. Open or refresh a `https://chatgpt.com/` tab, then use the YOLO popup.

## MVP Test Plan

- Test two ChatGPT tabs side by side and confirm YOLO mode is independent per tab.
- Confirm GitHub approval cards click only the right affirmative button.
- Confirm left negative buttons such as Deny, Reject, or Cancel are never clicked.
- Confirm red error or Retry states send `Continue` through the input box and do not click Retry.
- Confirm active generation is not interrupted.
