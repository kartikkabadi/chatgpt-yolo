# Wave D — Privacy / Security / Accessibility Review

**Reviewer role:** Independent Wave D reviewer (privacy, security, accessibility). Did not implement any reviewed artifact.
**Date:** 2026-07-17
**Repo:** `kartikkabadi/chatgpt-yolo`
**Requested base:** `devin/launch-prep`
**Actual base reviewed:** `main` (commit `fd90083`) — see Scope note below.

## Verdict

**CONDITIONAL PASS.**

No exposed secrets, credentials, personal data, private conversations, tokens, cookies, real emails, or leaked local paths were found in the reviewed content. The extension's stated privacy/security posture (local-only, narrow permissions, no telemetry, no remote code) is consistent across `manifest.json`, `PRIVACY.md`, `SECURITY.md`, `docs/PERMISSIONS.md`, and `README.md`. The Whop sponsor page is publicly accessible and offers the expected **$5 / $10 / $20 one-time** tiers.

Conditions before launch:
1. Resolve the **Vex-branding / marketplace context** around the sponsor page (M1) — the brief explicitly flags this risk.
2. Fix the **systemic color-contrast (WCAG 2.1 AA) failures** in `popup.html` and `options.html` (M2), or consciously accept them.
3. Remove the stray **`repaired-validation.txt`** scratch file from the repo root before launch (L1).
4. Re-run this review against the real integrated `devin/launch-prep` branch once it exists — the `marketing/` and `docs/assets/` launch artifacts could not be reviewed (see Scope).

## Scope note (important)

The task asked me to review `devin/launch-prep` plus `docs/assets/*` and `marketing/capture/README.md`.

- The `devin/launch-prep` branch **does not exist** on the remote (nor does `devin/wave-d-privacy` prior to this push). This review therefore ran against `main`.
- `marketing/` and `docs/assets/` **do not exist on `main`**. Consequently the following requested items **could not be reviewed**: `docs/assets/*` (hero, social preview, screenshots, demo poster) and `marketing/capture/README.md`.
- Checks that depend on the marketing/capture artifacts — **"staged demo not disclosed"**, screenshots leaking private conversations/emails/repos, and capture-harness hygiene — are therefore **UNVERIFIED**. They must be re-run once the integration branch is available.

## 1. Sensitive-data scan (source + docs on `main`)

Method: repo-wide regex scan for emails, `sk-`/`ghp_`/`gho_`/Bearer tokens, `api_key`/`token=`/`secret`/`password`, cookies, and absolute local paths (`/home/`, `/Users/`, `C:\`), plus `devin`/`windsurf`/maintainer-name checks.

| Category | Result |
| --- | --- |
| Personal email | **None found.** |
| Private conversation content | **None found** in reviewed files (marketing screenshots not present to review). |
| API tokens / keys / OAuth secrets | **None found.** Matches for `claimToken` / `previewToken` are internal queue/portability identifiers generated at runtime, not credentials. |
| Cookies / credentials | **None found.** `cookies` appears only in `scripts/verify-extension.mjs` as a *forbidden* permission the extension asserts it never requests. |
| Devin / Windsurf secrets | **None found.** |
| Real names | Only `kartikkabadi` as the legitimate public GitHub org/repo owner in canonical URLs (`manifest.json`, `package.json`, README). This is the real repository owner, not a leak. |
| Local filesystem paths | **None found** (including in `repaired-validation.txt`). |
| Real GitHub repos (unintended) | Only the project's own `github.com/kartikkabadi/chatgpt-yolo`. No third-party/private repos referenced. |

## 2. Privacy & security posture (documentation vs. manifest)

Cross-checked claims against `manifest.json`:

- **Permissions match docs.** `manifest.json` requests only `alarms`, `scripting`, `storage`; host access limited to `https://chatgpt.com/*` and `https://*.chatgpt.com/*`. This matches `docs/PERMISSIONS.md` and README §"Permissions and privacy". No `tabs`, `activeTab`, `cookies`, `history`, `webRequest`, `nativeMessaging`, or broad host access. `scripts/verify-extension.mjs` enforces this forbidden-permission list in CI.
- **CSP is strict.** `content_security_policy.extension_pages` = `script-src 'self'; object-src 'none'; base-uri 'none';` — no remote/dynamic code, consistent with "no remote code" claims in `SECURITY.md`/`PRIVACY.md`.
- **No telemetry / backend / network calls.** `PRIVACY.md` and `README` state no analytics, backend, account, or OpenAI API use; onboarding opens `https://chatgpt.com/` only on explicit button press.
- **Data-portability privacy contract is well specified.** `PRIVACY.md` states backups exclude queues/objectives/messages and use an expiring one-time preview token; tests (`tests/portability.test.js`, `tests/data-background.test.js`) assert that secrets/objective/queue text are excluded from serialized backups and diagnostics. Strong.
- **Trademark / non-affiliation disclosed.** `NOTICE.md`, README top banner, and `onboarding.html` footer all carry the "independent, not affiliated with OpenAI" notice. Good.

No security concerns in the reviewed extension surface.

## 3. Sponsor page verification (Whop)

URL from `.github/FUNDING.yml` `custom:` field → `https://whop.com/vex-app/support-for-oss/`.

Verified live in-browser (rendered, no login required):

- **Publicly accessible:** HTTP 200; page renders anonymously. ✅
- **Title:** "Support for OSS". Seller shown as **"Kartik"**.
- **Tiers (via "+2 options" → "Choose your plan"):**
  - $5.00 one-time purchase
  - $10.00 one-time purchase
  - $20.00 one-time purchase

  All three are **one-time purchases** and match the required $5 / $10 / $20 copy. ✅
- Blurb: "Support my OSS projects, money goes to tokens and compute."

### Sponsor-page findings

- **[M1 — Medium] Unrelated Vex branding / marketplace context.** The sponsor page lives under the `vex-app` Whop store and its "More from Kartik" section surfaces unrelated **commercial Vex products** ("Vex Starter", "Vex Builder", "Vex Pro", "Vex Scale", "AI Agent Setup Audit"). The brief explicitly requires confirming "no unrelated Vex branding or confusing copy undermines YOLO's sponsorship request." A YOLO user arriving here sees a Vex-branded storefront and paid credit packs, not a YOLO-specific sponsorship — this can confuse or dilute the ask. **Recommendation:** either use a dedicated YOLO-scoped sponsor listing, or accept this as owner's intentional shared-OSS-funding setup. Per the brief, external Whop products/prices must not be modified without separate authorization — so this is a **report, not a fix**.
- **[L2 — Low] "Save 20%" strike-through framing.** The page presents "$6.25 ~~→~~ $5 · Save 20%", framing a donation as a discounted product purchase. Slightly off-tone for a maintenance sponsorship but not misleading. Informational.
- README sponsorship copy is not present on `main` yet; when the launch-prep README adds it, keep language to "$5 or $10" style suggestions and do **not** promise benefits or tax-deductibility (per brief). The page offers a third $20 tier, which the copy may optionally mention.

## 4. Accessibility check

Automated audit with **axe-core 4.12** (WCAG 2.0/2.1 A & AA + best-practice) run headlessly against each page's static DOM, plus manual review of the markup.

> Note: pages log a harmless `Startup failed: Cannot read properties of undefined (reading 'query')` when opened as `file://` because `chrome.*` APIs are unavailable outside the extension context. This is a test-harness artifact, not a product defect.

### `onboarding.html` — PASS
- **0 violations.** Proper `lang`, viewport, landmark (`<main>`, `<header>`, `<section aria-label>`, `<footer>`), heading order (h1 → h2), decorative mark `aria-hidden`, all buttons have visible text labels. Clean.

### `popup.html` — 1 violation + 2 needs-review
- **[Serious] color-contrast (WCAG 2.1 AA 1.4.3):** muted text color `#85847c` on light backgrounds yields **~3.47–3.75:1** (AA requires ≥ 4.5:1 for normal text). Affects `#scope`, `.shortcut-hint`, section sub-labels, `#manageTemplates` text button, empty-queue helper text, `#lastAction`, and the footer (`Local-only automation`, `#version`).
- **[Serious · needs review] aria-prohibited-attr:** `<div class="queue-actions" aria-label="Queue actions">` — `aria-label` on a generic `div` with no role may be ignored by assistive tech. Low real-world impact; consider a role (e.g. `role="group"`/`role="toolbar"`) or removing the label. (Several other decorative `aria-label` divs exist but were not flagged.)
- Positives: icon-only "•••" advanced button and the master toggle have `aria-label`; `role="switch"`, `role="status"`, `aria-live` used appropriately; all glyph icons are `aria-hidden`.

### `options.html` — 1 violation + needs-review
- **[Serious] color-contrast (WCAG 2.1 AA 1.4.3):** same `#85847c` muted color throughout — section eyebrows (`ADVANCED SETTINGS`, `DELIVERY`, `GITHUB ACTIONS`, etc.), section descriptions, `small` helper text, sidebar "Control center"/"Local only", and `#sectionCount` all measure **~3.26–3.75:1**, below AA. This is **systemic** (a shared token), so a single CSS variable change would fix the bulk of it.
- Positives: search input has `sr-only` label + clear button `aria-label`; nav uses `aria-current`; inputs are wrapped in `<label>` or carry `aria-label`; save state uses `role="status"`/`aria-live`; disabled always-on draft-protection toggle is labeled.

### Accessibility summary
- **[M2 — Medium] Systemic WCAG AA contrast failure** for muted/secondary text (`#85847c` foreground) in `popup.html` and `options.html`. Darkening this token to reach ≥ 4.5:1 (e.g. around `#6b6a63` or darker on the lightest backgrounds used) would clear the large majority of violations. Not a hard launch blocker for icon/meta text, but it is a genuine AA non-conformance and easy to fix.
- **[L3 — Low] `aria-label` on role-less `div`** in `popup.html` (`.queue-actions`).
- Keyboard note: queue reordering is described as "drag ordering"; verify a non-drag path (edit/retry/send-next buttons exist, which mitigates this) for keyboard-only users during manual QA.

## 5. Consolidated findings

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| M1 | Medium | Sponsorship | Sponsor page under `vex-app` store surfaces unrelated Vex commercial products; possible confusion/dilution of YOLO's ask (report only — external page). |
| M2 | Medium | Accessibility | Systemic WCAG 2.1 AA color-contrast failure (`#85847c` muted text, ~3.3–3.75:1) in `popup.html` and `options.html`. |
| L1 | Low | Repo hygiene | `repaired-validation.txt` (raw `npm run validate` output) committed at repo root; should not ship in a launch-ready repo. No sensitive data inside, but excluded from `dist/yolo` package. |
| L2 | Low | Sponsorship | "Save 20%" strike-through framing presents a donation as a discounted purchase. |
| L3 | Low | Accessibility | `aria-label` on role-less `<div>` (`.queue-actions`) in `popup.html`. |
| — | Info | Privacy/Security | No secrets, PII, tokens, cookies, private conversations, or local paths found. Permissions/CSP/telemetry claims verified against `manifest.json`. |

## 6. Unverified (blocked by missing branch/artifacts)

The following **must be re-reviewed** on the real `devin/launch-prep` once it exists:
- `docs/assets/*` — hero, `social-preview.png`, screenshots, demo poster: check for private conversations, personal email, real/private repo names, tokens, browser-profile identity, notifications, and undisclosed staged demos.
- `marketing/capture/README.md` — capture-harness hygiene and staged-state disclosure.
- README launch copy — sponsorship wording ($5/$10 claims, no benefit/tax-deductible promises, GitHub-app-separation disclaimer), image-only-button accessibility, and preserved non-affiliation notice.

## Appendix — how to reproduce

- Sensitive-data scan: repo-wide `rg` for the patterns above (no matches beyond canonical project URLs).
- Sponsor page: opened `https://whop.com/vex-app/support-for-oss/` in a clean browser (HTTP 200, no auth), expanded "+2 options".
- Accessibility: axe-core 4.12 via `@axe-core/puppeteer` (headless Chromium) against `file://` copies of the three pages, tags `wcag2a,wcag2aa,wcag21a,wcag21aa,best-practice`, plus manual markup review.
