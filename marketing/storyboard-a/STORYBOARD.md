# Storyboard A — YOLO for ChatGPT launch video

> Wave B creative deliverable · Motion storyboard A
> Independent proposal. Not the final selected storyboard. To be compared against Storyboard B before a direction is chosen.

- **Format:** 1920×1080, 16:9, 30 fps, H.264 / `yuv420p`
- **Duration:** 42 s (inside the required 35–45 s window; per-scene budget below)
- **Working title:** *Queue the next steps*
- **Muted-first:** every message is legible for its full dwell without audio.
- **Product boundary:** YOLO manages the prompt queue and bounded workflow **inside** the ChatGPT conversation. The GitHub app connects **directly to ChatGPT**, never to YOLO.

---

## 1. Summary

Storyboard A is a **calm, product-native screen tour**. The camera never leaves the real ChatGPT + YOLO surface: we frame the actual popup (`popup.html`), the composer command palette (`command-ui.js`), and the bounded-workflow card, and we let *the interface itself* do the talking through direct-manipulation motion — queue items sliding into place, a palette opening from the composer, a bounded iteration counter advancing and then **stopping**.

The narrative follows the product positioning hierarchy: first the pain (returning just to say "continue"), then the fix (queue the next steps), then the depth (composer actions and *bounded* workflows), then the strongest optional setup (GitHub connected to ChatGPT), then the trust proofs (draft-protected, pauses when ambiguous, local by default), then a quiet end card.

Design language is inherited from the real UI: warm off-white / near-black, graphite + zinc surfaces, quiet borders, restrained shadows, compact system type with monospace accents, and the product's semantic status colors — **green** for running, **amber** for paused/caution, **red** only for blocked/failed. No neon gradients, no robots, no sparkles, no 3D camera travel. The "YOLO" name is deliberately counterbalanced by disciplined, controlled motion.

**Why this direction:** it is the most defensible against the adversarial "is any scene generic AI slop?" review, it is cheap and deterministic to render (real captures + 2D layout motion), and it makes the product boundary structurally hard to misread because the GitHub label lives on-screen as a persistent chip rather than a claim.

---

## 2. Scene-by-scene breakdown

Timecodes are `mm:ss.f` (frames at 30 fps). Total = 42.0 s. Each on-screen line's **dwell** (time fully readable) is called out; minimum dwell for any full sentence is ~1.8 s, minimum for a short chip is ~1.2 s, so nothing flashes.

### Scene 1 — Problem · 00:00.0–00:04.0 (4.0 s)

- **Visual:** Open cold on a real ChatGPT conversation, mid-scroll, a long assistant response just finished. The composer is empty. A soft cursor blinks. We are already *inside* the product — no logo animation, no title card.
- **On-screen text (word for word):**
  - `Stop babysitting long ChatGPT tasks.`
- **Key motion:**
  - `00:00.0` first legible frame is the ChatGPT surface (this is also the poster frame).
  - `00:00.6–00:01.2` the headline fades/rises 12 px into the lower-left safe zone over a low-contrast scrim (opacity ramp, restrained ease-out). Dwell ≈ 2.6 s.
  - `00:02.4` a single faint "return to type *continue*" cursor tick near the composer implies the chore, without kinetic clutter.
- **Audio notes:** Silence, or one soft low pad note fading in (see §5). No UI sound yet.

### Scene 2 — Queue · 00:04.0–00:12.0 (8.0 s)

- **Visual:** The YOLO popup (`popup.html`) masks in over the right third — header brand mark `Y`, status badge, scope line `Current conversation`, `Mode` selector on **Balanced**, and the `Next instruction` composer. Three realistic instructions insert into the `Queue` list one at a time.
- **On-screen text (word for word):**
  - `Queue what should happen next.`
  - Queue items (real product content, staged demo scenario):
    1. `Review the implementation for concrete edge cases.`
    2. `Run the complete validation suite.`
    3. `Fix any reproducible failures.`
  - UI labels visible (from real UI): `Balanced`, `3 queued`, queue-row controls, `Send next`.
- **Key motion:**
  - `04.0–04.6` popup masks in from the right (clip-reveal, no bounce, ~18 px settle).
  - `05.0`, `06.0`, `07.0` each queue row slides in from the composer and lands in the ordered list; the `queueCount` chip ticks `1 queued → 2 queued → 3 queued` in sync (direct manipulation; the count is real UI state).
  - `08.2` a cursor drags row 3 above row 2 and back a hair to demonstrate reordering, then releases (shows ordering is user-controlled). Keep it small.
  - `10.6` a controlled highlight sweeps the top item and the `Send next` control pulses once — a controlled transition *toward* sending, not an actual auto-send.
  - Headline `Queue what should happen next.` dwell ≈ 3.0 s in the left safe zone.
- **Audio notes:** Optional soft "tick" on each of the 3 insertions (restrained, −18 dBFS), one softer tick on reorder. Muted-safe.

### Scene 3 — Composer actions · 00:12.0–00:19.0 (7.0 s)

- **Visual:** Focus shifts back to the ChatGPT **composer**. User types `/` in an empty composer (or the `⌘/Ctrl + Shift + P` hint shows) and the YOLO command palette (`command-ui.js`, search placeholder `Type a command`) opens anchored above the composer. Four entries are highlighted in turn.
- **On-screen text (word for word):**
  - `Start from the composer.`
  - Palette rows (real titles + descriptions from `commands.js`):
    - `/goal` — `Start a marker-driven objective that YOLO can continue for bounded turns.`
    - `/loop` — `Run bounded, marker-driven iterations toward one objective.`
    - `/review` — `Queue an adversarial review prompt for the current work or scope.`
    - `/continue` — `Queue a prompt to continue the current task, optionally with a direction.`
  - Small persistent footnote chip: `YOLO command · not a native ChatGPT command`
- **Key motion:**
  - `12.0–12.5` keyboard cue: a `/` glyph presses; palette masks up from the composer top edge (clip reveal).
  - `13.0–16.0` a highlight bar steps down `/goal → /loop → /review → /continue`, ~0.7 s each, each row's description fully readable as it highlights.
  - `16.4` user picks `/loop 4 audit reliability gaps` — the argument text types into the palette search line (`search.placeholder` becomes the args hint), setting up Scene 4 with a concrete **bounded** command.
  - Headline `Start from the composer.` dwell ≈ 2.6 s.
- **Audio notes:** Soft key clicks under the typing (very low). One soft confirm tone on selection. Optional.

### Scene 4 — Bounded workflow · 00:19.0–00:28.0 (9.0 s)

- **Visual:** The workflow card (`command-ui.js` workflow section) appears with badge = `loop`, title = the objective, and the iteration subtitle. The bound is unmistakable and the run **ends visibly**.
- **On-screen text (word for word):**
  - `Bounded workflows. Visible state. Your controls.`
  - Workflow card (real UI text):
    - Badge: `loop`
    - Title/objective: `Audit reliability gaps`
    - Sub-line advances: `running · iteration 1/4` → `running · iteration 2/4` → `paused · iteration 2/4`
    - Action buttons (real): `Pause` · `Edit` · `Stop`
  - Progress segments overlay: four segments, filling `1/4`, `2/4`, then holding.
- **Key motion:**
  - `19.0–19.6` workflow card masks in beneath the composer; four **progress segments** draw in empty (establish the upper bound up front).
  - `20.4` segment 1 fills green; sub-line reads `running · iteration 1/4`.
  - `22.6` segment 2 fills green; sub-line reads `running · iteration 2/4`.
  - `24.6` cursor moves to `Pause`; on click the running color shifts **green → amber**, sub-line reads `paused · iteration 2/4`, and the `Pause` button label swaps to `Resume` (this is the real UI behavior). Remaining segments 3–4 stay unfilled.
  - `26.0` brief hold on the paused/amber state with `Pause · Edit · Stop` all legible — proves controllability and that it does **not** run forever.
  - Headline `Bounded workflows. Visible state. Your controls.` dwell ≈ 3.4 s (longest line, most important claim).
- **Audio notes:** Two soft "advance" ticks on iterations 1 and 2; one lower "settle" tone on pause. No triumphant sting.

### Scene 5 — Optional GitHub setup · 00:28.0–00:35.0 (7.0 s)

- **Visual:** ChatGPT is shown with an **optional** connected GitHub app / repository context surfaced unobtrusively in the conversation. Alongside, the YOLO queue holds a coding sequence. A persistent label makes the boundary explicit.
- **On-screen text (word for word):**
  - `Connect GitHub to ChatGPT.`
  - then: `YOLO keeps the next steps moving.`
  - **Boundary label (must be legible):** `Optional GitHub app · Connected directly to ChatGPT`
  - YOLO queue sequence (staged demo): `inspect` · `implement` · `validate` · `review` · `summarize`
- **Key motion:**
  - `28.0–28.6` a subtle crop transition pans from the composer/workflow region to show ChatGPT's message area where the GitHub app context chip sits. No 3D, no whoosh.
  - `29.0` the boundary label chip fades in and **stays pinned** for the whole scene (fully readable ≥ 4 s). It sits visually attached to the ChatGPT side, not the YOLO popup — reinforcing that GitHub connects to ChatGPT.
  - `29.6–32.0` the five queue items (`inspect → implement → validate → review → summarize`) insert in order on the YOLO side, mirroring Scene 2's motion vocabulary.
  - `30.0` line 1 `Connect GitHub to ChatGPT.` (dwell ≈ 2.2 s), then `32.4` line 2 `YOLO keeps the next steps moving.` (dwell ≈ 2.4 s) — sequential, never overlapping so both read cleanly.
- **Audio notes:** Same soft insertion ticks as Scene 2. No new motif.
- **Boundary guard:** Nothing in this scene may imply YOLO holds GitHub credentials or performs repository actions. No fake GitHub UI chrome; use a restrained, generic "connected app" chip, not a cloned GitHub screen.

### Scene 6 — Reliability · 00:35.0–00:40.0 (5.0 s)

- **Visual:** Three rapid-but-readable product truths, each paired with the *real* product state that proves it, rather than an abstract icon.
- **On-screen text (word for word):**
  - `Draft protected.`
  - `Ambiguous? It pauses.`
  - `Local by default.`
- **Key motion:**
  - `35.0–36.3` `Draft protected.` — show the composer already containing user-typed text; a queued send is declined and the existing draft is left untouched (real behavior: YOLO never overwrites composer text). Dwell ≈ 1.9 s.
  - `36.7–38.0` `Ambiguous? It pauses.` — the status/activity area shows a fail-closed pause; a status pill shifts to **amber** (never invents a red error). Dwell ≈ 1.9 s.
  - `38.3–40.0` `Local by default.` — footer `Local-only automation` from the real popup is highlighted; a small `chrome.storage.local` tag appears. Dwell ≈ 1.9 s.
  - Transitions are quick cross-dissolves / clip-wipes (≈ 250 ms), readable, never obscuring the underlying UI text.
- **Audio notes:** Three subtle, distinct low ticks (one per truth). Kept quiet; muted-safe.

### Scene 7 — End card · 00:40.0–00:42.0 held to 00:45.0-safe (2.0 s core, hold ≥ 4 s of readability across 40.0–44.5 if extended)

> Budget note: to stay ≤ 45 s and keep the end card readable long enough, the end card runs `40.0–44.5` (4.5 s) in the delivered cut, making total runtime **44.5 s**. The 42 s figure above is the pre-end-card spine; final total is within the 35–45 s window.

- **Visual:** Calm end card on the warm off-white / near-black brand surface with the `Y` mark. No screenshot behind it — quiet and legible.
- **On-screen text (word for word):**
  - `YOLO for ChatGPT`
  - `Queue the next steps. Stay in control.`
  - `Local-first · Open source · No telemetry`
  - CTA: `github.com/kartikkabadi/chatgpt-yolo`
  - Secondary CTA: `Sponsor development`
  - Legal: `Independent project. Not affiliated with OpenAI.`
- **Key motion:**
  - `40.0–40.6` end card masks in; `Y` mark settles (small, no bounce).
  - `40.6` title + tagline appear together; supporting line and CTAs stagger in over ~0.8 s.
  - Everything **holds static ≥ 3.4 s** so the repo URL and legal line are comfortably readable and screenshot-able (this frame doubles as the launch reply image / release image).
  - The `Independent project. Not affiliated with OpenAI.` line is always present and legible — never a fast flash.
- **Audio notes:** Pad resolves and fades to silence by the final frame. No loud outro sting.

---

## 3. Copy (single source of truth)

| Scene | Line(s) | Notes |
| --- | --- | --- |
| 1 | `Stop babysitting long ChatGPT tasks.` | The pain, first. |
| 2 | `Queue what should happen next.` | The fix. |
| 3 | `Start from the composer.` | + `YOLO command · not a native ChatGPT command` footnote. |
| 4 | `Bounded workflows. Visible state. Your controls.` | Bound must be visible; run ends/pauses. |
| 5 | `Connect GitHub to ChatGPT.` → `YOLO keeps the next steps moving.` | + pinned label `Optional GitHub app · Connected directly to ChatGPT`. |
| 6 | `Draft protected.` / `Ambiguous? It pauses.` / `Local by default.` | Each on real product state. |
| 7 | `YOLO for ChatGPT` / `Queue the next steps. Stay in control.` / `Local-first · Open source · No telemetry` / `github.com/kartikkabadi/chatgpt-yolo` / `Sponsor development` / `Independent project. Not affiliated with OpenAI.` | End card. |

**Copy rules honored:** no "AI agent", no "fully autonomous", no "unlimited", no OpenAI-endorsement implication, slash actions always framed as **YOLO commands**, GitHub always "connected to ChatGPT". Video alt text suggestion for the launch post: *"Screen demo of the YOLO Chrome extension queuing next steps and running a bounded, 4-iteration workflow inside a ChatGPT conversation, then pausing on user control."*

---

## 4. Motion notes

**Vocabulary used (all from the brief's allowed list):**
- **Layout motion / queue-item insertion:** rows slide from the composer into the ordered queue; the live `queued` count ticks in lockstep. Reused identically in Scenes 2 and 5 so the language feels consistent.
- **Direct manipulation:** a visible cursor drags to reorder, clicks `Send next`, `Pause`. Motion originates from where a user would actually act.
- **Clean masking / clip reveals:** popup and palette enter via rectangular clip reveals anchored to their real screen position (right third; above composer). No wipes across critical text.
- **Controlled zooms + subtle crop transitions:** at most a gentle push-in (≤ 6%) to emphasize the workflow counter and the GitHub boundary label. One crop pan in Scene 5. No continuous zoom.
- **Progress segments:** the four-segment bound in Scene 4 is drawn empty first, then filled — the *upper limit* is visible before any progress.
- **Cursor / keyboard cues:** `/` keypress and `⌘/Ctrl + Shift + P` hint in Scene 3; cursor for drag/click elsewhere.
- **Responsive typography + restrained easing:** headlines use the product's compact system stack; monospace for slash tokens and the repo URL. Easing is a single restrained ease-out (~cubic 0.22, 0.61, 0.36, 1). No spring overshoot.

**Explicitly avoided (brief's ban list):** decorative meaningless motion, constant zooming, excessive bounce/parallax, 3D camera travel, unreadable kinetic text, transitions that obscure UI, tiny text, sub-1.2 s phrase flashes, and platform controls covering critical content.

**Muted-comprehension guarantees:**
- Every full sentence dwells ≥ 1.8 s; short chips ≥ 1.2 s; the boundary label and legal line dwell ≥ 3 s.
- Only one headline on screen at a time; Scene 5's two lines are strictly sequential.
- Minimum on-screen text size ≈ 34 px at 1080p for body, ≥ 54 px for headlines (comfortably readable on a phone-sized timeline preview).
- Safe margins: 7% action-safe; no critical text in the bottom 12% where X's scrubber/controls sit.

**Layout / safe-area map (1920×1080):**
- Headlines: lower-left quadrant on a low-contrast scrim (Scenes 1–2, 4) / upper-left (Scene 3) to avoid covering the UI element being demonstrated.
- Product surface: centered-right (popup) and center (composer/palette).
- Boundary label (Scene 5): pinned to the ChatGPT side, upper-center-right.

**Square (1080×1080) adaptation note (for downstream production):** recompose, do not blind-crop. Stack headline above the product surface; keep the 4-segment progress bound and the GitHub boundary label at full size; verify no clipped square layout per §18 of the brief.

---

## 5. Audio notes

- **Muted-first:** the video is fully understandable with **no** audio. Audio is an enhancement only.
- **Recommended bed:** one soft, low, non-melodic ambient pad (original or clearly licensed royalty-free), −20 to −24 dBFS, fading in over Scene 1 and resolving to silence by the final frame. No drums, no build-drop, no trailer boom.
- **UI sounds:** restrained, semantic ticks tied to real events — queue insertions (Scenes 2, 5), iteration advances (Scene 4), a lower "settle" tone on pause. Peak ≈ −18 dBFS, short (< 80 ms), never stacked.
- **No synthetic narration** (voiceover only if an exceptionally strong VO is produced; default is none).
- **Provenance:** document track/source and license in `marketing/asset-manifest.json` per brief §17. If no cleared audio is available at render time, **ship silent** — do not risk copyrighted or unvetted tracks.
- **Encode:** AAC only if audio is present; otherwise no audio track. Fast-start optimized.

---

## 6. Risk assessment

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Viewer thinks YOLO holds GitHub access | Medium | Pinned `Optional GitHub app · Connected directly to ChatGPT` label for all of Scene 5, attached to the ChatGPT side; no fake GitHub chrome; copy says "Connect GitHub to ChatGPT". |
| Slash actions read as native ChatGPT commands | Medium | Footnote chip `YOLO command · not a native ChatGPT command` in Scene 3; palette is visibly YOLO-branded. |
| Workflow looks like an endless/autonomous loop | Medium | 4 progress segments drawn empty first (bound shown up front); run visibly **pauses** at 2/4 with `Pause · Edit · Stop`; copy "Bounded workflows". Never show it reaching a "running forever" state. |
| Implies OpenAI endorsement | Low | No OpenAI logos; `Independent project. Not affiliated with OpenAI.` on the end card, legible ≥ 3 s. |
| Text too fast / unreadable muted | Low | Enforced dwell minimums (§4); one headline at a time; sequential lines in Scene 5. |
| "AI slop" perception | Low | Real UI only; no gradients/robots/sparkles/particles/3D; motion is all direct-manipulation and semantic. |
| Video too slow / loses attention | Low–Med | First message at 00:00.6; scene budget front-loads value; no dead air; longest single hold is the end card (intentional, for CTA readability). |
| Private/sensitive data leakage in captures | Medium | Staged demo scenario with invented content, clean profile, no tokens/email/private repos; disclose staged capture in manifest per brief §10. |
| Bottom-edge text hidden by X player controls | Low | No critical text in bottom 12%; CTAs centered on end card. |
| Square version clips layout | Low | Recompose (not crop) per §4; verify per brief §18. |
| Fails file-size / codec spec | Low | Target < 35 MB, H.264 `yuv420p`, 30 fps, fast-start; verify with `ffprobe` per brief §18. |

**Staged-capture disclosure (required downstream):** all queue/workflow/GitHub content shown is an invented demonstration scenario ("Audit this repository, identify the most important reliability gaps, fix them one by one, validate, and stop"), captured in a clean environment. This must be disclosed in `marketing/asset-manifest.json`.

---


