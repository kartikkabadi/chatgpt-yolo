# Changelog

All notable changes are documented here.

## 1.0.0 - release candidate

- Added a persistent, queue-backed command palette and direct slash commands.
- Added bounded `/goal` and `/loop` workflows with per-conversation state, CAS revisions, runner leases, exact delivery identity, response stabilization, and terminal control markers.
- Redesigned the popup and Advanced settings around a task-first Codex/ChatGPT-style interface.
- Added searchable settings navigation, accessible queue actions, explicit template states, destructive confirmations, and reduced-motion behavior.
- Added first-run onboarding, MIT licensing, privacy/security/contribution policy, reproducible packaging, and release automation.
- Added safe settings/template backups and privacy-safe diagnostics; active automation state is deliberately excluded.
- Preserved local-only operation and ChatGPT-only host access.

## 0.7.0

- Added command workflows and reliability hardening.

## 0.6.0

- Replaced the original hard-coded extension with the persistent queue-first architecture.
