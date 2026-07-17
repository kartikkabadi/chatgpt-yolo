# Wave A — Existing Repository and Documentation Audit

**Repo:** `kartikkabadi/chatgpt-yolo`
**Branch:** `devin/wave-a-repo-audit`
**Role:** Wave A research agent #2 (existing repo + documentation audit)
**Scope:** Read-only audit of current README, `docs/`, policy files, and metadata against the launch-readiness brief. No changes to `README.md` or product code.
**HEAD audited:** `fd90083` (Merge PR #24 `hardening/production-readiness`), version `1.1.0`.

---

## Findings

### Repository shape
- Runtime is a dependency-free Manifest V3 Chromium extension (root-level JS: `background.js`, `content.js`, `queue.js`, `commands.js`, `command-runtime.js`, `platforms.js`, `popup.*`, `options.*`, etc.).
- `manifest.json` v1.1.0: narrow permissions (`alarms`, `scripting`, `storage`), host access limited to `https://chatgpt.com/*` + `https://*.chatgpt.com/*`, strict extension-pages CSP, ordered content scripts. Matches the product-boundary claims.
- `package.json` v1.1.0: no runtime deps; scripts `check` / `test` / `verify:extension` / `package` / `validate`. `engines.node >=20`.
- CI/release automation present and modern: `.github/workflows/ci.yml` (Node 20 + 24 matrix, verify-extension, package check), `release.yml` (tag/version match, reproducible zip + SHA256, `gh release create`), `codeql.yml` (JS/TS, weekly). Actions pinned to current majors (`checkout@v7`, `setup-node@v7`, `codeql-action@v4`).
- Tests: 31 test files under `tests/` covering queue, delivery atomicity, workflow ownership, portability, manifest security, packaging, release. `npm run validate` **passes locally** (this session, Node present; "Verified 35 packaged files", exit 0).

### Strengths — high-quality, reusable, launch-grade content already exists
- **README.md (190 lines):** already accurate, detailed, and truthful. Strong sections: What it does, Highlights, **Product boundary**, Install (release archive + source), First run, Slash actions tables (correctly labeled "YOLO extension actions, not native ChatGPT commands"), Queue reliability, Profiles, Backups/diagnostics, Permissions/privacy, Compatibility/responsibility, Development, Release verification, Contributing/security, License. The independent-project disclaimer is present near the top (line 5).
- **Policy set is complete and trustworthy:** `PRIVACY.md`, `SECURITY.md`, `SUPPORT.md`, `NOTICE.md` (explicit no-OpenAI-affiliation + trademark notice), `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE` (MIT), `CHANGELOG.md` (Keep-a-Changelog style through 1.1.0 + Unreleased).
- **`docs/` is rich:** `PRODUCT_DIRECTION.md` (one-sentence product, problem, principles, non-goals, roadmap, success measures), `ARCHITECTURE.md`, `RELIABILITY_MODEL.md`, `PERMISSIONS.md`, `DATA_PORTABILITY.md`, `RELEASING.md` (automated gate + manual smoke checklist), `OPEN_SOURCE_READINESS.md` (explicit launch gate with checkboxes), `PR_AUDIT.md`, `RELEASE_V1_PLAN.md`, `OVERNIGHT_RELIABILITY.md`, `CODEX_UI_DESIGN.md`, `TROUBLESHOOTING.md`.
- **`.github/` scaffolding:** `CODEOWNERS`, issue forms (`bug_report.yml`, `feature_request.yml`, `config.yml`), `dependabot.yml`, PR template(s), and `FUNDING.yml`.
- **Icons exist:** `icons/icon{16,32,48,128}.{png,svg}` — a real installed mark to build brand/hero assets from (do not casually redesign per §11).

### Gaps vs launch-readiness requirements

**Visual assets — 100% missing (must create).**
- No `docs/assets/` directory at all. None of the required assets exist: `hero.webp`, `social-preview.png`, `screenshot-queue.webp`, `screenshot-command-palette.webp`, `screenshot-workflow.webp`, `screenshot-github-workflow.webp`, `screenshot-settings.webp`, `demo-poster.webp`, optional `yolo-mark.svg` lockup.
- No `marketing/` toolchain (before this audit): no `BRAND.md`, `STORYBOARD.md`, `LAUNCH_COPY.md`, `LAUNCH_CHECKLIST.md`, `REPO_METADATA.md`, `asset-manifest.json`, `capture/`, `video/`, `renders/`.
- No launch video and no capture harness.

**README redesign — content strong, presentation/IA not launch-optimized.**
- **No badges** (0 shields references). Brief §8.5 wants CI, CodeQL, MIT, latest-release (when real), Manifest V3.
- **No hero image / no visual** — README is text-only.
- **No compact primary-action row** (Install / Watch demo / Sponsor). Install exists as a section but not as top-of-README quick actions.
- **No explicit "Recommended for coding workflows: Connect GitHub to ChatGPT" section** (brief §3, §8.9). This is a required new section; currently absent.
- **No dedicated "Support development" / Sponsor section** (brief §4). Sponsorship is not mentioned anywhere in README today.
- Opening hook is a single descriptive sentence; brief §8.2 wants the sharper "Queue the next steps. Run bounded workflows. Stop babysitting long ChatGPT conversations." hook + the three-value summary blocks (§8.8). Current "Highlights" is a long flat bullet list, not the scannable three-value structure.
- Slash-action accuracy and the independent-project disclaimer are already correct — **must be preserved, not weakened** (brief §8 "do not" list).

**Sponsorship — funding wired but has a launch-blocking branding risk.**
- `.github/FUNDING.yml` `custom:` points to `https://whop.com/vex-app/support-for-oss/`. This is the pre-existing custom link the brief says to keep (§4: do not replace/relocate the platform). **However** the URL contains **`vex-app`** — exactly the "unrelated Vex branding" the brief warns about (§4 step 6). The live support page must be inspected by the sponsorship agent to confirm: public accessibility, $5/$10 options, and that no Vex branding/confusing copy undermines YOLO's ask. Not this agent's call to fix; flagged as a Risk.
- All other FUNDING.yml keys are commented placeholders (no GitHub Sponsors username set). Sponsor button currently renders only via the custom link.

**Repository metadata — cannot be set from the repo tree; must be applied via API/manual.**
- Description, topics, and homepage/website live in GitHub's About settings, not in the clone. Current values are not visible from the checkout. Brief §5 provides the canonical description and ~10–14 topic set; these need a `marketing/REPO_METADATA.md` + exact `gh` commands (integration/orchestrator step), not a file commit.
- `package.json` `description` ("Local-first queues, bounded workflows, and safety controls for ChatGPT in Chromium browsers.") and `manifest.json` `description` ("Local-first Codex-style workflows, reliable queues, and bounded automation for ChatGPT.") are **inconsistent with each other and with the brief's canonical repo description**. Not required to change (manifest description is store-facing product copy), but worth an alignment review.

**Social preview — file missing and requires an out-of-PR settings action.**
- No `docs/assets/social-preview.png`. Per brief §5, committing the file does not set GitHub's Open Graph image; a manual Settings action (or a supported metadata API call) is required. Needs an exact manual step in the launch checklist.

**Release readiness — local green, but CI/live evidence still open (per repo's own gate).**
- `docs/OPEN_SOURCE_READINESS.md` and `docs/PR_AUDIT.md` explicitly list open blockers: GitHub-hosted Actions "terminate before recording any step or log" (external release blocker), full suite on Node 20 **and** 24 from the exact release head, current-Chromium unpacked smoke checklist, multi-tab overnight soak, reproducible double-build checksum verification, and a published prerelease. These are launch-verification gates the technical/QA agents must clear — this audit confirms they remain **unchecked** in the readiness doc.

### Repository hygiene issues discovered (small, launch-relevant)
- **Duplicate, conflicting PR templates:** both `.github/PULL_REQUEST_TEMPLATE.md` (930 B, "Problem/Change/Verification/Extension boundary" checklist) and `.github/pull_request_template.md` (340 B, "Scope/Deliberate exclusions/Validation") exist. On a case-insensitive host GitHub picks one nondeterministically; they are **different** templates. Should be consolidated to one before launch.
- **Stray dev artifact committed at repo root:** `repaired-validation.txt` (17.5 KB) is captured `npm run validate` output. It is not in the package allowlist (excluded from `dist/yolo`) but pollutes the public root of a "looks complete" launch repo. Recommend removal (owned by integration agent, not this audit).

---

## Decisions made
- Treated this strictly as a **read-only documentation/repository audit**; made **no** edits to `README.md`, `docs/`, or product code, per the brief and this agent's contract.
- Ran `npm run validate` once as non-destructive evidence of current local build/test health (passed) — no source modified.
- Recorded metadata gaps (description/topics/social preview) as **handoff items for the orchestrator/integration agent**, since they require GitHub API/Settings actions outside a file commit.
- Flagged the `vex-app` funding-URL branding concern for the **sponsorship agent** to verify against the live page rather than proposing any FUNDING.yml change (brief forbids replacing the platform).
- Deliverable limited to this single report file under `marketing/research/` (new tree), avoiding collision with other Wave A/B agents.

---

## Files changed
- **Added:** `marketing/research/repo-and-docs-audit.md` (this report).
- **No other files created or modified.** `README.md`, `docs/`, and all product code untouched.

---

## Reuse vs. create matrix (handoff)

| Launch requirement | Status | Reuse | Create |
| --- | --- | --- | --- |
| README core content (boundary, install, privacy, reliability, slash tables, disclaimer) | Strong | Reuse & reorganize; preserve accuracy qualifiers | — |
| README hook / three-value summary / primary-action row / badges | Missing presentation | — | README IA agent (Wave B #12) |
| GitHub-app "Connect GitHub to ChatGPT" section | Missing | — | README IA + GitHub-app research agent |
| Sponsor / "Support development" section | Missing in README | Reuse existing FUNDING.yml destination | README IA agent |
| Policy files (PRIVACY/SECURITY/SUPPORT/NOTICE/COC/CONTRIBUTING/LICENSE) | Complete | Reuse as-is | — |
| `docs/` reference docs | Complete | Reuse; link from redesigned README | — |
| Hero / social-preview / screenshots / demo poster | Missing | Reuse icons + real UI states | Wave C capture/image agents |
| Launch video + capture harness | Missing | — | Wave C motion + capture agents |
| Repo description / topics / homepage(blank) | Not in tree | Reuse brief's canonical values | `REPO_METADATA.md` + `gh` (orchestrator) |
| Social-preview upload | N/A in PR | — | Manual Settings step in launch checklist |
| CI / CodeQL / release automation | Present & modern | Reuse; surface as badges | — |
| Duplicate PR template / stray `repaired-validation.txt` | Hygiene defects | — | Integration agent cleanup |

---

## Prioritized recommended changes (with files to touch)

**P0 — launch-blocking**
1. README redesign (top-of-README IA: title, hook, compact description, disclaimer, badges, hero, primary actions, three-value summary) — `README.md`. *(README IA agent; ≥3 reviewers per brief.)*
2. Add "Recommended for coding workflows: Connect GitHub to ChatGPT" section with the accurate, conditional wording and the "GitHub app is optional and independent from YOLO" note — `README.md`. *(Depends on GitHub-app research agent.)*
3. Produce required visual assets — `docs/assets/hero.webp`, `social-preview.png`, `screenshot-*.webp`, `demo-poster.webp`. *(Wave C.)*
4. Produce launch video (primary 1920×1080 + square) + poster — `marketing/video/`, `marketing/renders/`. *(Wave C.)*
5. Verify sponsorship end-to-end incl. the `vex-app` branding concern on the live page — no code change unless the page is broken; document in `marketing/LAUNCH_CHECKLIST.md`. *(Sponsorship agent.)*
6. Set repo About: description + ~10–14 topics + blank homepage — `marketing/REPO_METADATA.md` with exact `gh repo edit` commands. *(Orchestrator.)*
7. Clear the open Reliability/Release-engineering gates in `docs/OPEN_SOURCE_READINESS.md` (CI runners, Node 20/24 from release head, Chromium smoke, reproducible checksum, prerelease). *(Technical/QA agents.)*

**P1 — high value**
8. Add "Support development" section + compact top Sponsor link (order: Install, Watch demo, Sponsor) — `README.md`.
9. Add README badges: CI, CodeQL, MIT, Manifest V3, latest release (only when real) — `README.md`.
10. Consolidate the two PR templates into one — remove one of `.github/PULL_REQUEST_TEMPLATE.md` / `.github/pull_request_template.md`. *(Integration agent.)*
11. Remove stray `repaired-validation.txt` from repo root. *(Integration agent.)*
12. Add marketing scaffolding — `marketing/{README.md,BRAND.md,STORYBOARD.md,LAUNCH_COPY.md,LAUNCH_CHECKLIST.md,REPO_METADATA.md,asset-manifest.json}` + `capture/`, `video/`, `renders/`, keeping dependencies isolated (`marketing/**/package.json`, never touch extension runtime deps, no `node_modules`/frames committed).

**P2 — polish / consistency**
13. Align `package.json` and `manifest.json` `description` strings with the canonical positioning (review only; manifest text is store-facing). *(Optional; needs product-claim review.)*
14. Set a GitHub Sponsors username in `FUNDING.yml` if/when enabled (keep existing custom Whop link). *(Sponsorship agent; do not replace platform.)*
15. Update `CHANGELOG.md` "Unreleased" with the launch/distribution entries at integration time — `CHANGELOG.md`. *(Integration agent.)*

---

## Validation performed
- Cloned repo; enumerated full tree, `docs/`, `.github/`, `icons/`, `scripts/`, `tests/`.
- Read every requested file: `README.md`, all `docs/*.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `SECURITY.md`, `PRIVACY.md`, `NOTICE.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `package.json`, `manifest.json`, `.github/FUNDING.yml`, `.gitignore`, workflows (`ci.yml`, `release.yml`, `codeql.yml`), both PR templates.
- Ran `npm run validate` → exit 0 ("Verified 35 packaged files"); confirms local check/test/verify:extension/package are green at HEAD.
- Confirmed absence of `docs/assets/`, `marketing/` (pre-audit), README badges, and any GitHub-app/Sponsor README sections via directory listing and `grep`.
- Diffed the two PR templates to confirm they are non-identical.

## Risks
- **Sponsorship branding (medium):** `vex-app` in the funding URL may confuse or dilute YOLO's sponsorship ask; live page must be verified before launch. Brief forbids swapping the platform, so resolution is limited to the external page + README wording.
- **README accuracy regression (medium):** the redesign must not weaken existing qualifiers (independent-project disclaimer, "YOLO actions not native ChatGPT commands", no GitHub-access-in-YOLO, bounded-workflow limits). Requires ≥3 independent reviewers.
- **Release verification (medium/high):** the repo's own gate lists unresolved CI-runner and live-Chromium smoke blockers; a "launch-ready" claim is not yet backed by CI/live evidence.
- **Metadata + social preview (low, process):** description/topics/OG image require GitHub Settings/API actions outside the PR; if tooling can't apply them, exact manual steps must ship in the launch checklist.
- **Scope creep (low):** brief freezes runtime feature scope — marketing tooling and assets must stay isolated from `dist/yolo` and the extension dependency model.

## Recommended next action
Hand this audit to: (a) the **README IA / conversion-copy agent** (Wave B #12) as the content inventory and required-section map; (b) the **GitHub-app research agent** to supply the exact "Connect GitHub to ChatGPT" wording before that README section is written; (c) the **sponsorship agent** to verify the live `vex-app` support page and the $5/$10 options; (d) the **orchestrator/integration agent** for repo metadata (`gh repo edit`), social-preview upload, PR-template consolidation, and removal of `repaired-validation.txt`. Treat `docs/OPEN_SOURCE_READINESS.md` as the release-verification checklist the technical/QA agents must close.
