# Wave A — Target-User & Launch-Positioning Research

**Agent role:** Wave A research (target-user and launch-positioning)
**Repository:** `kartikkabadi/chatgpt-yolo`
**Branch:** `devin/wave-a-positioning`
**Scope:** Research + recommendations only. No main files or product code modified.

This report feeds the orchestrator and the Wave B README / launch-copy / visual-direction
agents. It is a handoff, not a final decision — the orchestrator selects.

---

## Findings

### Landscape scan (Chrome Web Store, Product Hunt, GitHub, Reddit)

The "queue messages for ChatGPT" niche already exists and is moderately crowded, but it is
almost entirely occupied by **fire-and-forget bulk senders**. None of the surveyed products
lead on delivery reliability, bounded automation, or a local-first/no-telemetry trust story.
That gap is YOLO's opening.

Representative competitors:

| Product | What it is | How it positions | Gaps YOLO exploits |
| --- | --- | --- | --- |
| **ChatGPT Queue — Prompt Chains & Bulk Prompting** (MIATECHPARTNERS) | Chrome extension, freemium (paid Pro unlocks unlimited queue + bulk) | "Say goodbye to downtime… queue your messages like magic," emoji-heavy, productivity/time-saving | No reliability story, no bounded loops, no privacy stance, paywall |
| **ChatGPT Prompt Automation Queue** | Free extension, saves + replays prompt "sequences" | "Automate prompts with chains and queues," persona list (bloggers/researchers/devs) | Blind sequential auto-send; no fail-closed delivery, no controls, no privacy claim |
| **ChatGPT Toolbox** (~13k users) | All-in-one: prompt chaining (up to 10), prompt library, folders, export, MP3, sync | "The only extension you'll need," kitchen-sink bundle, cloud sync | Broad + heavy; sync implies data leaves device; chaining is a feature among dozens, not a reliability product |
| **gstohl/queue-chatgpt** (GitHub, OSS) | Open-source queue, aimed at image generation | Minimal dev-tool framing | Narrow use case, no workflow/limits story |
| **pedrohusky/chatgpt-continue-autoclicker** (GitHub, OSS) | Auto-clicks the "Continue generating" button | "Time-saver, stop clicking continue" | Single trick; the crudest form of the exact pain YOLO addresses |

**Pattern:** the category's default language is "save time / stop waiting / bulk send," and its
default mechanism is *unconditional* automatic sending. Reliability, bounded control, and
privacy are essentially unclaimed in this niche.

### Demand signal (the pain is real and specific)

Public discussion confirms the underlying pain YOLO's brief describes — users manually
babysitting long sessions: repeatedly typing "continue," re-asking for a review, re-running
validation, and losing state when a long response cuts off mid-task. The existence of a
dedicated "continue" auto-clicker with real users is direct evidence that "I'm tired of
returning just to nudge ChatGPT forward" is a validated, monetizable pain — YOLO addresses it
far more completely and safely.

### Adjacent trust trend (local-first is a live, credible wedge)

A distinct and growing cluster of extensions positions on **local-first / zero-telemetry /
no-account** (e.g. LocalExt, TraceMind, Offsend). Two useful lessons:
1. Technical audiences increasingly distrust extensions that "read the page" and phone home;
   "no data leaves your device" is a real purchase driver, not boilerplate.
2. The credible ones make the claim **verifiable** (open source, inspectable network
   activity), not just asserted. YOLO already satisfies this (no backend, no telemetry, narrow
   `chatgpt.com` host permission, MIT). This is a genuine, defensible differentiator against
   the freemium/cloud-sync incumbents — but per the brief it is a **trust proof, not the
   opening hook**.

---

## Decisions made (recommendations for the orchestrator)

### 1. Target users (primary → tertiary)

**Primary — "AI power users running long, iterative ChatGPT sessions."** People who keep a
single conversation open for an hour+ doing multi-step work and are tired of being the
message-forwarding loop between themselves and the model. High overlap with developers using
ChatGPT for repo work (inspect → implement → validate → review → summarize).

**Secondary — Privacy/trust-conscious technical users.** Developers and security-minded users
who *want* a queue extension but refuse cloud-sync/telemetry/freemium tools that read their
ChatGPT page. YOLO's local-first, no-backend, narrow-permission, open-source posture is built
for exactly this buyer. Reach them with the trust proofs *after* the hook lands.

**Tertiary — Heavy research/content/ops workflow users.** Anyone running repeatable
multi-step prompt sequences (analysis, drafting, structured review). Real but crowded and less
differentiated; do not lead with this persona or YOLO reads as "another bulk-prompt tool."

**Deliberately NOT the target (avoid these framings):** people shopping for an "autonomous AI
agent," a hands-off "set it and forget it" bot, or a rate-limit / capability unlock. Chasing
them invites prohibited claims and the exact "reckless" perception the YOLO name already
risks.

### 2. Strongest value proposition

**Reliable, bounded control over long ChatGPT conversations — queue the next steps and run
visibly-bounded workflows, without babysitting and without giving up control or your data.**

The differentiated core (vs. every incumbent) is **reliability + boundedness + local-first**,
not "queue messages" (table stakes) and not "automation" (which sounds reckless and invites
prohibited agent claims):
- **Reliable delivery** — fail-closed, exact receipts, duplicate prevention, draft protection.
  Incumbents blindly fire text; YOLO is the one that *doesn't* double-send or clobber your draft.
- **Bounded workflows** — `/goal` and `/loop` with hard caps (default 12, max 50 turns),
  visible state, and Pause/Edit/Stop. This is the antidote to "uncontrolled loop" fear.
- **Local-first & inspectable** — no backend, no telemetry, narrow permissions, MIT. The trust
  proof that closes technical and privacy-conscious users.

### 3. Positioning within the prohibited-claim guardrails

Keep the brief's positioning order: (1) stop returning just to send the next prompt →
(2) queue what's next → (3) bounded workflows for repeatable work → (4) stay visibly in
control → (5) pair with ChatGPT's GitHub app → (6) everything stays local → (7) open source.

Language guardrails validated against the landscape (competitors routinely trip these):
- **Say:** "extension," "queue," "bounded workflows," "prompt shortcuts," "YOLO action /
  YOLO command," "keeps the next steps moving," "you stay in control," "local-first."
- **Never say:** "AI agent," "autonomous," "fully autonomous," "agent platform," "coding-agent
  orchestrator," "unlocks / unlimited," "bypass," "replaces coding agents," or anything
  implying OpenAI affiliation or that YOLO holds GitHub access. Keep the "Independent project.
  Not affiliated with OpenAI." notice near the top and the "GitHub connects to ChatGPT, not
  YOLO" separation on every surface where GitHub appears.
- **Competitive contrast to lean on (without naming competitors):** where the category says
  "blindly bulk-send," YOLO says "delivers reliably, pauses when ambiguous, and stays
  bounded." That is the honest, defensible wedge.

### 4. One-line hook

**Recommendation: keep the brief's default hook.** It is strong, accurate, and already
sequences pain-last for punch:

> Queue the next steps. Run bounded workflows. Stop babysitting long ChatGPT conversations.

It beats every competitor tagline surveyed (which are generic "save time / no more waiting")
because it names the specific behavior (queue, bounded) *and* the emotional pain (babysitting)
without a single prohibited claim.

Two alternatives offered for the copy agents to A/B — **only** adopt if review finds one
clearly stronger; otherwise default wins:

- **A (pain-first, punchier):**
  > Stop babysitting long ChatGPT conversations. Queue the next steps and run bounded workflows.
- **B (control-forward, for the privacy/technical persona):**
  > Queue the next steps in ChatGPT — bounded, reliable, and entirely local.

Do not make "local-first" the opening hook (per brief); it belongs in the supporting line and
the trust proofs.

### 5. YOLO naming risk + counterbalance

**Risk:** "YOLO" (you only live once) connotes recklessness, impulsiveness, and
*unbounded* risk-taking — the precise opposite of a fail-closed, bounded, privacy-preserving
tool, and dangerously adjacent to the "uncontrolled autonomous agent" framing the brief
forbids. A careless visual/tone treatment would make skeptics assume the extension YOLOs your
ChatGPT account.

**Counterbalance strategy (reframe, don't hide, the name):**
- **Reframe the acronym implicitly through control language.** Pair "YOLO" with words like
  *bounded, reliable, visible, local, in control* everywhere. Let the contrast between the
  playful name and the disciplined product become the memorable hook, not a liability.
- **Visual identity must read calm/technical/controlled** (aligns with brief §9): warm
  off-white, near-black, graphite/zinc surfaces, quiet borders, restrained shadows, compact
  system typography, monospace accents. Semantic color only: green = running/success,
  amber = paused/caution, red = blocked/failed. **Avoid** neon AI gradients, robots, sparkles,
  "unlimited autonomy" imagery, meme branding — all of which would amplify the reckless read.
- **Show boundedness visually as the signature.** Lead hero/video/screenshots with the
  *bounded* signals — "Turn 2 of 4," Pause/Edit/Stop, queue ordering, "Ambiguous? It pauses."
  The most on-brand move is proving the name wrong: YOLO, but disciplined.
- **Front-load trust proofs** near the name: independent-project disclaimer, local-first,
  no telemetry, open source, narrow permissions. These neutralize "is this thing safe?"
  before it forms.

### 6. Primary CTA order & messaging hierarchy

**CTA order (matches brief; validated as correct):**
1. **Install** — dominant primary action; lowest-friction path first (release archive → load
   unpacked). Never hide it behind marketing copy or image-only buttons.
2. **Watch demo** — secondary; the video carries comprehension for the "what does it actually
   do" question in ~40s.
3. **Sponsor development** — present and compact, but never the dominant CTA. No guilt
   language. Sponsorship stays out of the launch post's lead and lives in the first reply /
   later reply.

**Messaging hierarchy (top of README / social surfaces):**
1. Title: **YOLO for ChatGPT**
2. Hook (the one-liner above)
3. Compact supporting descriptor (local-first Chromium extension: persistent queues,
   composer-native actions, visible bounded automation)
4. Independent-project disclaimer (kept near top, not buried)
5. High-value badges only (CI, CodeQL, MIT, real release, MV3) — no fake counts
6. Hero (real product: queue + ChatGPT context in one glance)
7. Primary actions (Install · Watch demo · Sponsor development)
8. Three-value summary: **Queue the next steps · Run bounded workflows · Stay in control**
9. Optional GitHub-app section (separate from YOLO, accurate/conditional wording)

**Launch-post hierarchy (for the copy agents):** lead with the *pain* ("great at long
tasks—until you keep coming back to say continue / review it / run the tests"), then the
*product* ("open-source Chrome extension: reliable prompt queue + bounded workflows"), then
the *payoff* ("queue the next steps, walk away, stay in control"). Repo link + install + GitHub
separation + sponsor invite go in the **first reply**, not the main post.

---

## Files changed

- Added: `marketing/research/target-user-positioning.md` (this report).
- No other files touched. No product/runtime code, README, metadata, or config modified.

## Validation performed

- Surveyed the live ChatGPT queue/automation landscape across Chrome Web Store, Product Hunt,
  GitHub, and Reddit/forum discussion (competitors, taglines, mechanisms, gaps documented above).
- Cross-checked every recommendation against the orchestration brief's product truth (§2),
  prohibited claims / non-goals (§2, §8), GitHub-app separation (§3), sponsorship rules (§4),
  and visual identity constraints (§9).
- Verified claims against the repo's own `README.md` (queue reliability, fail-closed delivery,
  bounded `/goal` & `/loop` caps, narrow permissions, no telemetry/backend) so positioning maps
  to real product behavior only.
- No product behavior was executed or tested; this is research/positioning, not a code change.

## Risks

- **Crowded "queue" keyword.** If YOLO leads on "queue messages" alone it blends into
  free/freemium incumbents. Mitigation: lead on reliability + boundedness + local-first; use
  "queue" as the entry concept, not the differentiator.
- **YOLO name misread as reckless** (see §5). Mitigation: disciplined visual/tone + bounded
  proofs + front-loaded trust signals.
- **Claim drift toward "agent."** Reviewers/copy iterations may slide into "autonomous"/"agent"
  language because it tests well. Mitigation: the Wave D product-claim reviewer must hard-gate
  the prohibited-terms list; keep "YOLO action/command" and the OpenAI/GitHub disclaimers.
- **Local-first over-promise.** Technical audiences will verify. Only claim what's inspectable
  (no backend, no telemetry, narrow host permission, MIT) — which the repo already satisfies.
- **Persona over-broadening.** Trying to also win "autonomous agent" shoppers weakens the
  message and invites prohibited claims. Hold the primary persona.

## Recommended next action

1. **Wave B copy agent:** default to the brief's hook; A/B test alternatives A/B only, and
   carry the pain → product → payoff launch-post hierarchy above.
2. **Wave B visual agents:** treat "disciplined counterbalance to a playful name" as the core
   creative constraint; make boundedness (Turn N of M, Pause/Edit/Stop) the signature visual.
3. **Wave B README IA agent:** use the messaging hierarchy in §6; keep disclaimer + trust
   proofs near top; "queue" as entry, reliability/bounded/local as the differentiators.
4. **Wave D product-claim reviewer:** enforce the prohibited-terms guardrails in §3 across
   README, video, and launch copy before the final PR.
