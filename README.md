# YOLO

YOLO is a personal Chromium extension for reliably continuing long-running ChatGPT work. It combines a persistent message queue with bounded automation for approvals, error recovery, deep nudges, and stale-tab refreshes.

Version `0.6.0` replaces the original hard-coded extension with a queue-first architecture designed for real daily use: a small primary interface, advanced controls when needed, central queue ownership, per-conversation state, retries, limits, templates, diagnostics, and automated validation.

## Core workflow

1. Open a ChatGPT conversation.
2. Add one or more messages to the YOLO queue.
3. Drag messages into the order you want.
4. Leave the queue running or manually send the next item.
5. YOLO waits until generation stops, the configured idle window passes, and the composer is safe before sending.

Queues persist across page refreshes and are isolated by conversation URL.


## Codex-inspired commands

YOLO adds a composer-native command palette to ChatGPT. Press `/` in an empty ChatGPT composer or use `Cmd/Ctrl + Shift + P` (or `Cmd/Ctrl + K`) to open it, then type to filter and use the arrow keys plus Enter to select.

Commands include:

- `/goal <objective>` — start a persistent marker-driven goal with visible pause, resume, edit, and clear controls.
- `/loop [iterations] <objective>` — run bounded iterative work; the default cap is 12 and the hard cap is 50.
- `/plan <objective>` — shape an execution plan before implementation.
- `/review [scope]` — run an adversarial evidence-based review.
- `/fix [scope]` — repair defects and validate the result.
- `/compact` — create a durable context handoff.
- `/continue` — continue deeply without repeating prior work.
- `/status` and `/queue` — inspect the active workflow, queue, generation state, profile, limits, and last action.
- `/pause`, `/resume`, `/clear`, `/settings`, and `/help` — control the workflow and extension.

Goal mode requires ChatGPT to end each response with `[YOLO:CONTINUE]`, `[YOLO:DONE]`, or `[YOLO:BLOCKED]`. A missing goal marker pauses the workflow instead of guessing. Loop mode treats a missing marker as continue but always stops at its iteration cap. Every generated command prompt enters the same background-owned queue and delivery lifecycle as manually queued messages.

## Primary interface

The popup intentionally exposes only the controls used constantly:

- Conversation automation on/off
- Safe, Balanced, Fast, or Custom profile
- Message composer
- Templates
- Add to queue or Add & send
- Drag-and-drop queue ordering
- Edit, retry, remove, pause/resume, send-next, and clear actions
- Compact recent activity and limit status
- Link to advanced settings

The previous wall of timing and policy fields has moved to the advanced page.

## Message queue

Each conversation has an independent persistent queue. Queue features include:

- Drag-and-drop reordering
- Keyboard-accessible up/down controls
- Inline editing through the main composer
- Add-to-front and immediately-send flow
- Pause and resume
- Manual retry for failed messages
- Configurable automatic retries and backoff
- Optional pause after the final failure
- Per-hour and per-session limits
- Bounded event history
- A 50-message and 120,000-character payload ceiling per conversation
- Explicit storage failures instead of falsely acknowledging lost writes
- Expiring send leases that prevent two tabs from sending the same queue simultaneously
- Automatic recovery of abandoned `sending` items after a tab or extension crash

A service worker owns every queue mutation. Content scripts must claim an item before sending and complete, release, or fail that claim afterward.

## Templates

YOLO ships with templates for continuing deeper, reviewing and fixing work, finishing a task, and summarizing progress. You can create, edit, and delete templates from Advanced settings.

Templates support:

- `{{date}}`
- `{{time}}`
- `{{platform}}`
- `{{conversation}}`

## Automation profiles

- **Safe:** slower queue cadence, conservative limits, safe approval policy, no automatic nudges or refreshes.
- **Balanced:** normal queue cadence and limits, safe approvals, recovery enabled.
- **Fast:** faster queue cadence and higher limits while retaining safe approval policy.
- **Custom:** any manually tuned configuration.

Changing an individual advanced field switches the conversation to Custom.

## Advanced controls

The advanced page contains all queue, timing, limit, and policy controls:

- Queue interval range, idle requirement, hourly limit, retry count, retry backoff, pause-on-failure
- Approval delay, cooldown, limit, and risk policy
- Recovery strategy, delay, cooldown, and limit
- Deep-nudge idle interval, cooldown, limit, and prompt
- Idle-refresh schedule, required idle duration, cooldown, and limit
- Page-load grace, scan interval, session action cap, and composer draft protection
- Template management
- Runtime history reset

## GitHub approval safety

Approval cards are classified using both the button label and the full card context.

- **Safe:** permission-style actions such as Allow, Approve, Run, Grant, or Confirm when the card has no write or destructive language.
- **Writes:** Safe actions plus Create, Update, Commit, Push, Apply, and similar repository writes.
- **All:** includes Merge, Delete, Remove, Close, Force, Reset, Revert, and similar destructive actions.

A destructive card whose button merely says `Confirm` is still destructive. `Safe` remains the default in every profile.

## Reliability model

- Queue mutations are serialized by the extension service worker.
- Only one unexpired queue claim may exist for a conversation.
- Claims expire and return to pending after a crashed sender.
- Completion is idempotent, so a lost acknowledgment cannot cause the same message to be sent twice.
- Ambiguous post-submit outcomes pause the queue and require explicit manual recovery instead of automatic retry.
- Delivery is not completed until the page observably clears the composer or begins generation.
- Active queues are bounded across conversations; read-only visits do not consume queue slots.
- Delayed actions carry the exact conversation identity where they started and abort after SPA navigation.
- Settings use independent per-conversation storage keys to avoid multi-tab map-write races.
- Duplicate tabs receive live settings changes.
- Approval targets are rediscovered and reclassified after their delay before clicking.
- Repeated approval signatures expire instead of suppressing legitimate future cards forever.
- Generated input events do not count as user activity.
- Automatic message input pauses when a protected composer contains a draft.
- Event history is bounded and never stores full queued-message contents.

## Architecture

- `config.js` — schema, defaults, profiles, migration, URL scoping, limits, template rendering
- `queue.js` — pure queue state machine, claims, retries, pause reasons, events
- `background.js` — serialized persistent queue and template ownership
- `platforms.js` — ChatGPT DOM adapter and approval risk classification
- `content.js` — route-safe automation engine and DOM execution
- `popup.*` — compact everyday queue interface
- `options.*` — advanced controls and template management
- `tests/fixtures/` — approval-card behavior fixtures
- `tests/` — configuration, queue, background, adapters, UI startup, and manifest integrity

There is no build step and no runtime dependency.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` or the extension page in your Chromium browser.
3. Enable Developer mode.
4. Select **Load unpacked** and choose this repository folder.
5. Open or refresh a ChatGPT conversation.
6. Open YOLO and configure the conversation.

After updating the source, reload the extension and refresh already-open chat tabs.

## Shortcuts

Inside the queue composer:

- `Cmd/Ctrl + Enter` — add to queue
- `Cmd/Ctrl + Shift + Enter` — add to the front and try to send immediately

## Validate changes

Requires Node.js 20 or newer.

```bash
npm run validate
```

Validation performs syntax checks for every extension entry point and runs the complete dependency-free test suite.

## Manual release checklist

- Popup opens on ChatGPT and stays unavailable elsewhere.
- Safe, Balanced, and Fast profiles save and reload correctly.
- Two conversation URLs maintain independent settings and queues.
- Two tabs on the same conversation cannot send queue items concurrently.
- Queue items can be added, edited, dragged, moved with buttons, retried, removed, paused, resumed, and cleared.
- A refresh during `sending` eventually returns an expired claim to pending.
- A lost completion response is safely retried without duplicating the message.
- A submit action that cannot be confirmed fails closed with delivery status unknown and requires an explicit manual retry; it is never automatically retried.
- Queue delivery never interrupts active generation.
- Queue delivery respects the configured draft-protection setting.
- Automatic retries follow backoff and pause after the configured final failure.
- Templates render supported variables and custom templates persist.
- Safe approvals reject write and destructive fixture cases.
- A real ChatGPT GitHub approval card is rediscovered after the delay before clicking.
- Error recovery, manual Continue, deep nudge, and idle refresh still work.
- SPA navigation aborts delayed actions from the previous conversation.
- Extension reload does not leave duplicate message listeners.
- `npm run validate` and GitHub Actions both pass on the final commit.

## Known external dependency

ChatGPT does not provide a stable public DOM contract for browser extensions. The adapter is isolated and fixture-tested, but every release still requires one unpacked-extension smoke pass against the current live interface.
