# YOLO for ChatGPT

A local-first Chromium extension that turns long ChatGPT conversations into a reliable, queue-driven workspace with Codex-style commands, bounded autonomous workflows, safety controls, and a quiet task-first interface.

> **Independent project:** YOLO is not affiliated with or endorsed by OpenAI. It does not use the OpenAI API, run a backend, inject remote code, or collect telemetry.

## What it does

YOLO adds four layers to ChatGPT:

1. **A persistent queue** for instructions that should run when the conversation is ready.
2. **Composer-native YOLO actions**: automated workflows, prompt shortcuts, and extension controls.
3. **Bounded automation** for safe approval cards, recovery, nudges, and stale-tab refreshes.
4. **A Codex/ChatGPT-style interface** that keeps everyday actions simple and moves detailed controls into a searchable settings workspace.

Everything runs in your browser. Settings, queues, templates, and workflow state are stored in `chrome.storage.local`.

## Highlights

- Per-conversation persistent queues with drag ordering, editing, retry, pause, send-next, and fail-closed delivery recovery.
- `/goal <objective>` for marker-driven persistent objectives.
- `/loop [iterations] <objective>` for bounded iterative work; defaults to 12 and is hard-capped at 50 turns.
- `/plan`, `/review`, `/fix`, `/handoff`, and `/continue` prompt shortcuts.
- `/status`, `/pause`, `/resume`, `/stop`, `/settings`, and `/help` YOLO controls.
- Command palette from `/` in an empty composer or `Cmd/Ctrl + Shift + P`.
- Safe, Balanced, Fast, and Custom profiles.
- Conservative approval classification with Safe/Writes/All policies.
- Exact queue-delivery identity, multi-tab leases, optimistic workflow revisions, and bounded storage.
- Draft protection: automatic input pauses when the composer contains your text.
- Templates with `{{date}}`, `{{time}}`, `{{platform}}`, and `{{conversation}}` variables.
- Versioned settings/template backups and privacy-safe diagnostics.
- No runtime dependencies, no build step, no analytics, and no remote code.

## Install

### From a release archive

1. Download the latest `yolo-v*.zip` release asset and unzip it.
2. Open `chrome://extensions` in Chrome, Edge, Brave, Arc, or another Chromium browser.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the unzipped `yolo` folder.
5. Open or refresh a ChatGPT conversation.

### From source

```bash
git clone https://github.com/kartikkabadi/chatgpt-yolo.git
cd chatgpt-yolo
npm run validate
npm run package
```

Then load `dist/yolo` as an unpacked extension.

## First run

YOLO opens a local welcome page after a fresh install. The simplest setup is:

1. Open ChatGPT.
2. Keep the **Safe** or **Balanced** profile.
3. Add an instruction to the queue, or type `/` in the ChatGPT composer.
4. Enable automation for that conversation only when you are ready.

YOLO scopes queues, settings, and workflows to the normalized conversation URL.

## Slash actions

These are **YOLO extension actions**, not native ChatGPT or Codex commands. Automated workflows are implemented by YOLO. Prompt shortcuts simply turn an action into a visible queued prompt; they do not unlock hidden ChatGPT capabilities or modify ChatGPT's context window.

### Automated workflows

| Action | Purpose |
| --- | --- |
| `/goal <objective>` | Run a bounded persistent objective. Every turn must end with `[YOLO:CONTINUE]`, `[YOLO:DONE]`, or `[YOLO:BLOCKED]`. |
| `/loop [count] <objective>` | Run bounded iterations. Missing or malformed terminal markers pause the loop instead of guessing. |

### Prompt shortcuts

| Action | Purpose |
| --- | --- |
| `/plan <task>` | Queue a prompt asking ChatGPT to produce an execution plan. |
| `/review [scope]` | Queue an adversarial review prompt. |
| `/fix [scope]` | Queue a diagnose, repair, and validate prompt. |
| `/handoff [focus]` | Queue a prompt asking ChatGPT to write a continuation brief. It does **not** compact or alter ChatGPT context. |
| `/continue [direction]` | Queue a prompt to continue the current task with an optional direction. |

### YOLO controls

| Action | Purpose |
| --- | --- |
| `/status` | Show workflow, queue, runner, generation, profile, limits, and last action. |
| `/pause`, `/resume`, `/stop` | Pause, resume, or stop and clear the active workflow. |
| `/settings`, `/help` | Open Advanced settings or the action palette. |

Only standalone terminal markers control automated workflows. Inline marker-shaped text is ignored.

## Queue reliability

A background service worker owns every queue mutation. A content script must claim a queue item before sending it, persist submission intent before touching the composer, and then complete, release, or fail the exact claim.

YOLO fails closed when delivery is ambiguous. It does not automatically retry a message that may already have been submitted.

Other safeguards include:

- One active queue sender lease per conversation.
- Idempotent completion after lost acknowledgments.
- Strict pending order during retries.
- Bounded queue size, text capacity, completion history, events, and active conversations.
- Route identity checks after ChatGPT single-page navigation.
- Stable-response windows before a workflow advances.
- User-prompt fingerprints that stop a workflow when you manually change direction.

## Profiles and automation

- **Safe:** slower queue cadence, conservative limits, safe approval policy, no automatic nudges or refreshes.
- **Balanced:** normal cadence, safe approvals, and recovery enabled.
- **Fast:** faster cadence and higher limits while retaining safe approval policy.
- **Custom:** any manually adjusted configuration.

Advanced settings expose queue timing, retries, approvals, recovery, nudges, refresh, engine limits, templates, data portability, and reset actions. Search and section navigation keep those controls out of the everyday path.

## Backups and diagnostics

Advanced settings can download or restore a versioned JSON backup containing global settings, per-conversation settings, and templates. The entire file is validated before confirmation and application. A one-time preview token rejects a changed file, replay, expiry, or concurrent settings/template mutation.

Backups deliberately exclude active queues, queued instruction text, goals, workflow objectives, claims, retries, counters, and ChatGPT messages. Importing a backup cannot resume stale automation. If the current conversation is present in the backup, YOLO also synchronizes those restored settings into the open ChatGPT tab.

Privacy-safe diagnostics contain only versions, feature toggles, counts, queue states, and error/action codes. They exclude conversation identifiers and all user-authored prompt, template, queue, workflow-objective, and message text. See the [data portability contract](https://github.com/kartikkabadi/chatgpt-yolo/blob/main/docs/DATA_PORTABILITY.md).

## Permissions and privacy

YOLO requests only:

- `storage` — local settings, queues, templates, and workflow state.
- `scripting` — restore the extension’s packaged content scripts in matching ChatGPT tabs after installation or update.
- Host access to `https://chatgpt.com/*` and its subdomains — no other website is supported.

YOLO does not request `activeTab`, `tabs`, broad web access, or access to browser history. See [PRIVACY.md](PRIVACY.md) and [docs/PERMISSIONS.md](docs/PERMISSIONS.md) for the precise data and permission model.

## Development

Requirements: Node.js 20 or newer. There are no npm dependencies.

```bash
npm run check
npm test
npm run validate
npm run package
```

`npm run package` creates a clean, allowlisted extension directory at `dist/yolo`. It packages only runtime files plus the README, MIT license, notice, and privacy policy; it excludes tests, repository metadata, review scripts, and contributor-only documentation.

Architecture and invariants are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Contributions must preserve fail-closed delivery, conversation scoping, bounded automation, and the content-script order in `manifest.json`.

## Release verification

Every release must pass automated validation and a manual unpacked-extension smoke pass against the current live ChatGPT interface. ChatGPT does not expose a stable public DOM contract, so selector compatibility cannot be guaranteed by unit tests alone.

See [docs/RELEASING.md](docs/RELEASING.md) and [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Contributing and security

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SUPPORT.md](SUPPORT.md)

## License

MIT. See [LICENSE](LICENSE).
