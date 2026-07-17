# Product Truth & Claim Audit — Wave A

**Repo:** `kartikkabadi/chatgpt-yolo`
**Agent role:** Wave A — Product truth and claim auditing
**Branch:** `devin/wave-a-product-truth`
**Scope:** Read-only audit. No product code or main `README.md` was modified. This report recommends wording changes for the README information-architecture and integration agents to apply in the final launch PR.

Sources reviewed: `README.md`, `manifest.json`, `package.json`, `CHANGELOG.md`, `PRIVACY.md`, `NOTICE.md`, `docs/PRODUCT_DIRECTION.md`, `docs/PERMISSIONS.md`, `docs/RELIABILITY_MODEL.md`, `docs/ARCHITECTURE.md`, `.github/FUNDING.yml`, and the runtime source (`manifest.json` content scripts, `config.js`, `commands.js`, `background*.js`, `platforms.js`, `content.js`).

---

## Findings

### 1. The current README is already largely truthful and non-goal-compliant

The existing README does **not** make any of the prohibited claims from the brief. It actively defends the product boundary:

| Prohibited claim (brief §2) | README status |
| --- | --- |
| AI model | Not claimed. README §"Compatibility and responsibility" states model output is probabilistic and YOLO "do[es] not make the model's answer correct." Accurate. |
| Autonomous coding agent / agent platform | Explicitly denied: "deliberately a **normal Chrome extension**, not an agent platform." |
| OpenAI product / endorsement | Top-of-file disclaimer: "Independent project: YOLO is not affiliated with or endorsed by OpenAI." |
| GitHub integration / credential holder | README makes no GitHub-access claim (no GitHub feature exists in the extension). |
| Coding-agent orchestrator | Denied in "Product boundary" ("no… agent orchestration" cross-refs `PRODUCT_DIRECTION.md`). |
| Terminal / filesystem / Git tool | Denied: "no… filesystem or Git access." |
| MCP server / native-messaging host | Denied in "Product boundary" and `PRODUCT_DIRECTION.md` non-goals. |
| Backend service | Denied: "No… hosted service, or remote code." |
| Unbounded loop | Denied: `/loop` "defaults to 12 and is hard-capped at 50 turns"; "Never imply an endless loop." |
| Rate-limit bypass | Denied: "does not bypass rate limits, access controls, safety systems, or subscription restrictions." |
| Unlock hidden ChatGPT capabilities | Denied: prompt shortcuts "do not unlock hidden ChatGPT capabilities or modify ChatGPT's context window." |
| Native ChatGPT slash commands | Denied: "These are **YOLO extension actions**, not native ChatGPT commands." |

The `/goal` / `/loop` limits in the README (default 12, hard cap 50) are verified against source: `commands.js` defines `DEFAULT_MAX_ITERATIONS = 12` and `MAX_ITERATIONS = 50`, with a `command.workflow.cap_reached` pause at the cap.

### 2. **HIGH — "Codex-style" wording is a live OpenAI-association / coding-agent risk (public-facing)**

"Codex" is an OpenAI product name (OpenAI Codex / Codex CLI, an AI coding agent). Using "Codex-style" in public-facing surfaces risks implying (a) OpenAI affiliation and (b) that YOLO is itself a coding agent — both explicitly prohibited by the brief (§2 non-goals, "Do not visually imply OpenAI endorsement"). Occurrences:

- **`manifest.json` line 6 (highest priority — this is the Chrome extension listing / store description):**
  `"description": "Local-first Codex-style workflows, reliable queues, and bounded automation for ChatGPT."`
  This is the string users see in `chrome://extensions` and any store listing. "Codex-style workflows" is the single most exposed at-risk claim in the repo.
- **`onboarding.html` line 15 (user-facing first-run page):** "use Codex-style commands".
- **`CHANGELOG.md` line 25:** "task-first Codex/ChatGPT-style interface".
- **`docs/CODEX_UI_DESIGN.md`:** internal design contract titled "Codex-style UI design contract" (internal doc; lower exposure).
- **`NOTICE.md` line 5** already acknowledges "Codex" as an OpenAI trademark "used only to describe compatibility and design inspiration" — a mitigating factor, but it does not neutralize the public manifest/onboarding wording.

Note the inconsistency: `package.json`'s `description` is already clean ("Local-first queues, bounded workflows, and safety controls for ChatGPT in Chromium browsers.") while `manifest.json`'s is not.

### 3. **HIGH — README Install section promises a release archive that does not exist**

README §Install → "From a release archive" says: "Download the latest `yolo-v*.zip` release asset and unzip it." Verified: `gh release list` returns **no releases** and `git tag` returns **no tags**. This makes a launch-critical instruction currently false (brief §15: "Do not let the README say 'download the latest release' when no usable release exists"). This is primarily the release-readiness agent's responsibility, but it is a claim-truth defect and is flagged here. The "From source" path is accurate and works.

### 4. **MEDIUM — Sponsorship destination carries unrelated "vex-app" branding**

`.github/FUNDING.yml` sets `custom: "https://whop.com/vex-app/support-for-oss/"`. The brief (§4) warns against "unrelated Vex branding or confusing copy" undermining YOLO's sponsorship request, and any README sponsorship copy claiming "$5 or $10" must be verified against the live page. This is the sponsorship agent's scope; flagged here as a cross-cutting truth dependency — README sponsor amounts must not be asserted until the live page is confirmed.

### 5. **LOW — "local-first" vs "local-only" (wording is defensible, do not weaken)**

README/manifest use "local-first"; storage is entirely `chrome.storage.local` (no `chrome.storage.sync`, no backend, no `fetch`/`XMLHttpRequest`/`eval`/`new Function` in runtime code; `importScripts` loads only packaged local files). "Local-first" is accurate and conservative. The brief itself uses "local-first" as the trust proof, so keep it. No change needed; noted for completeness.

### 6. **LOW — Opening hook leads with mechanism, not pain (positioning, not falsehood)**

README line 3 opens with "turns long ChatGPT conversations into a reliable, queue-driven workspace…". This is truthful but leads with the mechanism. Brief §8 wants the pain-led hook ("Stop babysitting long ChatGPT tasks") first and "local-first" as trust proof, not the opening. This is the README-IA agent's remit; no truth defect, noted for handoff.

---

## Confirmed product facts (for downstream agents to cite safely)

- **Permissions (`manifest.json`):** `alarms`, `scripting`, `storage` only. No `activeTab`, `tabs`, `cookies`, `history`, `nativeMessaging`, or optional/host-broadening permissions. Matches README §Permissions and `docs/PERMISSIONS.md` exactly.
- **Host permissions:** `https://chatgpt.com/*` and `https://*.chatgpt.com/*` only. Content scripts match the same two patterns. No other site.
- **Storage model:** `chrome.storage.local` only. No sync storage, no remote persistence, no account system.
- **Network:** No project-owned server and no OpenAI API calls. `PRIVACY.md`: onboarding opens `https://chatgpt.com/` only after the user clicks. No `fetch`/XHR to any endpoint in runtime code.
- **No remote/dynamic code:** `importScripts` references only packaged local files (`background-wrapper.js`, `background.js`); CSP is `script-src 'self'`. `npm run verify:extension` enforces this boundary.
- **No telemetry / analytics / backend:** Confirmed in `PRIVACY.md`, `RELIABILITY_MODEL.md` §3, and absence of any network egress.
- **Bounded automation:** `/loop` default 12, hard cap 50 (`commands.js`); `/goal` marker-driven and bounded; fail-closed on ambiguous markers/delivery.
- **Draft protection:** Mandatory, cannot be disabled via imported/legacy settings (`RELIABILITY_MODEL.md` §3).
- **No runtime dependencies:** `package.json` has no `dependencies`; Node 20+ used only for dev tooling.
- **Slash actions are extension actions**, not native ChatGPT commands, and do not modify ChatGPT's context window — matches source (`commands.js` command catalog + prompt insertion).

---

## Recommended wording changes (for README-IA / integration agents to apply)

These are recommendations only; this agent did not edit `README.md` or product code.

1. **`manifest.json` description (HIGH):** replace `"Local-first Codex-style workflows, reliable queues, and bounded automation for ChatGPT."` with a non-Codex, brief-aligned line, e.g.:
   > `Local-first Chrome extension for reliable queues and bounded workflows in long ChatGPT conversations.`
   Note: `manifest.json` is product code (freeze-scope, brief §6). This change is truth-motivated (removes an OpenAI-association implication), minimal, and should be independently reviewed and covered by a test-string update. Coordinate with the orchestrator before editing runtime files.
2. **`onboarding.html` line 15 (HIGH):** replace "use Codex-style commands" with "use YOLO commands" (or "use YOLO slash actions").
3. **`CHANGELOG.md` line 25 (MED):** replace "task-first Codex/ChatGPT-style interface" with "task-first, ChatGPT-native interface" (drop "Codex").
4. **README Install (HIGH):** do not present "Download the latest release" as available until a real release/tag exists. Either gate it behind the release-readiness agent producing `v1.1.0` (or current) release + `yolo-v*.zip` asset, or temporarily lead with the verified "From source" path.
5. **README slash-actions:** already uses "YOLO extension actions" / "YOLO controls" correctly — preserve this exact framing per brief §2. Do not weaken it during the redesign.
6. **Sponsorship copy:** do not assert "$5/$10" or specific benefits in the README until the sponsorship agent confirms the live Whop page and resolves the "vex-app" branding concern.
7. **Preserve verbatim:** the no-affiliation disclaimer (README line 5), the "not an agent platform" boundary, the rate-limit/access-control non-bypass statement, and the "probabilistic model output" caveat. Brief §8 explicitly forbids removing or weakening these.

---

## Decisions made

- Treated the audit as read-only per task instructions; produced recommendations rather than editing `README.md` or runtime files.
- Classified "Codex-style" wording as the top product-truth risk because it is public-facing (manifest listing + onboarding) and touches two separate non-goals (OpenAI association + coding-agent implication), despite the `NOTICE.md` trademark disclaimer.
- Flagged the non-existent release and the `vex-app` sponsorship branding as truth dependencies owned by other Wave agents, rather than resolving them here, to avoid edit collisions.
- Did not propose new GitHub-to-ChatGPT README wording (owned by the README-IA / GitHub-research agents); confirmed only that the extension currently makes **no** GitHub claim, so any new section must keep GitHub strictly on the ChatGPT side.

## Files changed

- Added: `marketing/research/product-truth-audit.md` (this report).
- No other files modified. `README.md` and all product code untouched.

## Validation performed

- `manifest.json` permissions/hosts/CSP read directly and cross-checked against README §Permissions and `docs/PERMISSIONS.md` — consistent.
- Runtime source grep for `fetch(`, `XMLHttpRequest`, `eval(`, `new Function`, `importScripts`, `api.openai`, `chrome.storage.sync`: no remote/dynamic code or sync storage in runtime; `importScripts` only loads packaged local files.
- `/loop` default/cap verified in `commands.js` (`DEFAULT_MAX_ITERATIONS = 12`, `MAX_ITERATIONS = 50`).
- `gh release list` and `git tag`: both empty — confirms no release archive exists.
- `.github/FUNDING.yml` inspected: `custom` → `https://whop.com/vex-app/support-for-oss/` (page reachability/amounts to be verified by sponsorship agent).
- Grep for `Codex` across the repo enumerated all six occurrences listed in Finding 2.

## Risks

- **If "Codex-style" ships in the manifest/onboarding**, reviewers or OpenAI could read it as an OpenAI-affiliated coding agent — the exact perception the launch must avoid. Highest-priority fix.
- **If README keeps "download the latest release" with no release**, first-time installers hit a dead end at launch, damaging trust.
- **Sponsorship amounts / vex-app branding** unverified here; asserting amounts prematurely would be an unbacked claim.
- Editing `manifest.json`/`onboarding.html` touches freeze-scope product code; must be minimal, reviewed, and test-covered to avoid violating brief §6.

## Recommended next action

1. Orchestrator: assign the three HIGH wording fixes (manifest description, onboarding line, README release instruction) to the integration agent, with the manifest/onboarding edits gated on independent review since they touch runtime files.
2. Release-readiness agent: produce a real release + `yolo-v*.zip` so the README Install claim becomes true.
3. Sponsorship agent: verify the Whop page, amounts, and resolve `vex-app` branding before any README sponsor copy is written.
4. Wave D product-claim reviewer: re-audit the final README + manifest + onboarding after edits, confirming no non-goal claim was reintroduced and the disclaimer/boundary text was preserved verbatim.
