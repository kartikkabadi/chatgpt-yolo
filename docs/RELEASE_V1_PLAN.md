# YOLO v1 release contract

YOLO v1 is the integrated, public release of the reviewed command/workflow engine and the reviewed premium interface.

## Dependency graph

- Base: PR #3 (`feature/codex-command-workflows`) at its reviewed exact head.
- Port: PR #4 (`design/codex-premium-ui`) visual and interaction changes.
- Preserve: PR #3 command scripts, workflow runtime, full fallback injection stack, queue ownership, safety policy, and tests.
- Add: open-source licensing, contributor/security/privacy policy, onboarding, packaging, release automation, and public installation/support documentation.

## Release bar

- No unlicensed source distribution.
- No remote code, telemetry, analytics, tracking, or external service dependency.
- Host access limited to ChatGPT.
- Every requested extension permission documented.
- One obvious first-run path and one obvious everyday path.
- Reproducible source package containing only runtime files.
- Complete syntax/test/manifest/package checks in CI.
- Manual unpacked-extension smoke checklist retained for the unstable ChatGPT DOM boundary.
- No merge until the integration PR is CI-green, externally reviewed, and all valid findings are fixed.
