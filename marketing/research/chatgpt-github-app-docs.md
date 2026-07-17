# Wave A Research — Current ChatGPT GitHub App Documentation & Capabilities

**Agent role:** Wave A / Current ChatGPT GitHub app documentation and capability research
**Repo:** `kartikkabadi/chatgpt-yolo`
**Branch:** `devin/wave-a-github-app-docs`
**Date:** 2026-07-17
**Purpose:** Produce accurate, conditional README wording for the section
"Recommended for coding workflows: Connect GitHub to ChatGPT" that preserves the
product boundary — **GitHub connects to ChatGPT; YOLO never receives GitHub
credentials or repository data.**

---

## Findings

### Primary sources (OpenAI Help Center)

The OpenAI Help Center is served behind Cloudflare and returned an
interactive "Verify you are human" challenge on every direct-load attempt from
this environment, so the article bodies could not be rendered in-page. Findings
below are drawn from OpenAI's own indexed article titles + snippets (surfaced via
search) cross-checked against multiple independent, dated secondary sources. Every
quoted OpenAI sentence is an indexed excerpt of the live article, not a paraphrase.

Relevant official articles (current, live):

- **"Connecting GitHub to ChatGPT"** — `https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt`
- **"Apps in ChatGPT"** — `https://help.openai.com/en/articles/11487775-connectors-in-chatgpt`
  (note: the URL slug still contains `connectors-in-chatgpt`, but the current
  page **title is "Apps in ChatGPT"** — direct evidence of the connector → Apps rename)
- **"ChatGPT apps with sync"** — `https://help.openai.com/en/articles/10847137-chatgpt-synced-connectors`
- **"ChatGPT agent"** — `https://help.openai.com/en/articles/11752874-chatgpt-agent`

Verbatim indexed excerpts from **"Connecting GitHub to ChatGPT"**:

> "You can connect your GitHub repositories to ChatGPT apps, as well as ChatGPT
> agent, to ask questions based on your own code. When you connect to GitHub,
> ChatGPT can pull live data from your repositories—code, README files, and
> other docs—and reason over it in real time, either with an app with sync, an
> app with file search, or an app with deep research."

> "Just connect, ask a question, and ChatGPT will read, analyze, and cite the
> relevant snippets straight from your GitHub content."

> "Note: GitHub App availability may vary by ChatGPT plan and experience."

Verbatim indexed excerpt from **"Apps in ChatGPT"**:

> "Apps connect ChatGPT to external tools, information, and actions. … apps can
> take actions on your behalf, search and reference information from your data
> sources, run deep research across multiple sources with citations, display
> information in UI, or sync content in advance…"

Verbatim indexed excerpt from **"ChatGPT apps with sync"** (how it is invoked):

> "You can also explicitly ask ChatGPT to search your app by using an @ mention,
> or adding it from the tools menu (+). If you'd prefer ChatGPT not access your
> app with sync for a particular question, you can include a prompt like
> 'don't search internally.'"

### Terminology (verified)

- **Current official umbrella term: "Apps"** (Settings → **Apps**). The Help
  Center article that used to be "Connectors in ChatGPT" now renders as
  **"Apps in ChatGPT"** while keeping the old `connectors` URL slug.
- **"Connector" is the earlier / transitional term.** The GitHub integration was
  publicly launched (May 2025) as the **"GitHub connector"** for Deep Research —
  confirmed by Neowin ("OpenAI launches GitHub 'connector' for ChatGPT Deep
  Research"), Maginative, TechBooky, and c-sharpcorner. OpenAI has since folded
  connectors under the broader **Apps** concept.
- Practical consequence: depending on a user's rollout/UI experience, the entry
  point may read **"Apps"**, **"Connected apps"**, or **"Connectors"**, and the
  GitHub tile behaves as a connectable **app**. README wording must not hard-code
  one label. It is accurate to say the current name is **the GitHub app in
  ChatGPT** and acknowledge it was **previously called the GitHub connector**.

### Connection steps (verified, with rollout variance)

Consolidated from the official article plus multiple dated third-party
walkthroughs (chatgpt.ca 2026-03, takeitfromageek, DrewTech Hub 2025-11 video).
Exact labels vary by rollout; the shape of the flow is consistent:

1. Open **ChatGPT Settings** (profile menu → Settings).
2. Open **Apps** (may appear as "Connected apps" / "Connectors" depending on rollout).
3. Find **GitHub** (via "Explore apps" / the connectors list) and click **Connect**.
4. Complete the **GitHub OAuth** authorization prompt.
5. **Authorize only the repositories** you want ChatGPT to access (repo selection
   during the OAuth/app-install step).
6. In a conversation, **invoke GitHub** where needed — via the tools/**"+" menu**
   or an **@ mention** — or let an app-with-sync search it automatically.

### Capabilities — universal vs. conditional

**Universally true wherever the GitHub app is connected (read-oriented core):**
- ChatGPT can **read, analyze, and cite** repository content — code, README
  files, and other docs — and reason over it in real time.
- Content is surfaced through one of three app modes: **sync**, **file search**,
  or **deep research**.

**Varies by plan / mode / permissions / rollout (do NOT promise universally):**
- **Plan gating.** The **free tier does not support connected apps.** The GitHub
  deep-research connector launched in beta first to **Plus, Pro, and Team**, with
  **Enterprise and Edu** following later. OpenAI's own note: *"GitHub App
  availability may vary by ChatGPT plan and experience."*
- **Geographic/rollout gating.** Early rollout excluded some regions (reported:
  UK, Switzerland, EEA) and shipped as **beta**; availability continues to change.
- **Org/admin approval.** If a user's GitHub organization restricts third-party
  app access, an **org admin must approve** the ChatGPT app.
- **Repository *actions* (write / issues / PRs) are NOT the base capability.**
  The core GitHub app is read/analyze/cite. Broader "take actions on your behalf"
  behavior is tied to **ChatGPT agent** and to the separate **ChatGPT Codex
  Connector GitHub App** (`github.com/apps/chatgpt-codex-connector`), and depends
  on plan, enabled tools, and granted permissions. **Never promise repo writes /
  PR creation to all users.**

### YOLO ↔ GitHub boundary (must be preserved everywhere)

- YOLO itself **does not** connect to GitHub and **never receives** GitHub
  credentials, repository permissions, repository contents, commits, PR access,
  or issue access.
- The GitHub app is connected **to ChatGPT**, separately and independently, by the
  user via GitHub OAuth.
- Division of responsibility: **ChatGPT's GitHub app** provides repository context
  and (where plan/permissions/tools allow) repository actions; **YOLO** maintains
  the queue and bounded sequence of prompts inside the ChatGPT conversation.

---

## Decisions made

1. Use **"the GitHub app in ChatGPT"** as the primary current term, with a short
   parenthetical **"previously called the GitHub connector."** Avoid hard-coding a
   single settings label ("Apps" vs "Connectors") because rollouts differ.
2. Describe the **read/analyze/cite** capability as the reliable baseline and gate
   everything else ("issues, code changes, reviews, and pull requests") behind
   conditional language — *"where supported and authorized."*
3. State the **plan caveat** plainly (free tier excluded; availability varies by
   plan, region, rollout) rather than implying every user has identical access.
4. Keep the **YOLO/GitHub boundary note** adjacent to the setup steps so it is
   impossible to read the section and conclude YOLO touches GitHub.
5. Do **not** claim YOLO's slash actions are native ChatGPT commands; refer to
   them as **YOLO actions/commands** in the example workflow.

---

## Proposed README wording

Place near the early usage / workflows section. This is drafted to be dropped in
by the README information-architecture agent; heading level can be adjusted to fit
the final structure.

```markdown
### Recommended for coding workflows: Connect GitHub to ChatGPT

For coding work, connect the official **GitHub app** directly to ChatGPT
(previously called the *GitHub connector*). This is set up **inside ChatGPT**,
separately from YOLO.

1. Open **ChatGPT → Settings**.
2. Open **Apps** (depending on your rollout this may read "Connected apps" or
   "Connectors").
3. Find **GitHub** and click **Connect**, then complete the GitHub authorization.
4. **Authorize only the repositories** you want ChatGPT to access.
5. In the relevant conversation, select or **@mention GitHub** (or add it from the
   tools **+** menu) where needed.
6. Then use **YOLO** to queue and bound the sequence of work.

With GitHub connected, ChatGPT can inspect repository context and, where supported
and authorized, help work through issues, code changes, reviews, and pull requests.
YOLO keeps the sequence of instructions moving inside the conversation.

> **The GitHub app is optional and independent from YOLO.** YOLO never receives
> your GitHub credentials or repository data. GitHub is connected to ChatGPT
> separately; YOLO only coordinates the next prompts in the conversation.

_Availability varies by ChatGPT plan, region, and rollout — the free tier does not
support connected apps, and repository **read/analysis** is more widely available
than repository **write actions**. Check ChatGPT's Apps settings to see what your
account supports._

#### Example coding workflow

1. Ask ChatGPT to inspect a repository issue or goal.
2. Queue (a YOLO command): "Implement the smallest complete fix."
3. Queue: "Review the resulting changes for regressions."
4. Queue: "Run or inspect the relevant validation."
5. Queue: "Fix concrete findings."
6. Queue: "Summarize the final state and remaining risks."

A bounded YOLO workflow (`/goal` or `/loop`) can wrap part of this loop with
visible state and explicit limits. What each ChatGPT account can actually *do* to a
repository depends on your plan, connected app, and granted permissions.
```

---

## Validation performed

- Confirmed the live official article title **"Connecting GitHub to ChatGPT"**
  (`/articles/11145903-...`) and captured three verbatim indexed excerpts,
  including the explicit **"availability may vary by ChatGPT plan and experience"**
  caveat.
- Confirmed the **connector → Apps** rename via the OpenAI article whose slug is
  `connectors-in-chatgpt` but whose current title is **"Apps in ChatGPT."**
- Cross-checked plan/rollout gating against ≥5 independent dated sources
  (Neowin, TechBooky, Maginative, c-sharpcorner, tech.yahoo, saipien, chatgpt.ca):
  free tier unsupported; Plus/Pro/Team first, Enterprise/Edu later; regional/beta
  limits.
- Confirmed invocation mechanics (**@mention / tools "+" menu / auto-sync**) from
  the official "ChatGPT apps with sync" article excerpt.
- Confirmed a **separate write-capable path exists** (ChatGPT agent; ChatGPT Codex
  Connector GitHub App at `github.com/apps/chatgpt-codex-connector`) — justifying
  the conditional treatment of write/PR actions.
- Verified the proposed README wording preserves the YOLO/GitHub boundary and adds
  no new product claims that violate the brief's non-goals.

---

## Risks

- **Cloudflare block:** article *bodies* could not be rendered in-environment;
  findings rely on OpenAI's own indexed excerpts + corroborating sources. Before
  final publish, an agent on a non-blocked network (or a human) should open the two
  primary articles and confirm the exact current settings labels and the precise
  step order, since OpenAI's UI wording shifts frequently.
- **Fast-moving terminology/UI:** "Apps" vs "Connected apps" vs "Connectors" and
  the exact menu path change across rollouts and over time. The wording is
  deliberately label-tolerant, but a screenshot-based agent capturing the demo
  assets should reconcile the live UI at capture time.
- **Overpromising writes:** the biggest accuracy risk is implying every user can
  have ChatGPT open PRs / edit issues. The proposed wording gates this behind
  "where supported and authorized" and an explicit availability note — keep that
  guard in any edits.
- **Plan/region drift:** beta gating and regional exclusions are time-sensitive;
  avoid naming specific regions or a hard plan matrix in the README (kept general
  on purpose).

---

## Recommended next action

- Hand this wording to the **README information-architecture / conversion-copy
  agent** to slot into the early workflows section, matching final heading levels
  and voice.
- Have a **non-Cloudflare-blocked agent or human** open the two primary OpenAI
  articles once to confirm the current exact settings labels + step order, and to
  grab a current screenshot for the "Optional GitHub app" demo asset.
- Ensure the **accessibility/privacy reviewer** verifies the boundary note ("YOLO
  never receives your GitHub credentials or repository data") is present at every
  place the GitHub workflow appears (README, video, imagery), per the brief.
- The **product-claim reviewer** should confirm no wording implies OpenAI
  endorsement or that YOLO is a GitHub integration.

### Source list

- OpenAI Help Center — "Connecting GitHub to ChatGPT": https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
- OpenAI Help Center — "Apps in ChatGPT" (slug: connectors-in-chatgpt): https://help.openai.com/en/articles/11487775-connectors-in-chatgpt
- OpenAI Help Center — "ChatGPT apps with sync": https://help.openai.com/en/articles/10847137-chatgpt-synced-connectors
- OpenAI Help Center — "ChatGPT agent": https://help.openai.com/en/articles/11752874-chatgpt-agent
- ChatGPT Codex Connector GitHub App: https://github.com/apps/chatgpt-codex-connector
- Neowin (2025-05-08): OpenAI launches GitHub "connector" for ChatGPT Deep Research
- TechBooky (2025-05-12): ChatGPT Deep Research Now Links to GitHub Repos (plan/region gating)
- Maginative (2025-05-08); tech.yahoo (2025-05-08); c-sharpcorner beta note; chatgpt.ca (2026-03) step-by-step; takeitfromageek (Settings → Connected apps → Connectors flow)
</content>
</invoke>
