# Security model

YOLO is a local browser extension with no remote backend, analytics, or bundled model access. Settings, queues, templates, counters, and bounded activity events remain in Chromium extension storage.

## Sensitive behavior

YOLO can type messages, refresh pages, and optionally click supported GitHub approval cards. These actions are bounded by per-conversation enablement, cooldowns, rolling limits, a total session cap, composer protection, route identity checks, and approval policies.

`Safe` approval policy is the default. Write actions require `Writes`; destructive actions require `All`. Classification considers the entire card text, not only the affirmative button label.

## Queue privacy

Full queued messages and templates are stored locally because persistence is the product feature. Activity events deliberately store only reason codes and short status messages, never full queued-message contents.

## Reporting

Treat unexpected clicks, duplicated queue sends, cross-conversation actions, and message leakage as security defects. Disable the conversation master switch immediately and preserve the activity log and reproduction steps when reporting them.
