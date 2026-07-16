# YOLO for ChatGPT

A local-first Chromium extension that turns long ChatGPT conversations into a reliable, queue-driven workspace with bounded workflows, safety controls, and a quiet task-first interface.

> **Independent project:** YOLO is not affiliated with or endorsed by OpenAI. It does not use the OpenAI API, run a backend, inject remote code, or collect telemetry.

## What it does

YOLO adds four layers to ChatGPT:

1. **A persistent queue** for instructions that should run when the conversation is ready.
2. **Composer-native actions** for bounded workflows, prompt shortcuts, and extension controls.
3. **Safety controls** for approvals, recovery, nudges, stale tabs, and ambiguous delivery.
4. **A focused interface** that keeps everyday actions simple and moves detailed controls into Advanced settings.

Everything runs in the browser. Settings, queues, templates, and workflow state are stored in `chrome.storage.local`.

## Highlights

- Per-conversation persistent queues with drag ordering, editing, retry, pause, send-next, and fail-closed delivery recovery.
- `/goal <objective>` for marker-driven persistent objectives.
- `/loop [iterations] <objective>` for bounded iterative work; defaults to 12 and is hard-capped at 50 turns.
- `/plan`, `/review`, `/fix`, `/handoff`, and `/continue` prompt shortcuts.
- `/status`, `/pause`, `/resume`, `/stop`, `/settings`, and `/help` extension controls.
- Command palette from `/` in an empty composer or `Cmd/Ctrl + Shift + P`.
- Safe, Balanced, Fast, and Custom profiles.
- Approvals are off by default and require explicit opt-in; sensitive permissions and destructive actions require the All policy.
- Exact message receipts, durable queue-delivery identity, cross-tab side-effect leases, optimistic workflow revisions, and bounded storage.
- Mandatory draft protection: YOLO never replaces text already present in the composer.
- Templates with `{{date}}`, `{{time}}`, `{{platform}}`, and `{{conversation}}` variables.
- Versioned settings/template backups and privacy-safe diagnostics.
- No runtime dependencies, build framework, analytics, hosted service, or remote code.

## Product boundary

YOLO is deliberately a **normal Chrome extension**, not an agent platform.

The core repository does not include coding-agent hooks, a CLI, local daemon, MCP server, native-messaging host, filesystem or Git access, automatic code review/repair, or a hosted backend. Related experiments belong in separate repositories so the extension stays understandable, auditable, and easy to install.

See [Product direction](docs/PRODUCT_DIRECTION.md) for the principles, non-goals, roadmap, and success measures.

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

YOLO runs durable automation only inside saved ChatGPT conversations with a stable `/c/<conversation-id>` URL. New-chat and transient routes remain manual until ChatGPT assigns a durable conversation URL.

## Slash actions

These are **YOLO extension actions**, not native ChatGPT commands. Automated workflows are implemented by YOLO. Prompt shortcuts turn an action into a visible queued prompt; they do not unlock hidden ChatGPT capabilities or modify ChatGPT's context window.

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

A background service worker owns every queue mutation. **Every automatic text submission**—queued instructions, workflow turns, recovery Continue prompts, and deep nudges—uses this one durable outbox. A content script must claim an item, persist submission intent before touching the composer, verify the composer retained the exact text, and observe a new matching user message before completing the exact claim.

YOLO fails closed when delivery is ambiguous. It does not automatically retry a message that may already have been submitted. Repeated automatic prompts are deduplicated across tabs during their cooldown window.

Other safeguards include:

- One active queue sender lease per conversation.
- One background-owned cross-tab guard for approvals and refreshes.
- Executing side effects that lose their outcome become **unknown** and remain blocked until an explicit runtime reset.
- Idempotent completion after lost acknowledgments.
- Strict pending order during retries.
- Bounded queue size, text capacity, completion history, events, and active conversations.
- Route identity checks after ChatGPT single-page navigation.
- Stable-response windows before a workflow advances.
- User-prompt fingerprints that stop a workflow when you manually change direction.

## Profiles and automation

- **Safe:** slower queue cadence, conservative limits, approvals off, no automatic nudges or refreshes.
- **Balanced:** normal cadence, approvals off, and recovery enabled.
- **Fast:** faster cadence and higher limits, with approvals still off until explicitly enabled.
- **Custom:** any manually adjusted configuration.

Advanced settings expose queue timing, retries, approvals, recovery, nudges, refresh, engine limits, templates, data portability, and reset actions. Search and section navigation keep those controls out of the everyday path.

## Backups and diagnostics

Advanced settings can download or restore a versioned JSON backup containing global settings, per-conversation settings, and templates. The entire file is validated before confirmation and application. A one-time preview token rejects a changed file, replay, expiry, or concurrent settings/template mutation.

Backups deliberately exclude active queues, queued instruction text, goals, workflow objectives, claims, retries, counters, and ChatGPT messages. Importing a backup cannot resume stale automation. If the current conversation is present in the backup, YOLO also synchronizes those restored settings into the open ChatGPT tab.

Privacy-safe diagnostics contain only versions, feature toggles, counts, queue states, and error/action codes. They exclude conversation identifiers and all user-authored prompt, template, queue, workflow-objective, and message text. See the [data portability contract](docs/DATA_PORTABILITY.md).

## Permissions and privacy

YOLO requests only:

- `storage` — local settings, queues, templates, and workflow state.
- `alarms` — bounded scheduling while the Manifest V3 service worker is asleep.
- `scripting` — restore packaged content scripts in matching ChatGPT tabs after installation or update.
- Host access to `https://chatgpt.com/*` and its subdomains — no other website is supported.

YOLO does not request `activeTab`, `tabs`, optional localhost access, native messaging, broad web access, cookies, or browser-history access. See [PRIVACY.md](PRIVACY.md) and [Browser permissions](docs/PERMISSIONS.md) for the precise data and permission model.

## Compatibility and responsibility

YOLO automates a third-party web interface whose DOM and behavior can change without notice. It does not bypass rate limits, access controls, safety systems, or subscription restrictions. Users are responsible for ensuring their use complies with applicable service terms and local law.

Model output remains probabilistic. YOLO's workflow markers and queue receipts provide control-flow reliability; they do not make the model's answer correct. Consequential work still needs appropriate verification.

## Development

Requirements: Node.js 20 or newer. There are no npm dependencies.

```bash
npm run check
npm test
npm run verify:extension
npm run validate
npm run package
```

`npm run verify:extension` enforces the extension-only boundary: narrow permissions and hosts, no optional localhost/native surfaces, no remote or dynamic code, and no CLI/agent/server files in the runtime allowlist.

`npm run package` creates a clean, allowlisted extension directory at `dist/yolo`. It packages only runtime files plus the README, MIT license, notice, and privacy policy; it excludes tests, repository metadata, contributor documentation, and development scripts.

Architecture and invariants are documented in [Architecture](docs/ARCHITECTURE.md) and the [Reliability model](docs/RELIABILITY_MODEL.md). Contributions must preserve fail-closed delivery, durable conversation scoping, mandatory draft protection, bounded automation, and the content-script order in `manifest.json`.

## Release verification

Every release must pass automated validation and a manual unpacked-extension smoke pass against the current live ChatGPT interface. ChatGPT does not expose a stable public DOM contract, so selector compatibility cannot be guaranteed by unit tests alone.

See [Releasing](docs/RELEASING.md) and [Troubleshooting](docs/TROUBLESHOOTING.md).

## Contributing and security

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Support](SUPPORT.md)

## License

MIT. See [LICENSE](LICENSE).
