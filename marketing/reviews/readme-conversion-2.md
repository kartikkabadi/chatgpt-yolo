# Wave D — README / Conversion Review (second independent pass)

**Reviewer role:** Independent README + conversion reviewer (did not implement the README).
**Date:** 2026-07-17
**Verdict:** **CHANGES REQUESTED (one launch-blocking issue).**

---

## 0. Scope and a material precondition gap

I was asked to review `README.md`, `marketing/LAUNCH_CHECKLIST.md`, and
`docs/OPEN_SOURCE_READINESS.md` on branch **`devin/launch-prep`**, focusing on
whether a stranger can install and start using YOLO without private
clarification, whether the install section matches actual repo state, whether
badges/metadata are accurate, and whether the sponsor/GitHub sections feel
natural.

Two of those inputs do not exist yet:

- **`devin/launch-prep` does not exist.** There is no integration branch on the
  remote. Only the per-wave branches exist (`devin/wave-a-*`, `devin/wave-b-*`,
  `devin/wave-c-*`). The launch README has **not** been integrated into
  `README.md` on any branch — the repo root `README.md` is still the
  pre-launch version on both `main` and every wave branch.
- **`marketing/LAUNCH_CHECKLIST.md` does not exist on any branch.** It has not
  been produced yet.

Because a true second pass of the *integrated* README is not yet possible, I
reviewed the strongest available conversion artifact as a proxy:

- `marketing/README_DRAFT.md` on `devin/wave-b-readme-copy` (the Wave B
  conversion-copy deliverable — this is what is intended to become the new
  `README.md`).
- `README.md` on `main` (the current live README a stranger sees today).
- `docs/OPEN_SOURCE_READINESS.md` on `main`.

All findings below apply to `marketing/README_DRAFT.md` unless stated otherwise,
and should be re-verified once the content lands on `devin/launch-prep`.

**Grounding checks performed for this pass** (not taken on faith from other
agents):

- Release/tag state: `gh release list` → **empty**; `git ls-remote --tags` →
  **no tags**. No published release exists.
- Sponsor page: `curl -sIL https://whop.com/vex-app/support-for-oss/` →
  **HTTP 200**, publicly reachable, no login wall on view.
- CI/CodeQL: workflows `ci.yml` and `codeql.yml` exist on `main`; latest `main`
  runs are **success** (an earlier `chore: add OSS funding link` run failed, but
  the current head is green).
- Assets referenced by the README draft exist, but **split across branches**:
  `hero.webp`, `social-preview.png`, `demo-poster.webp`, `yolo-mark.svg` live on
  `devin/wave-c-images`; the five `screenshot-*.webp` files live on
  `devin/wave-c-capture`. Neither branch has all of them.

---

## 1. Launch-blocking findings

### F1 — Install "quickest path" points at a release that does not exist (BLOCKER)

The draft leads Installation with:

> ### From a release archive (quickest path)
> 1. Download the latest `yolo-v*.zip` release asset and unzip it.

There are **no releases and no tags** in the repository. A stranger who follows
the recommended first path lands on an empty Releases page and cannot install.
This is the single most important conversion failure: the primary call to action
(**Install**) is broken for the exact audience the launch targets. The orchestration
brief explicitly forbids this state:

> Do not let the README say "download the latest release" when no usable release exists.

The `Latest release` badge compounds it — with no release published, the badge
renders `no releases` / `none`, which reads as an abandoned or pre-alpha project
directly under the title.

**Required fix (one of):**
- Publish the release (even a prerelease `v*`) **before** this README becomes the
  default, so both the badge and the install path resolve; **or**
- Until a release exists, make **"From source"** the primary/first install path
  and either remove the release-archive path or clearly mark it "available at
  launch," and drop or condition the `Latest release` badge.

Either way, the README must not ship as the repo default while the release path
is dead. `docs/OPEN_SOURCE_READINESS.md` corroborates the gap: "Produce and
inspect the exact release artifact" and "Publish a prerelease before a stable
release" are both **unchecked**.

---

## 2. Non-blocking findings (should fix before launch)

### F2 — README image references depend on an integration that hasn't happened

The draft references `docs/assets/hero.webp`, five `screenshot-*.webp`, and
`docs/assets/demo-poster.webp`. As noted, those assets are split across
`wave-c-images` and `wave-c-capture` and are absent from `wave-b-readme-copy`
where the draft currently lives. If the README lands on `devin/launch-prep`
without also merging both asset branches, **every image renders broken** — a
severe first-impression failure. This is exactly the kind of thing a second
integrated pass exists to catch; flagging now so integration merges copy **and**
both asset sets together, then re-verifies each image path resolves.

### F3 — Sponsor URL exposes `vex-app` / unrelated Vex branding

The Sponsor links (top-of-README actions, "Support development", and
`FUNDING.yml`) all point to `https://whop.com/vex-app/support-for-oss/`. The page
is live and correctly offers **$5 / $10** one-time options (verified: HTTP 200,
amounts confirmed by the Wave A sponsorship pass and the visible plan chooser),
so the README's "$5 or $10" copy is **accurate** and the ask is appropriately
soft — good.

However, the `vex-app` slug and the "More from Kartik" carousel of unrelated
**Vex** products on the destination page create a mild trust wobble: a first-time
sponsor clicks "Sponsor development" for *YOLO* and lands on a page branded
around a different product line. This is **external to the repo** and must not be
"fixed" in code, but the launch checklist (once it exists) should surface it to
Kartik as an optional Whop-side cleanup. The README copy itself is fine.

### F4 — `Manifest V3` badge links to `manifest.json`; confirm it reads as informational, not status

The `Manifest V3` badge is a static `informational` shields.io badge linking to
`manifest.json` — accurate and low-risk. Keep it. Just confirm during final
polish that the badge row is CI, CodeQL, License, Latest release, Manifest V3
(five badges) and nothing decorative creeps in; current set is within the brief's
"high-value only" rule.

### F5 — Anchor links resolve, but re-verify after integration

`[Install](#install)` and `[Watch the demo](#demo)` resolve in the draft
(`## Install` auto-anchors to `#install`; `#demo` is backed by an explicit
`<a id="demo"></a>`). The `Sponsor development` action is an absolute URL. All
good — but anchor slugs are heading-dependent, so re-check after any section
retitling during integration.

---

## 3. Conversion assessment (what works)

- **15-second comprehension: strong.** Title → one-line hook ("Queue the next
  steps. Run bounded workflows. Stop babysitting long ChatGPT conversations.") →
  compact descriptor → independent-project disclaimer → badges → hero → three
  primary actions → three-value summary. A stranger learns *what problem it
  solves, that it's a local-first Chrome extension, that workflows are bounded,
  and where to install/sponsor* without private clarification. This satisfies the
  brief's positioning hierarchy (pain first, "local-first" as trust proof, not
  the opening hook).
- **Product boundary is preserved and honest.** The "not affiliated with OpenAI"
  notice stays near the top; slash actions are explicitly labeled "YOLO extension
  actions, not native ChatGPT commands"; the reliability, privacy, and permission
  sections are retained intact rather than gutted for marketing. No overstated
  claims, no "autonomous agent" language, no implied OpenAI endorsement.
- **GitHub section is accurate and well-bounded.** The "Recommended for coding
  workflows" section keeps the correct separation ("The GitHub app is optional and
  independent from YOLO. YOLO never receives your GitHub credentials or repository
  data."), uses conditional capability language ("where your plan, app
  permissions, and enabled tools support it"), and names the current term with the
  "previously called the GitHub connector" acknowledgment. It does **not** imply
  YOLO holds GitHub access. This is the trickiest accuracy area and the draft
  handles it correctly.
- **Sponsorship feels natural, not desperate.** Compact Sponsor link in the
  action row (third, after Install and Watch demo — correct priority), a concise
  "Support development" section near the end with non-guilt language and
  star/report/contribute/share alternatives. Matches the brief.

---

## 4. Verdict and required actions

**CHANGES REQUESTED.** The conversion copy itself is launch-quality; the blocker
is state/integration, not writing.

Before this README can become the repository default:

1. **[BLOCKER] Resolve the release/install mismatch (F1)** — publish a release
   (or prerelease) so the archive path and `Latest release` badge resolve, or
   demote the release path to "from source" until one exists.
2. **[HIGH] Integrate copy + both asset branches together and verify every image
   path resolves on `devin/launch-prep` (F2).**
3. **[MEDIUM] Log the `vex-app`/Vex-branding sponsor-page note for Kartik in the
   launch checklist (F3)** — external, do not change in-repo.
4. **[LOW] Re-verify badges and anchors on the integrated branch (F4, F5).**

Also note for the orchestrator: `marketing/LAUNCH_CHECKLIST.md` (a stated input
to this review and a required launch artifact) does not exist yet and must be
produced; several `docs/OPEN_SOURCE_READINESS.md` reliability/release items
remain unchecked and gate the release referenced in F1.

Re-review recommended once `devin/launch-prep` exists with the README integrated.
