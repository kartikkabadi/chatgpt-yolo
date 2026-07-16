# Architecture

## Layers

- `config.js`: schema, defaults, profiles, migration, URL scoping, limits, template rendering.
- `queue.js`: pure queue state machine, claims, retries, pause reasons, bounded events and completion identity.
- `commands.js`: command catalog, parsing, prompts, workflow normalization and response decisions.
- `background.js`: serialized storage ownership for queues, templates, and workflows.
- `platforms.js`: ChatGPT DOM adapter, message extraction, generation/error detection, and approval risk classification.
- `content.js`: route-safe browser automation and the narrow command API.
- `command-ui.js`: isolated Shadow DOM palette and workflow bar.
- `command-runtime.js`: per-conversation command execution, workflow leases, ownership, response stabilization, and continuation.
- `popup.*`: everyday queue interface.
- `options.*` and `options-ui.js`: advanced settings, templates, navigation, and search.

## Delivery protocol

1. The background service worker atomically adds or mutates queue state.
2. A content-script owner claims one pending item and receives a token.
3. The content script marks the item `submitting` before writing to the composer.
4. It submits and waits for observable confirmation: composer cleared or generation started.
5. It completes the exact claim. Lost completion acknowledgments are idempotent.
6. Pre-submit failures may retry with backoff. Ambiguous post-submit outcomes block for manual recovery.

## Workflow protocol

Workflow prompt insertion and workflow identity are committed atomically. Optimistic revisions reject stale writes. A renewable runner lease allows only one tab to advance a workflow. The runtime requires exact queue completion identity, verifies the latest user prompt still belongs to the workflow, and waits for a stable new assistant fingerprint before evaluating a terminal marker or loop continuation.

## Trust boundaries

The background owns persistent state. Content scripts own DOM observation and execution. UI pages request mutations but do not write queue/workflow storage directly. ChatGPT DOM selectors are an external unstable boundary and require manual release testing.
