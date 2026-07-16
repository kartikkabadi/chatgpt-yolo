# Data portability

YOLO backups intentionally include **configuration and templates only**.

## Included

- Global automation defaults.
- Per-conversation normalized settings.
- Reusable message templates.
- Backup schema/version and export timestamp.

## Excluded

- Active queues and queued instruction text.
- Active goals or loops and their objectives.
- Delivery claims, retries, completion history, runtime counters, cooldowns, and event history.
- ChatGPT conversation content or assistant responses.

Restoring stale automation state could submit old instructions or resume an objective in the wrong conversational context. Import therefore validates the entire backup, normalizes every setting against the current schema, rejects unsupported future formats, and applies settings/templates without touching live queues or workflows.

Diagnostics are a separate, privacy-safe summary. They may include YOLO/browser versions, selected profile, feature toggles, queue counts/states, and visible error codes, but never queued text, templates, workflow objectives, prompts, conversation identifiers, or conversation messages.
