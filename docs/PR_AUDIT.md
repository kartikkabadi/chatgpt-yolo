# Historical pull-request audit

This document records the production-readiness review of the repository's earlier pull requests. It is an invariant map, not a substitute for reading the code or current tests.

## Audit method

For each merged product PR, the review traced its stated outcome into the current runtime, storage model, tests, package allowlist, permissions, and user interface. A feature was considered preserved only when its current implementation and failure behavior matched the original claim.

Superseded or abandoned PRs were checked for leftover runtime files, permissions, documentation claims, and storage formats. Their implementation is not treated as current product behavior.

## Merged PRs

| PR | Original layer | Current disposition | Hardening performed in PR #24 |
| --- | --- | --- | --- |
| #1 | Initial extension foundation | Retained as the dependency-free Manifest V3 baseline. | Rechecked host/permission boundaries, package allowlist, sender/page binding, and fail-closed settings behavior. |
| #2 | Persistent per-conversation queue | Retained as the primary product surface. | Protected workflow-owned prompts from edit/retry/reorder/bulk-clear operations; kept settings/templates reachable outside ChatGPT; surfaced queue-management failures. |
| #5 | Integrated queue, controls, settings, and UI | Retained, with the popup remaining a focused control surface rather than a second workspace. | Corrected unavailable-tab behavior, durable conversation selection, and workflow ownership states in the popup. |
| #12 | Settings/template backups and diagnostics | Retained. Active queue/workflow text remains excluded. | Fixed diagnostics to read the actual content-state shape and fixed import/diagnostic routing to the conversation resolved by Advanced settings. |
| #13 | Truthful slash commands and bounded workflows | Retained. Commands remain extension actions, not hidden ChatGPT capabilities. | Contradictory, duplicate, or misplaced terminal markers now pause rather than advancing or completing a workflow. |
| #14 | CI, CodeQL, package, and release automation | Workflow definitions remain current and narrowly permissioned. | Rechecked current official action majors and artifact boundaries. GitHub-hosted jobs still fail before recording a step or log; this is tracked as an external release blocker rather than misrepresented as passing validation. |
| #15 | Fail-closed queue delivery and exact receipts | Retained and strengthened. | Removed synthetic Enter submission fallback; made workflow queue receipt + awaiting-response state one atomic storage write; made recovery trust authoritative background state. |
| #16 | Shared portable-data transactions | Retained. | Prevented conversation settings from overwriting hidden global defaults; made template retries idempotent at capacity; made corrupt template IDs deterministic; kept import application separate from live runtime persistence. |
| #17 | Overnight/multi-tab lifecycle reliability | Retained. | Rechecked hydration, generation quiet periods, tab supervision, workflow leases, route identity, and hidden-tab cadence against the newer queue/workflow invariants. |
| #23 | Public extension boundary and open-source hygiene | Retained exactly. | No daemon, CLI, agent integration, native messaging, backend, remote code, telemetry, filesystem access, or additional host permissions were introduced. |

## Superseded and abandoned PRs

PRs #3, #4, #6, and #11 were superseded or closed without becoming the canonical product direction. Their ideas are not considered shipped merely because commits or discussion once existed.

The audit confirmed that the current runtime package does not include the later-abandoned local review bridge, coding-agent adapters, companion CLI, agent dispatch, review workspace, or autonomous repair loop. Those concepts remain outside the core extension boundary.

## Current enforced invariants

The following rules now have focused regression coverage:

- a queued message is complete only after the exact matching user message is observed
- ambiguous delivery becomes a terminal manual-recovery state
- workflow prompt delivery and the awaiting-response transition commit atomically
- a workflow prompt cannot be silently edited, retried, reordered, or bulk-cleared from the queue UI/state machine
- contradictory or non-terminal workflow markers never advance the workflow
- only saved `/c/...` conversations own durable automation state
- sender-backed queue, workflow, action, and settings mutations must match the sender's conversation
- completed workflows do not consume active workflow capacity, and completed history is bounded
- template mutation retries remain idempotent even at storage capacity
- backup/import operations exclude live queue/workflow state and use the resolved current conversation
- diagnostics exclude conversation identifiers and user-authored content while reporting real hydration/blocking state
- automatic approvals remain off by default; permission grants, account access, arbitrary command execution, and destructive actions require the explicit `all` policy
- runtime packaging remains dependency-free, local-only, and ChatGPT-only

## Remaining release blockers

Before a public release is called verified:

1. GitHub Actions must execute real runner steps and expose logs again.
2. The packaged extension must pass the manual current-Chromium smoke checklist in `docs/RELEASING.md` against the live ChatGPT interface.
3. The exact release head must receive a final changed-file review with no unresolved threads.
4. Store/distribution claims must remain consistent with the current ChatGPT interface and applicable service terms.

No document or badge should imply these checks passed until there is direct evidence.
