# Reliability model

YOLO automates a changing third-party interface. It cannot obtain exactly-once delivery from ChatGPT, so its reliability target is **at-most-once side effects with explicit recovery**. When the extension cannot prove whether an action happened, it stops instead of guessing.

## Design questions and decisions

The implementation is evaluated against these questions before a behavior is added or changed:

1. What durable fact proves the happy path completed?
2. Can a transport acknowledgment be lost after the mutation committed?
3. Can two tabs perform the same action concurrently?
4. What survives a content-script reload or service-worker restart?
5. Can a route change move the action into another conversation?
6. Can user-authored composer text be overwritten?
7. Can DOM text make a sensitive or destructive action look harmless?
8. What happens if storage is full, corrupt, or concurrently changed?
9. What is bounded, and what happens when the bound is reached?
10. Is an automatic retry known-safe, or merely convenient?

## 1. Happy path

### Text submission

1. A saved conversation owns a durable queue.
2. The background service worker serializes mutations and grants one sender lease.
3. The sender persists the `submitting` phase before touching the composer.
4. The composer must be empty and must retain the exact queued text after insertion.
5. YOLO submits the composer.
6. Delivery is confirmed only when a **new user message** appears with the exact expected text.
7. The exact claim is completed idempotently and the queue advances.

Queue instructions, workflow prompts, recovery Continue prompts, and deep nudges all use this path.

### Non-text side effect

Approvals and refreshes use one background-owned guard per conversation and action type. A guard prevents concurrent tabs, persists cooldowns, and distinguishes a safely abandoned claim from an action that may already have executed.

## 2. Failure modes

| Failure | Required behavior |
| --- | --- |
| Storage write fails before submission | Do not touch the composer; report the failure. |
| Composer is missing or contains a draft | Do nothing; keep the queue item pending. |
| Composer does not retain exact text | Treat as a proven pre-submit failure; safe retry rules may apply. |
| Route changes before click | Release the claim and do not submit. |
| Click occurs but matching user message is not observed | Mark delivery unknown, pause the queue, require explicit retry or removal. |
| Queue completion acknowledgment is lost | Repeating completion is idempotent. |
| Side-effect claim expires before execution | Another tab may retry. |
| Side-effect execution begins and outcome is lost | Persist `unknown`; block automatic retries until manual reset. |
| Workflow marker is missing or malformed | Pause the workflow without guessing. |
| New/transient ChatGPT route | Do not run durable automation until a `/c/<id>` URL exists. |
| Capacity is reached | Reject the new mutation with an actionable error; never truncate active work silently. |

## 3. Abuse and security

- Approvals are disabled by default in every profile.
- Sensitive permissions, account access, credentials, secrets, tokens, and destructive actions require the explicit `all` policy.
- Candidates are re-discovered and re-classified immediately before clicking.
- Draft protection is mandatory and cannot be disabled through imported or legacy settings.
- Queue and workflow messages are bound to the sending tab's canonical conversation URL.
- Backups exclude queues, workflow objectives, delivery state, runtime history, and ChatGPT messages.
- No remote code, project backend, analytics, telemetry, broad host permission, or arbitrary page access is used.

## 4. Scale and performance

The extension is intentionally bounded:

- 50 items and 120,000 text characters per conversation queue.
- 25 active conversation queues and 25 active workflows.
- Bounded event, completion, template, runtime, preview, and action-guard histories.
- One serialized storage mutation path per state family.
- DOM scans are interval- and mutation-triggered, but side effects remain lease-protected.

The current queue map is retained because its bounds keep writes predictable and avoid a migration that would add more failure states. A per-conversation storage split should be considered only after profiling real storage latency near the documented limits.

## 5. Trade-offs

### At-most-once vs automatic recovery

YOLO chooses at-most-once behavior. A false stop is inconvenient; a duplicate prompt, approval, or destructive action can be materially harmful.

### Exact receipt vs fast acknowledgment

Waiting for a matching user message is slower than accepting an empty composer, but it avoids false success when the page clears locally, another tab generates, or the network rejects a send.

### Durable conversations vs new-chat convenience

Automation waits for a stable conversation ID. This prevents queue and workflow state from being stranded when ChatGPT changes the URL after the first message.

### Strict defaults vs convenience

Approvals default off and draft protection is mandatory. Users may opt into approvals, but the extension does not silently trade safety for speed.

### Bounded local state vs unbounded history

Histories are sufficient for recovery, diagnostics, and idempotency but deliberately capped to keep local storage and normalization predictable.

## Scenario simulations

- **Two tabs enqueue the same automatic Continue:** serialized queue mutation plus sliding-window deduplication stores one item.
- **Two tabs see the same approval:** one receives the guard; the other receives `action.busy` or cooldown.
- **Approval clicked, service worker unavailable before completion:** the executing guard eventually becomes `unknown`; no tab retries automatically.
- **Same prompt is submitted twice consecutively:** message-count advancement plus exact text confirms the second message correctly.
- **Composer clears but no user message appears:** delivery remains unconfirmed and the queue pauses fail-closed.
- **User types while a queue item is pending:** the item remains pending; YOLO never replaces the draft.
- **ChatGPT navigates from `/` to `/c/...`:** automation begins only after the durable route is loaded and settings are re-scoped.
- **Storage quota fails during intent persistence:** no composer interaction occurs.
- **Storage quota fails after a confirmed send:** completion can be retried idempotently; an unresolved claim expires into delivery-unknown.
- **Malformed workflow marker:** the workflow pauses and preserves its objective for explicit user action.

## Remaining external boundary

ChatGPT does not publish a stable DOM contract. Every release therefore still requires a manual unpacked-extension smoke pass against the live interface, in addition to deterministic state-machine, concurrency, fault-injection, package, and security tests.
