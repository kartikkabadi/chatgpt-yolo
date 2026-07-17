# Wave D — README / Technical Accuracy Review (readme-conversion-3)

**Reviewer role:** Independent README + technical-accuracy reviewer (did not implement the reviewed artifacts).
**Date:** 2026-07-17
**Verdict:** ⚠️ **CHANGES REQUESTED** — the launch README copy itself is accurate and claim-safe, but two must-fix items block launch and one integration dependency must be resolved.

---

## 1. Scope and what was reviewed

The orchestration brief asked me to review `devin/launch-prep`. **That integration branch does not exist on the remote yet** (no `refs/heads/devin/launch-prep`). I reviewed the strongest available launch-README candidate and the actual extension against it:

- Launch README candidate: `marketing/README_DRAFT.md` on `origin/devin/wave-b-readme-copy` (the Wave-B conversion copy; this is what should replace `README.md` in the integrated PR).
- Current shipped `README.md` (baseline, `origin/main` / wave-b branch — still the pre-redesign version).
- `manifest.json`
- `onboarding.html`
- `docs/PERMISSIONS.md`
- `PRIVACY.md`
- `commands.js` (slash-action source of truth)
- Cross-checked: `config.js`, `command-ui.js`, `platforms.js`, `content.js`, `.github/FUNDING.yml`, `NOTICE.md`, `CHANGELOG.md`, and the test suite.

Method: every product claim in the README was traced to concrete extension behavior in code; permissions were compared to `manifest.json`; the repo was grepped for the brief's prohibited terms (Codex, AI agent, backend, telemetry, CLI, MCP, native messaging, GitHub integration).

---

## 2. Must-fix findings (block launch)

### F1 — "Codex" appears in shipped, user-facing extension metadata

The Wave D checklist requires **"no unsupported mention of Codex … in the extension,"** and brief §2 non-goals prohibit implying an OpenAI product or endorsement. Two shipped, user-facing surfaces violate this:

- **`manifest.json:6`** — `"description": "Local-first Codex-style workflows, reliable queues, and bounded automation for ChatGPT."`
  This string is the Chrome Web Store / `chrome://extensions` listing. It (a) says "Codex-style" and (b) does not match the brief's recommended repository/product description.
  **Fix:** use the brief-recommended text:
  `Local-first Chrome extension for reliable queues and bounded workflows in long ChatGPT conversations. Open source, no telemetry.`

- **`onboarding.html:15`** — `"…use Codex-style commands…"` (shown on the first-run welcome page).
  **Fix:** `…use YOLO commands…` or `…use composer-native YOLO actions…`.

Lower-priority Codex references (not launch-blocking, but should be cleaned during integration):
- `CHANGELOG.md:25` — "task-first Codex/ChatGPT-style interface" (historical entry; soften to "task-first ChatGPT-style interface").
- `docs/CODEX_UI_DESIGN.md` — internal design doc; **not shipped** (the packager excludes `docs/`), so low user-facing risk, but the filename/title still say "Codex." Rename/retitle for consistency.
- `tests/ui.test.js:94` / `repaired-validation.txt:192` — test name "Codex-style command shortcuts"; internal only.

**Acceptable (do not change):** `NOTICE.md` correctly uses "Codex" only as a trademark attribution ("used only to describe compatibility and design inspiration"). That is the appropriate, honest use.

### F2 — Sponsor link exposes unrelated "vex-app" branding (needs verification)

Brief §4 item 6 explicitly requires confirming **"no unrelated Vex branding or confusing copy undermines YOLO's sponsorship request."**

- `.github/FUNDING.yml` custom link and `marketing/README_DRAFT.md` (lines 17 & 280) both point to `https://whop.com/vex-app/support-for-oss/`.
- The visible slug **`vex-app`** is unrelated to YOLO and can confuse a visitor clicking "Sponsor development."

Per the brief, **do not replace the funding service or invent a new one.** But before launch, the sponsorship/accessibility reviewer (or orchestrator) must confirm on the **live page** that: it presents YOLO clearly (no confusing Vex branding), it is publicly accessible, and it offers the $5 and $10 options the README promises. I could not verify the live page from this environment. If the live page cannot be made to read clearly for YOLO, the README's "$5 or $10" wording must be softened rather than the link swapped. **This is a cross-cutting item deferred to the Wave-D sponsorship reviewer; flagging here because it surfaces directly in the README copy.**

---

## 3. Integration dependency (must resolve before the launch PR is complete)

### F3 — README references assets that do not exist on the reviewed branch

`marketing/README_DRAFT.md` links:
- `docs/assets/hero.webp` (line 15)
- `docs/assets/screenshot-{queue,command-palette,workflow,github-workflow,settings}.webp` (lines 112–125)
- `docs/assets/demo-poster.webp` (line 131)

`docs/assets/` does not exist on `devin/wave-b-readme-copy`. These are produced by the Wave-C image/capture agents. In the integrated `launch-prep` PR they **must** be present, or the launch README renders with broken images. Not a copy defect — an integration ordering dependency. Also note `README_DRAFT.md` still lives under `marketing/`; the integration step must actually promote it to the repo-root `README.md` (the current root `README.md` is still the pre-redesign version).

---

## 4. Minor / advisory

### A1 — GitHub section slightly understates the (opt-in) approvals feature
The README's GitHub section says YOLO "does not add or change [GitHub capabilities]; it only coordinates the next prompts." The extension actually contains approval-card automation (`platforms.js` `GITHUB_CONTEXT_RE`, `findApprovalCards`, `approvalVerbAllowed`) that can auto-click GitHub-related approval buttons — **but only** when the user explicitly enables approvals (off by default in every profile, `config.js`) and, for sensitive/destructive actions, only under the `all` policy. This is **not** a contradiction: YOLO still receives no GitHub credentials or repository data, and approvals are documented in the Profiles section. Advisory only: "only coordinates the next prompts" is a mild understatement; consider ensuring the GitHub section does not over-narrow what the extension can do on an opted-in approval prompt.

### A2 — Undocumented extra shortcut
`command-ui.js:346-347` also opens the palette on `Cmd/Ctrl + K` when the composer is focused, in addition to the documented `/` and `Cmd/Ctrl + Shift + P`. Harmless; optionally mention it.

---

## 5. Verified accurate — every product claim maps to real behavior

| README claim | Source of truth | Result |
| --- | --- | --- |
| 13 slash actions (goal, loop, plan, review, fix, handoff, continue, status, pause, resume, stop, settings, help) | `commands.js` `COMMANDS` | ✅ exact match |
| `/loop` defaults to 12, hard-capped at 50 | `commands.js` `DEFAULT_MAX_ITERATIONS=12`, `MAX_ITERATIONS=50` | ✅ |
| Terminal markers `[YOLO:CONTINUE/DONE/BLOCKED]`; inline marker text ignored | `commands.js` `STANDALONE_MARKER_RE`, `TERMINAL_MARKER_RE`, `evaluateResponse` | ✅ |
| `/handoff` does not compact/alter ChatGPT context | `commands.js` `oneShotPrompt("handoff")` | ✅ |
| Palette via `/` in empty composer or `Cmd/Ctrl+Shift+P` | `command-ui.js:346-357` | ✅ |
| Profiles: Safe, Balanced, Fast, Custom; default Balanced | `config.js` (`profile` enum, presets) | ✅ |
| Approvals off by default; sensitive/destructive require `all` policy | `config.js` `approvalsEnabled:false`, `approvalPolicy` enum; `platforms.js:285` | ✅ |
| Template variables `{{date}} {{time}} {{platform}} {{conversation}}` | `config.js:370` `renderTemplate` | ✅ |
| Permissions: `storage`, `alarms`, `scripting` + `https://chatgpt.com/*`, `https://*.chatgpt.com/*` only | `manifest.json:9-17` | ✅ exact, **not overstated** |
| Does NOT request `activeTab`, `tabs`, native messaging, broad web, cookies, history | `manifest.json` + `tests/overnight-reliability.test.js:53-54` | ✅ |
| No backend / telemetry / analytics / MCP / CLI / native-messaging / remote code | grep of runtime `*.js`; `verify:extension` boundary; `PRIVACY.md`; release tests | ✅ none present |
| GitHub app is separate from YOLO; YOLO never receives GitHub credentials/repo data | No GitHub API/credential handling in runtime; `GITHUB_CONTEXT_RE` only reads on-page approval DOM | ✅ accurate |
| Independent-project / no-OpenAI-affiliation disclaimer near top | `README_DRAFT.md:7`, `NOTICE.md`, `onboarding.html:35` | ✅ present |
| Slash actions labeled "YOLO extension actions, not native ChatGPT commands" | `README_DRAFT.md:171` | ✅ present |

**Permissions/host list:** not overstated — the README understates nothing and overstates nothing; it exactly mirrors the manifest.

**Prohibited-claim scan of the README copy:** the README does **not** claim YOLO is an AI model, autonomous agent, agent platform, OpenAI product, GitHub integration, MCP server, backend, CLI, or unbounded loop. The GitHub section correctly keeps ChatGPT's GitHub app separate from YOLO. Clean.

---

## 6. Verdict and recommended next actions

**CHANGES REQUESTED.** The README conversion copy is technically accurate, claim-safe, and well-scoped; the blockers are in adjacent shipped surfaces and integration, not in the prose.

1. **F1 (blocking):** remove "Codex" from `manifest.json` description (use the brief's recommended text) and `onboarding.html`; clean the secondary Codex references. Owner: repository-integration agent.
2. **F2 (blocking, verify):** verify the live Whop `vex-app` sponsor page reads clearly for YOLO and offers $5/$10; otherwise soften README sponsorship wording. Owner: Wave-D sponsorship reviewer / orchestrator.
3. **F3 (integration):** ensure `docs/assets/*` exist and that `README_DRAFT.md` is promoted to root `README.md` in the integrated PR. Owner: integration agent.
4. A1/A2 are advisory and optional.

Once F1–F3 are addressed in the integrated `launch-prep` branch, re-review is recommended (this artifact must have ≥3 independent README reviewers per the brief).
