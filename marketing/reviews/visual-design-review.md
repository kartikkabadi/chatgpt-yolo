# Visual Design Review — YOLO for ChatGPT launch assets

**Wave:** D (independent review)
**Role:** Visual design reviewer (did not implement the reviewed assets)
**Date:** 2026-07-17
**Verdict:** **Approve with minor changes.** The static launch visual system is
strong, product-truthful, and on-brand. Two items should be addressed before
publish (missing "not affiliated with OpenAI" line on shareable composites; the
`GITHUB ACTIONS` settings-section label). Everything else is polish or optional.

---

## 0. Review scope and source-of-truth caveats

The brief asked me to read `devin/launch-prep` and evaluate the assets against
`marketing/BRAND.md` and `marketing/visual-direction-a/DIRECTION.md`. Two stated
preconditions were **not** true at review time; I proceeded on a best-effort
basis and record the discrepancies here so the orchestrator can reconcile them:

1. **No `devin/launch-prep` integration branch exists.** The launch artifacts
   are still split across the wave branches. I assembled the review set from:
   - `origin/devin/wave-c-images` → `docs/assets/{hero.webp, social-preview.png, demo-poster.webp, yolo-mark.svg}`
   - `origin/devin/wave-c-capture` → `docs/assets/screenshot-*.webp`
   - `origin/devin/wave-b-visual-a` → `marketing/visual-direction-a/DIRECTION.md`
2. **`marketing/BRAND.md` does not exist on any branch.** I evaluated against
   `DIRECTION.md` (which carries the concrete color tokens, typography, and
   avoid-list) plus the orchestration brief §9 "Visual identity". If a canonical
   `BRAND.md` is authored later, this review should be re-checked against it, but
   `DIRECTION.md` and the brief agree on every token I checked, so the risk is low.

Assets reviewed (8 images + 1 source mark):

| File | Source branch | Dimensions | Size | Format |
| --- | --- | --- | --- | --- |
| `docs/assets/hero.webp` | wave-c-images | 1536×864 | 56.3 KB | WebP, opaque |
| `docs/assets/social-preview.png` | wave-c-images | 1280×640 | 186.7 KB | PNG, opaque (no alpha) |
| `docs/assets/demo-poster.webp` | wave-c-images | 1920×1080 | 67.0 KB | WebP, opaque |
| `docs/assets/screenshot-queue.webp` | wave-c-capture | 1440×900 | 59.9 KB | WebP |
| `docs/assets/screenshot-command-palette.webp` | wave-c-capture | 1440×900 | 43.6 KB | WebP |
| `docs/assets/screenshot-workflow.webp` | wave-c-capture | 1440×900 | 44.6 KB | WebP |
| `docs/assets/screenshot-github-workflow.webp` | wave-c-capture | 1440×900 | 49.5 KB | WebP |
| `docs/assets/screenshot-settings.webp` | wave-c-capture | 1440×900 | 40.5 KB | WebP |
| `docs/assets/yolo-mark.svg` | wave-c-images | 128×128 | 0.6 KB | SVG source |

---

## 1. Dimensions and file-size budget

All assets pass the brief's budget (§11). No asset is close to a ceiling.

| Asset | Budget | Actual | Result |
| --- | --- | --- | --- |
| social-preview.png | 1280×640, PNG, < 1 MB, opaque | 1280×640, 187 KB, RGB/no alpha | **Pass** |
| hero.webp | ~1600×900 or 1536×864, WebP, < 500 KB | 1536×864, 56 KB | **Pass** |
| demo-poster.webp | works as 1080p first video frame | 1920×1080, 67 KB | **Pass** (matches 16:9 video master) |
| screenshot-*.webp (×5) | consistent framing, < 350 KB each | all 1440×900, 40–60 KB | **Pass** |

Notes:
- Social preview is genuinely opaque (RGB, no transparency) — meets "no
  transparent background."
- Screenshots are uniformly 1440×900, so framing is consistent across the set.
- Shipped assets track the Direction A concepts closely (concept hero 1536×864/62 KB,
  concept social 1280×640/194 KB), confirming Wave C regenerated faithfully rather
  than diverging.

---

## 2. Evaluation against brand / visual direction

Scored against the criteria in the task, `DIRECTION.md`, and brief §9.

### 2.1 Calm, technical identity — **Strong pass**
The whole system reads as a calm instrument panel, not a hype product. Warm
off-white field, a faint blueprint baseline grid, one dominant object (the queue),
restrained shadows, moderate rounding. The name "YOLO" is actively
counterbalanced by numbered ordering, explicit status, bounded turn state, and
visible Pause/Edit/Stop controls. This is exactly the discipline the brief asks
for.

### 2.2 Color tokens — **Pass**
Colors match the `DIRECTION.md` `:root` table pulled from `styles.css`:
- Canvas warm off-white (`#f6f6f4`), near-black type ramp, quiet borders.
- Green (`--success #24784b`) used only for running/`Sending` state.
- Red appears only on the destructive **Stop** control (see §3.4 for the one
  nuance) — no red status dots, consistent with "red reserved for blocked/failed."
- **No amber (`--warning`) state appears in any asset.** Not a violation, but the
  set never demonstrates the paused/caution state, so the full semantic palette
  isn't shown (see §3.3).

### 2.3 Typography — **Pass**
System UI stack throughout (product-native, no webfont dependency). Monospace is
used only for machine-meaningful tokens — slash commands (`/goal`, `/loop`,
`/review`, `/fix`, `/handoff`), the `⌘/Ctrl ↵` hint, delivery receipts, and the
`Local-first · Open source · No telemetry` trust line. Headline is heavy with
tight tracking; hierarchy is clear. Monospace = "real, inspectable command,"
never decoration — matches intent.

### 2.4 No neon / AI tropes — **Strong pass**
None of the avoid-list appears: no neon gradients, purple SaaS wash, robots,
brains, sparkles, cyberpunk, code rain, fake terminals, giant OpenAI logo, fake
GitHub UI, glassmorphism, 3D cubes, or meaningless particles. The blueprint grid
is kept faint and structural, not "tech-y" cliché.

### 2.5 Staging disclosure — **Pass on screenshots, gap on composites**
- All five product screenshots disclose staging clearly: a top-corner
  `Clean profile · invented demo content` label and a bottom-right
  `Staged demo · no live data` chip. Good.
- The **marketing composites (hero, social-preview, demo-poster) carry no staging
  disclosure.** This is defensible — they're designed composites, not claimed
  screen captures — and `DIRECTION.md` explicitly frames them as faithful staged
  reconstructions to be regenerated from real capture. Flagging as low severity so
  the orchestrator makes a deliberate call rather than an accidental one.

### 2.6 Readability at small sizes — **Pass**
The social preview has few elements, a single dominant queue object, a large
two-line headline, and high contrast — it survives compression to a link
thumbnail. No tiny feature list, no cramped rows.

### 2.7 GitHub-app distinction — **Strong pass** (best-handled requirement)
The GitHub/YOLO boundary is preserved everywhere it appears:
- Hero and demo-poster: `Optional · GitHub app connected to ChatGPT` chip.
- `screenshot-github-workflow`: three reinforcing signals —
  `Optional · GitHub app connected to ChatGPT` chip, a
  `GitHub → ChatGPT · YOLO queues the follow-ups` kicker, and an explicit
  `GitHub connects to ChatGPT, not YOLO` chip. The queued items show the
  inspect → implement → validate → review → summarize coding sequence. No fake
  GitHub repo chrome is rendered.

### 2.8 Queue + workflow clarity — **Pass**
- Queue: numbered ordering, an explicit queued count (`4 queued` / `5 queued`),
  per-item state (`Sending` in green, `Queued` in graphite), and monospace command
  tags. `screenshot-queue` shows reorder handles, Edit, and per-item controls.
- Workflow: `screenshot-workflow` shows objective, `Iteration 2 of 5`, hourly
  limit `6 of 30 used`, draft protection On, and Pause/Edit/Stop — a clearly
  **bounded** workflow with visible upper bound. The hero echoes this with
  `Turn 2 of 5` and a segmented progress bar. Nothing implies an endless loop.

### 2.9 Safe-mode state — **Pass**
`screenshot-settings` shows the safety posture well: an operating-profile selector
(Safe/Balanced/Fast), a master automation switch, and an **Approvals section that
is off by default** with the copy "Keep this off unless you understand the risk,"
plus approval policy, delays, cooldown, and hourly limits. Left nav exposes
Recovery, Safety, and Data & resets; footer reads `LOCAL ONLY`. This communicates
conservative-by-default and local-only clearly.

### 2.10 Legal line — **Fail (minor but should fix)**
The `Independent project. Not affiliated with OpenAI.` line is **absent from all
static assets**, including the standalone-shareable `social-preview.png` and
`demo-poster.webp`. The hero and poster depict a ChatGPT conversation surface
(neutral `C` glyph, no OpenAI logo — good), but with no disclaimer a
screenshotted/shared composite could imply endorsement. See §3.1.

---

## 3. Findings

Ordered by severity. "Sample concern" = a concrete instance you can look at.

### 3.1 [Medium] No "Not affiliated with OpenAI" line on shareable composites
**Where:** `social-preview.png`, `demo-poster.webp`, `hero.webp`.
**Why it matters:** These are the assets most likely to travel outside the README
(social preview thumbnail, X video thumbnail, launch-reply image, release image).
The hero and poster render a ChatGPT conversation. The brief mandates the legal
line on the video end card (§13 Scene 7) and treats OpenAI-endorsement risk as a
tracked medium risk in `DIRECTION.md`. The static composites should carry the same
line.
**Sample concern:** `demo-poster.webp` — full ChatGPT conversation + YOLO panel +
`Watch the demo` play button, but no affiliation disclaimer anywhere in frame.
**Recommendation:** Add a small, legible `Independent project · Not affiliated
with OpenAI` line to `social-preview.png` and `demo-poster.webp` (footer/kicker
zone). Optional on `hero.webp` since the README carries the disclaimer immediately
adjacent, but the two shareable images should not rely on surrounding context.

### 3.2 [Medium] `GITHUB ACTIONS` section label in the settings screenshot
**Where:** `screenshot-settings.webp`, section kicker above "Approvals."
**Why it matters:** "GitHub Actions" is the proper-noun name of GitHub's CI/CD
product. Using it verbatim as a YOLO settings-section header sits directly against
the product boundary the rest of the system defends so well ("YOLO is not a GitHub
integration," "do not imply GitHub access is built into YOLO"). A reader skimming
could infer YOLO runs or approves GitHub Actions. The section body actually refers
to accepting "narrowly classified action cards," i.e. ChatGPT approval cards —
unrelated to GitHub CI.
**Sample concern:** the header literally reads `GITHUB ACTIONS` / `Approvals` with
an `Enabled` toggle (off by default).
**Recommendation:** Confirm whether this is the real shipped product label or a
staging-harness artifact. If it's the capture harness, relabel to something like
`ACTION APPROVALS` or `AUTO-APPROVALS`. If it's the real extension label, this is a
product-UI finding to route to the product-claim / technical reviewer — but the
marketing capture should not amplify it in a launch screenshot regardless.

### 3.3 [Low] Amber (paused/caution) state is never shown
**Where:** entire asset set.
**Why it matters:** Every asset shows green `Running`/`Sending`. The three-color
semantic system (green/amber/red) is a brand pillar and part of the "stay in
control" story ("Ambiguous? It pauses."). No asset visually demonstrates the amber
paused state, so a key control affordance is described but never depicted.
**Recommendation:** Optional — consider one screenshot variant (or the workflow
shot) showing a `Paused` item with the amber dot, to prove the pause path visually.
Not launch-blocking.

### 3.4 [Low] Red used on the `Stop` control button
**Where:** `hero.webp`, `demo-poster.webp` (workflow controls), and text in
`screenshot-workflow`.
**Why it matters:** `DIRECTION.md` says red is "reserved only for blocked/failed."
`Stop` is a destructive control, not a status, so red is a reasonable and
conventional choice — but it is the one place red appears outside the stated
reservation. Calling it out for completeness.
**Recommendation:** Acceptable as-is. If strict token purity is wanted, render
`Stop` in near-black with red reserved strictly for status, but I would not block
on this.

### 3.5 [Low] Staging disclosure absent on marketing composites
See §2.5. Defensible by design; confirm it's intentional. No change required if
the team accepts composites as designed art rather than captures.

### 3.6 [Info] `yolo-mark.svg` depends on system font for the "Y"
**Where:** `docs/assets/yolo-mark.svg`.
**Why it matters:** The mark draws the "Y" as live `<text>` in the system UI stack.
Rendered in an environment lacking SF Pro/Segoe (e.g. some Linux rasterizers), the
glyph falls back and shifts subtly. Fine as a source file; if the mark is ever
rasterized for a fixed-size badge, outline the glyph to a `<path>` first.
**Recommendation:** No action for launch. Note for whoever produces raster
derivatives.

---

## 4. What's working (keep)

- Product-truth-first approach: the real queue/workflow UI is the hero object at
  pixel fidelity. This is the single strongest, most credible choice in the set.
- GitHub/YOLO boundary handling is exemplary and consistent (§2.7).
- Consistent 1440×900 screenshot framing with clear staging disclosure.
- Budgets comfortably met; nothing bloated.
- Coherent single scenario (orders-service reliability audit) across all
  screenshots and the hero — reinforces comprehension and reads as one product.
- Clean, honest command palette showing real YOLO slash actions with the
  `YOLO ACTION` label so they don't read as native ChatGPT commands.

---

## 5. Verdict and recommended next actions

**Verdict: Approve with minor changes.** The visual system is launch-quality,
on-brand, and truthful. No asset needs to be redesigned or re-shot.

Before publish, in priority order:
1. **Add the `Not affiliated with OpenAI` line** to `social-preview.png` and
   `demo-poster.webp` (§3.1). *Fix in Wave C image production.*
2. **Resolve the `GITHUB ACTIONS` settings label** — confirm real vs. staged and
   relabel if it's a harness artifact; otherwise route to product/technical review
   (§3.2). *Fix in Wave C capture, or escalate.*
3. Optional polish: show an amber paused state (§3.3); decide on composite staging
   disclosure (§3.5). Neither blocks launch.

**Orchestrator action items (outside asset scope):**
- Reconcile assets onto a single `devin/launch-prep` integration branch — it does
  not currently exist (§0).
- Author or confirm `marketing/BRAND.md`; this review used `DIRECTION.md` + brief
  §9 as the brand source of truth (§0).

---

## 6. Handoff

- **Reviewer independence:** I did not produce any reviewed asset; I reviewed
  Wave B (Direction A) + Wave C (images, capture) outputs.
- **Files created:** `marketing/reviews/visual-design-review.md` (this file).
- **Files changed:** none.
- **Validation performed:** dimension + byte-size + alpha checks via Pillow;
  direct visual inspection of all 8 images and the SVG source; cross-check against
  `DIRECTION.md` tokens/typography/avoid-list and brief §§9, 11.
- **Risks:** two source-of-truth gaps (missing integration branch and `BRAND.md`);
  two publish-blocking-ish content fixes (§3.1, §3.2) that live in Wave C, not here.
- **Recommended next action:** hand §3.1 and §3.2 to the Wave C image/capture
  owners; hand the branch/`BRAND.md` gaps to the orchestrator. Re-review only if
  `BRAND.md` introduces tokens that differ from `DIRECTION.md`.
- **Suitable for another agent:** yes — findings are concrete, located, and
  severity-ranked.
