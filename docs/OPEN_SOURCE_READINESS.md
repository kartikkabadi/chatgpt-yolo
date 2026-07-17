# Open-source readiness gate

YOLO should become public only when the repository, packaged extension, and support process are ready for strangers—not merely when the source is visible.

## Product boundary

- [x] Manifest V3 browser extension only
- [x] ChatGPT-only host access
- [x] No backend, telemetry, remote code, native messaging, CLI, daemon, or agent integration
- [x] No filesystem, Git, credential-store, cookie, history, debugger, or broad-tab access
- [x] Automation disabled by default
- [x] Automatic approvals disabled by default
- [x] Bounded queues, retries, workflow iterations, active conversations, history, and action rates

## Trust and privacy

- [x] Privacy policy describes every locally stored data class
- [x] Diagnostics exclude prompts, queue text, templates, objectives, conversation identifiers, and error prose
- [x] Backups exclude active queues, goals, claims, retries, counters, and messages
- [x] Draft text is never overwritten
- [x] Ambiguous delivery fails closed
- [x] Permission grants, account access, arbitrary command execution, and destructive approvals require the explicit `all` policy
- [x] Security reports have a private advisory path
- [ ] Complete a final manual review of Chrome Web Store disclosures against the exact release package

## Reliability

- [x] Queue mutations are serialized and background-owned
- [x] Submission intent is persisted before composer interaction
- [x] Successful delivery requires an exact new matching user message
- [x] Workflow prompt delivery and awaiting-response state commit atomically
- [x] Cross-tab queue senders, workflow runners, and side effects use leases
- [x] Workflow terminal markers are strict and fail closed
- [x] Only saved `/c/...` conversations own durable automation
- [x] Workflow-owned queue prompts cannot be silently changed by queue controls
- [x] Settings/import/diagnostics use one resolved durable conversation
- [x] Storage collections and retained histories are bounded
- [ ] Run the full automated test suite on Node 20 and Node 24 from the exact release head
- [ ] Complete the current-Chromium unpacked-extension smoke checklist
- [ ] Complete a multi-tab overnight soak test against the live ChatGPT interface

## Release engineering

- [x] Runtime package uses an explicit allowlist
- [x] Manifest/package/config versions must match
- [x] Release archives normalize timestamps and file order
- [x] Release includes a SHA-256 checksum
- [x] Tag/version mismatch fails publication
- [x] Current official GitHub Actions majors are used
- [ ] Restore GitHub-hosted Actions execution; current jobs terminate before recording any step or log
- [ ] Produce and inspect the exact release artifact
- [ ] Verify two clean builds of the same commit produce the same archive checksum
- [ ] Publish a prerelease before a stable release

## Repository hygiene

- [x] MIT license, notice, privacy policy, security policy, support policy, code of conduct, and contribution guide
- [x] CODEOWNERS and pull-request checklist
- [x] Structured bug and feature request forms
- [x] Product direction and explicit non-goals
- [x] Historical PR invariant audit
- [x] No open agent/review-bridge issues misrepresent the product scope
- [ ] Add current screenshots and a short demo captured from the verified release build
- [ ] Prepare a concise public launch post and troubleshooting response template

## Public-beta threshold

A GitHub prerelease is ready when every unchecked **Reliability** and **Release engineering** item above has direct evidence, except Chrome Web Store-specific disclosure work.

A Chrome Web Store submission is ready only after the public prerelease has real users, no unresolved data-loss or duplicate-delivery defects, a current terms/policy review, complete store disclosures, and a documented process for responding to ChatGPT selector changes.

Do not replace missing evidence with confidence language. Record the browser version, operating system, commit SHA, package checksum, and test result for every release candidate.
