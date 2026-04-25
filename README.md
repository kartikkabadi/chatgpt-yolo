# YOLO

YOLO is a personal-use Manifest V3 Chromium extension for `chatgpt.com`.

It keeps ChatGPT GitHub-agent sessions moving by:

- Auto-approving GitHub permission/action cards by clicking the right-side affirmative button.
- Recovering from ChatGPT error states by refreshing first, then typing `Continue` if refresh is not safe.
- Nudging normal idle ChatGPT chats to review their last answer, go deeper, inspect gaps, and keep working without repeating themselves.
- Periodically refreshing enabled idle tabs every 3-5 minutes so heavyweight conversations can recover from stale React/error states.
- Waiting 40 seconds after page load before approval or refresh automation starts, which gives large ChatGPT conversations time to settle.
- Keeping settings per ChatGPT conversation URL, which makes split-view ChatGPT sessions safer.
- Self-injecting from the popup when possible, so an extension reload does not always require a manual page refresh.

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
- Confirm red error or Retry states prefer a slow refresh and reveal pending approval cards when ChatGPT reloads.
- Confirm Deep nudges only send after an idle period and do not fire while ChatGPT is generating.
- Confirm active generation is not interrupted.
