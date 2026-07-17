# Product-claims audit — YOLO for ChatGPT

**Wave:** D (independent review) · **Role:** product-claims audit
**Reviewer:** independent agent (did not implement the reviewed artifacts)
**Scope reviewed:** `README.md`, `CHANGELOG.md`, `onboarding.html`, `manifest.json`, `docs/PRODUCT_DIRECTION.md`, `docs/PERMISSIONS.md`, `docs/RELIABILITY_MODEL.md`, plus corroborating checks in `PRIVACY.md`, `NOTICE.md`, `options.html`, `commands.js`, `config.js`.
**Base audited:** `main` @ current head (see note below).
**Verdict:** **Conditional pass — do not launch until the P0 Codex/GitHub associations are corrected.**

---

## 0. Important scope note

The task briefed a base branch `devin/launch-prep`, but **that branch does not exist** on `origin`. Remote currently has `main`, the `devin/wave-a/*`, `devin/wave-b/*`, `devin/wave-c/*` branches, and several legacy `feature/*`, `hardening/*`, and `agent/*` branches — no integration branch.

This audit therefore reviews the **current public-facing product state on `main`**, which is what a visitor/installer sees today. When the launch-prep integration branch is created, re-run this audit against it — several P0 items below already live in shipping files (`manifest.json`, `onboarding.html`) and will carry into any integration branch unless explicitly fixed.

---

## 1. Claim table (claim → evidence → risk → recommendation)

Risk key: **P0** launch-blocking (false/misleading OpenAI/Codex/GitHub association) · **P1** should fix before launch · **P2** minor/polish · **OK** accurate & substantiated.

| # | Public claim | Source | Evidence / reality | Risk | Recommendation |
|---|---|---|---|---|---|
| 1 | "Local-first **Codex-style** workflows, reliable queues, and bounded automation for ChatGPT." | `manifest.json:6` (extension store/description string) | "Codex" is an OpenAI product name. YOLO is not Codex, not built on Codex, and the brief explicitly bans "Codex-style" claims and implying OpenAI association. This string is the most publicly visible claim (extension manager / store listing). | **P0** | Replace with the approved descriptor: "Local-first reliable queues and bounded workflows for long ChatGPT conversations." Remove "Codex". |
| 2 | "Queue the next instruction, use **Codex-style commands**, or run a bounded goal." | `onboarding.html:15` (first-run screen) | Same OpenAI-product implication; user's first impression. Commands are YOLO slash actions, not Codex. | **P0** | Reword to "use YOLO slash actions" or "use YOLO commands (`/goal`, `/loop`, `/review`)". |
| 3 | "Redesigned the popup and Advanced settings around a task-first **Codex/ChatGPT-style interface**." | `CHANGELOG.md:25` | Public changelog implies OpenAI/Codex design lineage/endorsement. | **P1** | Reword to "a task-first, calm, product-native interface." Drop "Codex". |
| 4 | Section eyebrow **"GITHUB ACTIONS"** over the Approvals settings; options for "Include **repository writes**", "**repository modifications**", search text `github ...`. | `options.html:99–105` | This is the strongest **false GitHub association** in the shipping UI. Product truth: YOLO has **no** GitHub access, credentials, repository permissions, commits, or PR access (`docs/PRODUCT_DIRECTION.md:28–40`, `README.md:34–40`). The Approvals feature clicks ChatGPT action cards generically; labeling it "GitHub Actions / repository writes" implies YOLO integrates with GitHub and can modify repositories. | **P0** | Remove the "GITHUB ACTIONS" eyebrow and GitHub/"repository writes" wording. Describe approvals generically: "Non-sensitive confirmations", "sensitive/destructive actions". Any GitHub capability belongs to ChatGPT's GitHub app, not YOLO. |
| 5 | Injected `/goal` prompt: "[YOLO:CONTINUE] when more **autonomous work** remains…" | `commands.js:212` | Non-goal list bans positioning YOLO as an "autonomous coding agent". Shipped prompt copy sent into ChatGPT uses "autonomous work". Low external visibility but reinforces the exact framing to avoid. | **P1** | Reword to "when more work remains toward the objective". |
| 6 | Title "**Codex-style UI design contract**". | `docs/CODEX_UI_DESIGN.md:1` | Internal design doc; not primary marketing, but ships in the repo and is publicly readable. Reinforces the Codex framing. | **P2** | Rename to "UI design contract" (or "Calm task-first UI design contract"). Optionally exclude from public docs. |
| 7 | Test name "command palette supports slash and **Codex-style command shortcuts**". | `tests/ui.test.js:94` | Internal test only; not user-facing, but perpetuates the term in a public repo. | **P2** | Rename the test description; no behavior change. |
| 8 | `RELEASE_V1_PLAN.md` references branches `feature/codex-command-workflows`, `design/codex-premium-ui`. | `docs/RELEASE_V1_PLAN.md:7–8` | Internal planning doc referencing branch names. Low risk but visible. | **P2** | Acceptable to keep as historical branch references; do not surface "codex-premium" in marketing. |
| 9 | "'OpenAI', 'ChatGPT', and 'Codex' are trademarks of their respective owners and are used only to describe compatibility and **design inspiration**." | `NOTICE.md:5` | This is a *mitigation* and is appropriate. But once claims #1–#3 are removed, YOLO no longer needs to invoke "Codex" at all; leaving "Codex … design inspiration" is a soft acknowledgement of the association the brief wants avoided. | **P1** | Keep the OpenAI/ChatGPT trademark disclaimer; drop "Codex" and "design inspiration" once #1–#3, #6 are fixed so the product no longer references Codex. |
| 10 | "Independent project: YOLO is not affiliated with or endorsed by OpenAI. It does not use the OpenAI API, run a backend, inject remote code, or collect telemetry." | `README.md:5`; `onboarding.html:35`; `NOTICE.md:3` | Accurate, prominent, and near the top. Strong mitigation. Verified: no OpenAI API usage; manifest requests only `alarms`, `scripting`, `storage` + chatgpt host (`manifest.json:9–17`). | **OK** | Keep. Do not weaken or bury (brief §8). |
| 11 | "not an agent platform … does not include coding-agent hooks, a CLI, local daemon, MCP server, native-messaging host, filesystem or Git access, automatic code review/repair, or a hosted backend." | `README.md:34–40`; `docs/PRODUCT_DIRECTION.md:28–40`; `CONTRIBUTING.md:28` | Matches the brief's non-goals exactly. `npm run verify:extension` enforces no CLI/agent/server/native surfaces in the runtime allowlist (`README.md:169`, `scripts/verify-extension.mjs`). Manifest confirms no such permissions. | **OK** | Keep — this is a model product-boundary statement. |
| 12 | "`/loop` … defaults to 12 and is hard-capped at 50 turns." | `README.md:22` | Verified in code: `DEFAULT_MAX_ITERATIONS = 12`, `MAX_ITERATIONS = 50`, clamped in `parseLoopArgs` (`commands.js:9–10,77–83`). | **OK** | Accurate. |
| 13 | "These are YOLO extension actions, not native ChatGPT commands … they do not unlock hidden ChatGPT capabilities or modify ChatGPT's context window." | `README.md:74–76,103` | Directly satisfies the brief's requirement to disambiguate slash actions from native ChatGPT commands. Backed by prompt-shortcut implementation (queues visible prompts). | **OK** | Keep. Apply the same disambiguation to onboarding once #2 is fixed. |
| 14 | Permissions: only `storage`, `alarms`, `scripting`, and `https://chatgpt.com/*`; "does not request `activeTab`, `tabs`, native messaging, broad web access, cookies, or history." | `README.md:140–149`; `docs/PERMISSIONS.md`; `manifest.json:9–17` | Manifest matches the documentation exactly. No optional/localhost/native surfaces. | **OK** | Accurate and well-scoped. |
| 15 | Privacy: "no analytics, telemetry, advertising, backend, user account, payment system, crash-reporting, or remote logging"; "does not call a project-owned server or the OpenAI API." | `PRIVACY.md:7,30`; `onboarding.html:26` | Consistent with manifest (no host beyond chatgpt), CSP `script-src 'self'` (`manifest.json:18–20`), and no-remote-code verification. | **OK** | Accurate. |
| 16 | Reliability: "fails closed when delivery is ambiguous"; "at-most-once side effects with explicit recovery"; exact-receipt delivery. | `README.md:105–121`; `docs/RELIABILITY_MODEL.md:1–52` | Design doc and failure-mode table substantiate the claims; not "guaranteed" or "exactly-once" (explicitly disclaims exactly-once). Honest framing: "does not make the model's answer correct." | **OK** | Accurate and appropriately hedged. Strong. |
| 17 | No "unlimited", "instant", "magic", download-count, or usage-count claims anywhere. | repo-wide grep | Searched: no "unlimited", no fake counters, no "guarantee" of outcomes. | **OK** | Compliant with brief §8 (no fake counts) and non-goals. |
| 18 | Onboarding eyebrow "**LOCAL-FIRST** CHATGPT AUTOMATION" as the opening line. | `onboarding.html:13` | Brief §2: "Do not make 'local-first' the opening hook. It is a trust proof, not the initial pain." The h1 ("Long conversations, without babysitting them.") is a good hook, but the eyebrow leads with local-first. | **P2** | Consider reordering so the pain/value leads and local-first appears as a trust proof (e.g. eyebrow "STOP BABYSITTING LONG CHATGPT TASKS", keep local-first in the aside). |

---

## 2. Top risks

1. **P0 — "Codex-style" in the shipping manifest description (`manifest.json:6`).** Highest-visibility claim; appears in the extension manager and any store listing. Implies an OpenAI Codex association the brief explicitly forbids. Ship-blocker.
2. **P0 — "Codex-style commands" on the first-run onboarding screen (`onboarding.html:15`).** First impression for every new user; same OpenAI-product implication.
3. **P0 — "GITHUB ACTIONS" / "repository writes" in the Approvals settings (`options.html:99–105`).** Falsely implies YOLO integrates with GitHub and can modify repositories, directly contradicting the core product boundary (YOLO holds no GitHub credentials/access). This is the single most misleading capability implication in the UI.
4. **P1 — "autonomous work" in the shipped `/goal` prompt (`commands.js:212`) and "Codex/ChatGPT-style interface" in the changelog (`CHANGELOG.md:25`).** Reinforce exactly the "autonomous agent" / OpenAI-lineage framing the positioning bans.
5. **P1 — residual "Codex … design inspiration" in `NOTICE.md`.** Once the product stops referencing Codex, this line should stop invoking it too, so the repo carries no OpenAI-product association at all.

## 3. What is already strong (keep, do not regress)

- Prominent, correctly-worded **independent-project / no-OpenAI-affiliation** disclaimer in README, onboarding, and NOTICE.
- **Product boundary** section is exemplary: explicitly disclaims agent platform, CLI, daemon, MCP, native messaging, filesystem/Git access, and backend — and it is **enforced by `verify:extension`** and the manifest, not just asserted.
- **Slash-action disambiguation** ("YOLO extension actions, not native ChatGPT commands") satisfies the brief.
- **Permissions and privacy** claims match the manifest and CSP exactly; no telemetry/backend/remote-code.
- **Reliability** claims are honestly hedged (at-most-once, not exactly-once; markers give control-flow reliability, not answer correctness) and backed by `RELIABILITY_MODEL.md`.
- No "unlimited", fake counts, or outcome guarantees anywhere.

## 4. Recommended fixes (minimal, launch-prep scope)

All are copy/label changes; none touch runtime behavior (preferred runtime diff remains zero):

1. `manifest.json:6` — drop "Codex-style"; use the approved descriptor.
2. `onboarding.html:15` — "Codex-style commands" → "YOLO slash actions"; consider reordering the eyebrow so local-first is a proof, not the hook (P2).
3. `options.html:99–105` — remove "GITHUB ACTIONS" eyebrow and GitHub/"repository writes" wording; describe approvals generically.
4. `commands.js:212` — "more autonomous work remains" → "more work remains toward the objective". (Runtime prompt text change — must be independently reviewed and covered by tests per brief §6; verify no snapshot/marker test asserts the old string.)
5. `CHANGELOG.md:25` — drop "Codex".
6. `docs/CODEX_UI_DESIGN.md` title + `tests/ui.test.js:94` description — rename to drop "Codex" (P2).
7. `NOTICE.md:5` — after the above, remove the "Codex … design inspiration" clause; keep the OpenAI/ChatGPT trademark disclaimer.

## 5. Verdict

**Conditional pass.** The core positioning, product-boundary, permissions, privacy, and reliability claims are accurate and well-substantiated — genuinely strong. However, the product currently ships **three P0 false/misleading OpenAI/Codex/GitHub associations** (manifest description, onboarding copy, and the Approvals "GitHub Actions / repository writes" labeling) that contradict the stated product truth and the launch brief's non-goals. **Do not publish until items #1, #2, and #4 (the three P0s) are corrected; the P1 items should also be fixed in the same launch-prep pass.** Re-audit against the `devin/launch-prep` integration branch once it exists.

---

### Handoff
- **For README/conversion reviewer & orchestrator:** P0/P1 fixes are copy-only and safe to fold into the launch-prep integration commit; keep runtime diff zero except the `commands.js:212` prompt string (needs test coverage check).
- **For technical/repository reviewer:** confirm no test snapshot asserts "Codex-style" (`tests/ui.test.js:94`) or the `/goal` prompt string before editing.
- **For accessibility/privacy reviewer:** the `options.html` Approvals `data-search-text` currently seeds "github"; ensure search still resolves the section after relabeling.
- **Next action:** orchestrator assigns the copy fixes to the integration/launch-copy agent, then re-runs this audit against `devin/launch-prep`.
