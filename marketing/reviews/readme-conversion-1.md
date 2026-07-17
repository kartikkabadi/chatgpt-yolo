# Wave D — README / Conversion Review #1

**Reviewer role:** Independent README & conversion reviewer (Wave D). Did not author the reviewed README copy.
**Date:** 2026-07-17
**Verdict:** **Needs revision** — strong, brief-compliant copy, but blocked by a false install/release claim and unresolved asset/demo integration.

---

## 0. Scope note & source-of-truth caveat (read first)

The task asked me to read `README.md` on branch **`devin/launch-prep`** and compare it against
`marketing/README_DRAFT.md`, `marketing/BRAND.md`, `marketing/LAUNCH_COPY.md`, and `docs/PRODUCT_DIRECTION.md`.

Actual repository state at review time:

| Expected input | Status |
| --- | --- |
| Branch `devin/launch-prep` | **Does not exist** on the remote (`git ls-remote --heads origin` shows no such ref). |
| `marketing/README_DRAFT.md` | Exists on **`devin/wave-b-readme-copy`** (298 lines). This is the redesigned README draft and is the primary artifact reviewed. |
| `README.md` (redesigned) | On `devin/wave-b-readme-copy`, `README.md` is **byte-identical to `main`** — the redesign has **not** been promoted into `README.md` yet; it lives only in `marketing/README_DRAFT.md`. |
| `marketing/BRAND.md` | **Does not exist on any branch.** Not available for comparison. |
| `marketing/LAUNCH_COPY.md` | **Does not exist on any branch.** Not available for comparison. |
| `docs/PRODUCT_DIRECTION.md` | Exists on `main`. Used as the product-truth baseline. |

**What I reviewed:** `marketing/README_DRAFT.md` @ `devin/wave-b-readme-copy` (the proposed launch README) against
`docs/PRODUCT_DIRECTION.md` (main), the live `README.md` (main), and the Wave-A research
(`marketing/research/product-truth-audit.md` @ `devin/wave-a-product-truth`,
`marketing/research/sponsorship-strategy.md` @ `devin/wave-a-sponsorship`).

Because `BRAND.md` and `LAUNCH_COPY.md` do not exist, brand-voice and launch-copy cross-consistency could **not** be checked. Re-run this review against the real integrated `devin/launch-prep` README once it exists and those two files are produced.

Line numbers below refer to `marketing/README_DRAFT.md` on `devin/wave-b-readme-copy` unless stated otherwise.

---

## 1. Verdict

**Needs revision.** The draft is genuinely strong: the hook, three-value summary, product-boundary defense, GitHub-app separation, and privacy/permissions accuracy are all launch-grade and closely follow the brief. It is **not launch-ready** only because of concrete truth/integration defects that a visitor would hit within the first click:

1. The README presents a release-archive download as the "quickest path" and shows a "Latest release" badge, but **no GitHub release or tag exists** — a first-time installer hits a dead end.
2. Every image (`hero`, 5 screenshots, demo poster) is referenced but **not present on the README's own branch**, and the "Watch the demo" action currently links a poster image to itself rather than to a watchable video.

Fix the must-fix items and integrate the Wave-C assets, and this becomes launch-ready.

---

## 2. Top findings

### MUST-FIX

#### M1 — Install path & "Latest release" badge claim a release that does not exist
**Evidence:**
- Line 12: `[![Latest release](https://img.shields.io/github/v/release/kartikkabadi/chatgpt-yolo?sort=semver)](.../releases)`
- Lines 139–145:
  > `### From a release archive (quickest path)`
  > `1. Download the latest yolo-v*.zip release asset and unzip it.`

Verified: `git tag` is empty, `git ls-remote --tags origin` is empty, and there are no published releases. The "Latest release" shields badge will render **"no release"/"repo not found"**, and the "quickest path" instruction sends users to a non-existent asset. This directly violates the brief's "do not claim a release exists if it does not" and the Wave-A product-truth Finding #3. This is the single most damaging launch defect (breaks trust on the first action).

**Proposed alternative text** (choose one):

*Option A (preferred): ship a real `v1` release + `yolo-v*.zip` asset before launch, then the existing copy and badge become true — no wording change needed.*

*Option B (if launching without a release): lead with the verified From-source path, defer the archive, and remove the Latest-release badge.* Replace lines 137–156 with:

```markdown
## Install

### From source (current path)

```bash
git clone https://github.com/kartikkabadi/chatgpt-yolo.git
cd chatgpt-yolo
npm run validate
npm run package
```

Then open `chrome://extensions` in Chrome, Edge, Brave, Arc, or another Chromium
browser, enable **Developer mode**, choose **Load unpacked**, and select `dist/yolo`.
Open or refresh a ChatGPT conversation.

### From a release archive

Prebuilt `yolo-v*.zip` archives are published on the
[Releases](https://github.com/kartikkabadi/chatgpt-yolo/releases) page. Once a
release is available: download and unzip it, then **Load unpacked** the `yolo`
folder as above.
```

And delete line 12 (the Latest-release badge) until a real release exists. Re-add it after the release is published.

#### M2 — Referenced images are absent from the README branch (broken integration)
**Evidence:** the draft references `docs/assets/hero.webp` (line 15), `screenshot-queue.webp` / `screenshot-command-palette.webp` / `screenshot-workflow.webp` / `screenshot-github-workflow.webp` / `screenshot-settings.webp` (lines 112–124), and `demo-poster.webp` (line 131).

On `devin/wave-b-readme-copy`, `docs/assets/` is **empty** — so as it stands, every image 404s. The assets do exist elsewhere:
- `hero.webp`, `demo-poster.webp`, `social-preview.png`, `yolo-mark.svg` → `devin/wave-c-images`
- all 5 `screenshot-*.webp` → `devin/wave-c-capture`

This is an **integration dependency**, not a copy error: the final `devin/launch-prep` branch must merge the Wave-C assets alongside this README, or every image renders broken at launch. Flagging as must-fix because a launch with broken hero + screenshots is worse than no images. (The filenames referenced match the produced assets exactly, which is good.)

### SHOULD-FIX

#### S1 — "Watch the demo" does not lead to a watchable demo
**Evidence:** Lines 17 (`[Watch the demo](#demo)`) and 127–133:
```markdown
## Demo
<a id="demo"></a>
[![Watch the YOLO demo](docs/assets/demo-poster.webp)](docs/assets/demo-poster.webp)
```
The primary "Watch the demo" action jumps to the Demo section, whose poster image **links to itself** (`demo-poster.webp` → `demo-poster.webp`), not to a video. A user clicking "Watch the demo" never reaches a video. Once the Wave-C/launch video exists, point the poster link at the actual video (release asset, hosted MP4, or the launch post/X URL), e.g. `[![Watch the YOLO demo](docs/assets/demo-poster.webp)](<VIDEO_URL>)`. If no hosted video is available at launch, relabel the top action to "See the demo" to avoid promising playback.

#### S2 — Add the explicit "sponsorship is optional / never required" line
**Evidence:** Support section, lines 276–287. The copy is well-judged (conditional "If it saves you time", $5/$10 confirmed live by the sponsorship agent, no guilt language). However the Wave-A sponsorship strategy's recommended block ends with:
> "Sponsorship is entirely optional and is never required to install or use YOLO."
The draft omits this line. The brief (§4) says "Do not imply sponsorship is required." The draft does not imply it, but adding the explicit sentence is a cheap, high-trust safeguard. Recommend appending it to the Support section.

### NICE-TO-FIX

#### N1 — Duplicate `#demo` anchor
Lines 128–129: the `## Demo` heading already generates the slug `#demo`, and an explicit `<a id="demo"></a>` is added immediately after. This creates two elements with id `demo`. Harmless in most renderers but redundant; drop the explicit anchor and rely on the heading slug, or move the anchor above the heading so the jump lands on the title.

#### N2 — Hook wording drift vs. core launch message
Line 3 uses "Stop babysitting long ChatGPT **conversations**"; the brief's core message is "Stop babysitting long ChatGPT **tasks**." Both are fine and "conversations" is consistent with the descriptor; noting only so the README, `LAUNCH_COPY.md` (once written), and the social preview stay consistent on one phrasing.

#### N3 — Sponsor link uses the raw Whop URL rather than the GitHub Sponsor button
Lines 17 and 280 link directly to `https://whop.com/vex-app/support-for-oss/`. This is truthful and resolves to the same destination as the `FUNDING.yml` Sponsor button. The sponsorship strategy suggested preferring the repo's GitHub **Sponsor button** where natural (it hides the off-brand `vex-app` slug). Optional; either is acceptable.

---

## 3. Checklist results

| Check | Result | Notes |
| --- | --- | --- |
| Hook clarity | **Pass** | Line 3 matches the brief's recommended hook; pain-led, scannable. |
| Value proposition | **Pass** | Line 5 descriptor + three-value summary (lines 25–35) mirror brief §8. Positioning order is pain → queue → bounded → control → GitHub → local → OSS. |
| Install path accuracy | **Fail (M1)** | Release archive + Latest-release badge reference a non-existent release. |
| Trust signals | **Pass** | No-affiliation disclaimer (line 7) kept near top; local-first, no telemetry, permissions/privacy section all present and accurate. |
| GitHub-app wording | **Pass** | Lines 76–106: separation preserved, "optional and independent," "YOLO never receives your GitHub credentials or repository data," conditional capability language, "previously called the GitHub connector." Excellent. |
| Sponsorship presentation | **Pass (S2 minor)** | Action order Install → Watch demo → Sponsor (line 17); $5/$10 confirmed live; no guilt language. Add explicit "optional/never required" line. |
| Screenshot references | **Fail (M2)** | Referenced files absent from the branch; exist on Wave-C branches — integration required. |
| Alt text | **Pass** | Hero and all 5 screenshots have descriptive, accurate alt text (lines 15, 112–124). |
| Badge truthfulness | **Fail (M1)** | CI, CodeQL (workflows exist on main), MIT, Manifest V3 badges are truthful; **Latest release badge is not** (no release). No fake download/usage badges. |
| No AI-agent/backend/GitHub/OpenAI implication | **Pass** | Clean. "not an agent platform" (line 68), slash actions labelled "YOLO extension actions" (line 171), boundary section intact, no "Codex" wording in the README. |

### Preserved-accuracy audit (brief §8 "do not weaken")
All required protections are retained verbatim from the current README: the no-affiliation disclaimer (line 7), the "normal Chrome extension, not an agent platform" boundary (lines 66–72), the rate-limit/access-control non-bypass statement (line 248), the probabilistic-model caveat (line 250), and the "YOLO extension actions, not native ChatGPT commands" framing (line 171). The detailed technical sections (Queue reliability, Profiles, Backups/diagnostics, Permissions, Compatibility, Development, Release verification) are all preserved. **No accuracy regressions introduced.**

### Note on "Codex" (product-truth cross-check)
The Wave-A product-truth audit flagged "Codex-style" wording as a HIGH OpenAI-association risk — but those occurrences are in `manifest.json`, `onboarding.html`, and `CHANGELOG.md`, **not** in this README draft. The README draft itself is Codex-free and compliant. Out of scope for this README review, but the manifest/onboarding fixes remain owned by the product-truth/integration workstream and must land before launch.

---

## 4. Summary for the orchestrator

- **Verdict: needs revision.** Copy quality is launch-grade; two must-fix defects block launch.
- **Top 3 findings:**
  1. **M1 (must-fix):** Install "quickest path" + Latest-release badge claim a release that does not exist (no tags/releases). Either publish a real `v1` release or lead with From-source and drop the release badge.
  2. **M2 (must-fix):** Hero, 5 screenshots, and demo poster are referenced but absent on the README branch — the Wave-C image/capture assets must be integrated onto `devin/launch-prep` or every image breaks.
  3. **S1 (should-fix):** "Watch the demo" links a poster to itself; wire it to the actual launch video once produced.
- **Blocking caveat:** `devin/launch-prep`, `marketing/BRAND.md`, and `marketing/LAUNCH_COPY.md` do not exist yet; brand-voice and launch-copy consistency were not reviewable. Re-run this review against the integrated branch once those exist.
