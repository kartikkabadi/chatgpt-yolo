# Wave A — GitHub Metadata & Discoverability Research

Repository: `kartikkabadi/chatgpt-yolo`
Agent role: GitHub repository metadata, topics, README, and discoverability research.
Date: 2026-07-17

## Findings

### Current repository metadata (baseline)

Queried via `gh repo view kartikkabadi/chatgpt-yolo`:

| Field | Current value |
| --- | --- |
| `description` | *(empty)* |
| `homepageUrl` | *(empty — correct, must stay blank)* |
| `repositoryTopics` | *(none set)* |

So the About section is currently empty: no description, no topics, no website. Everything below is net-new metadata to apply.

### Product truth used to sanity-check topics (from README + manifest)

- `manifest.json`: `manifest_version: 3`, name "YOLO for ChatGPT", pure JavaScript, permissions limited to `alarms`, `scripting`, `storage`, host access only to `https://chatgpt.com/*`.
- README confirms: local-first, `chrome.storage.local` only, **no runtime dependencies, no build framework, no analytics, no hosted service, no remote code, no telemetry**, and an explicit product boundary ("not an agent platform … no MCP server, no CLI, no coding-agent hooks").
- This means several "avoid" topics from the brief (`mcp`, `cli`, `coding-agent`, `autonomous-agent`, `github-bot`) would be actively **misleading** and are correctly excluded.

### Topic usage / discoverability (GitHub `search/repositories` `topic:` counts)

Measured with `gh api search/repositories -f q="topic:<name>"` (approximate public repo counts; used as a relative discovery signal, not absolute):

| Topic (recommended) | Repo count | Assessment |
| --- | ---: | --- |
| `chatgpt` | ~17,800 | Strong, on-target, curated topic page exists. Keep. |
| `chatgpt-extension` | ~23 | Low volume but **exactly** the product niche and emerging. Precise, not misleading. Keep. |
| `chrome-extension` | ~28,900 | Strong, primary category, curated page. Keep. |
| `browser-extension` | ~7,900 | Strong, accurate (Chromium-wide). Keep. |
| `manifest-v3` | ~2,700 | Accurate (MV3), good technical discovery. Keep. |
| `javascript` | ~652,000 | Accurate (repo is plain JS, no build) but generic; low *marginal* discovery value. Keep — truthful and expected for the stack. |
| `productivity` | ~25,600 | Strong, matches positioning, curated page. Keep. |
| `workflow-automation` | ~5,200 | Strong, matches "bounded workflows". Keep. |
| `prompt-queue` | ~6 | **Effectively unused** — near-zero discovery. Descriptive but dead as a discovery vector. Drop (see Decisions). |
| `local-first` | ~10,100 | Strong, on-brand trust proof. Keep. |
| `privacy` | ~16,400 | Strong, curated page, aligns with no-telemetry. Keep. |
| `open-source` | ~54,700 | Strong, expected. Keep. |
| `developer-tools` | ~44,700 | Strong; justified by the recommended ChatGPT-GitHub coding workflow. Keep. |

Alternatives evaluated (to potentially replace weak topics):

| Candidate | Repo count | Verdict |
| --- | ---: | --- |
| `automation` | ~82,000 | Relevant ("bounded automation"), high volume. **Added** to replace `prompt-queue`. |
| `ai` | ~150,800 | Too generic; risks implying YOLO is an AI/model product (a stated non-goal). Reject. |
| `llm` | ~97,200 | Implies model/LLM tooling; YOLO uses no API/model. Misleading. Reject. |
| `prompt-engineering` | ~13,400 | Plausible but off-center (YOLO queues prompts, it isn't a prompt-engineering toolkit). Reject to avoid dilution. |
| `chatgpt-app` | ~245 | Ambiguous with OpenAI "Apps in ChatGPT"; could imply an official app. Reject. |
| `chatgpt-tools` | ~23 | Redundant with `chatgpt-extension`, vaguer. Reject. |
| `no-telemetry` | ~83 | Nice signal but low volume; already covered by `privacy` + description. Reject (keep topic list focused). |
| `chromium` / `edge-extension` | ~2,100 / ~1,100 | Real but redundant with `browser-extension`; would spend a slot for little gain. Reject. |
| `task-automation` | ~299 | Weaker synonym of `workflow-automation`/`automation`. Reject. |

## Decisions made

1. **Drop `prompt-queue`.** At ~6 repositories it is effectively unused and adds no discoverability. It is descriptive but not a viable discovery vector; the brief explicitly says to remove effectively-unused topics. The concept is still fully conveyed by the description text ("reliable queues") and by `chatgpt-extension` + `workflow-automation`.
2. **Keep `chatgpt-extension` despite low volume (~23).** Unlike `prompt-queue`, it is the precise, emerging category term for this product and is where a motivated user browsing ChatGPT extensions would land. Precision + relevance outweighs raw count here.
3. **Add `automation` (~82k).** Truthful ("bounded automation"), high-volume, replaces the discovery slot vacated by `prompt-queue` without being misleading.
4. **Keep `javascript`.** Generic but accurate for the stack; expected and not misleading.
5. **Exclude all "avoid" topics** (`autonomous-agent`, `github-bot`, `mcp`, `cli`, `coding-agent`, generic AI-agent topics) — each contradicts the documented product boundary.
6. **Never use `yolo` / computer-vision topics** (`yolo`, `yolov5`, `object-detection`). The repo name collides with the popular CV framework; using those topics would be actively misleading. Explicitly avoided.
7. **Description:** the brief's recommended description is accurate, concise, and keyword-complete — adopt it unchanged (validation below).
8. **Website/homepage:** leave blank per brief; it is already blank — no action needed beyond confirming it stays blank when metadata is applied.

## Final description

```
Local-first Chrome extension for reliable queues and bounded workflows in long ChatGPT conversations. Open source, no telemetry.
```

- Length: **128 characters** (GitHub allows up to 350; comfortably within, and short enough to render without truncation in the About sidebar).
- Required keyword coverage — all present: **Chrome extension**, **queues**, **bounded workflows**, **ChatGPT**, **local-first**, **no telemetry**.
- No keyword stuffing; reads as a natural sentence.

## Final topics list (13)

```
chatgpt
chatgpt-extension
chrome-extension
browser-extension
manifest-v3
javascript
productivity
workflow-automation
automation
local-first
privacy
open-source
developer-tools
```

Within the target range of 10–14. Change from the brief's starting set: removed `prompt-queue` (effectively unused), added `automation`.

## Validation performed

- Confirmed current metadata is empty via `gh repo view --json name,description,homepageUrl,repositoryTopics`.
- Pulled per-topic public repo counts via `gh api search/repositories -f q="topic:<name>"` for all 13 recommended topics plus 14 alternative candidates (relative discovery signal).
- Confirmed curated topic pages return HTTP 200 for `chatgpt`, `chrome-extension`, `manifest-v3`, `productivity`, `javascript`, `privacy` (`https://github.com/topics/<name>`).
- Cross-checked every proposed topic against README + `manifest.json` product truth to ensure none contradicts the stated non-goals / product boundary.
- Measured final description length (128 chars) and verified all required keywords are present.

## Risks

- **Name collision with computer-vision YOLO.** Searches for "yolo" are dominated by the object-detection framework. Mitigations: never add `yolo`/CV topics; keep `chatgpt`/`chatgpt-extension` prominent; description leads with "Chrome extension … ChatGPT".
- **`chatgpt-extension` low volume (~23).** Small discovery pool today; acceptable because it is the precise niche and growing. Re-evaluate at next launch review.
- **`javascript` dilution.** Very high volume means little marginal discovery; kept only because it is accurate. Safe to drop later if a more specific slot is wanted.
- **Topic counts are approximate.** GitHub search totals fluctuate and can be rate-limited; treat as relative signals, not exact.
- **Metadata is not applied by this PR.** Committing this report does not change the live repository About section (see next action).

## Recommended next action

The orchestrator (or a maintainer with repo admin) must **apply the metadata to the live repository** — committing files does not update the GitHub About section. If credentials permit, run:

```bash
# Description
gh repo edit kartikkabadi/chatgpt-yolo \
  --description "Local-first Chrome extension for reliable queues and bounded workflows in long ChatGPT conversations. Open source, no telemetry."

# Topics (13)
gh repo edit kartikkabadi/chatgpt-yolo \
  --add-topic chatgpt \
  --add-topic chatgpt-extension \
  --add-topic chrome-extension \
  --add-topic browser-extension \
  --add-topic manifest-v3 \
  --add-topic javascript \
  --add-topic productivity \
  --add-topic workflow-automation \
  --add-topic automation \
  --add-topic local-first \
  --add-topic privacy \
  --add-topic open-source \
  --add-topic developer-tools

# Website/homepage — must remain blank
gh repo edit kartikkabadi/chatgpt-yolo --homepage ""
```

**Manual step (cannot be done by committing files):** setting the description, topics, and homepage is a live-repository metadata change. It can be done with the `gh repo edit` commands above (requires `repo` scope / admin on `kartikkabadi/chatgpt-yolo`) or manually via **Repo → About (gear icon)**. Do **not** change visibility, merge settings, branch protection, issues, discussions, Actions permissions, security settings, repository name, or default branch.

> Note: the repository **social preview / Open Graph image** is a separate metadata field owned by another Wave; it is out of scope for this report and cannot be set by committing a file — it requires **Settings → General → Social preview → Upload**.
