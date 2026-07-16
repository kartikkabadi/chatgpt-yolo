# Security policy

## Supported versions

Security fixes are provided for the latest released version and the current `main` branch.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose data, cause unintended ChatGPT actions, weaken approval classification, or bypass queue/workflow safety limits.

Use GitHub’s **Report a vulnerability** / private security advisory flow for this repository. Include:

- Affected version or commit.
- Browser and operating system.
- Reproduction steps.
- Expected and actual behavior.
- Security impact and whether the issue requires user interaction.

Please avoid accessing anyone else’s conversations or data while testing.

## Security boundaries

YOLO is a browser extension, not a sandbox. When enabled, it can write to the ChatGPT composer and click narrowly classified controls on ChatGPT. Safe defaults, limits, draft protection, route identity, and fail-closed delivery are security controls and must not be weakened for convenience.

YOLO contains no remote code or update channel outside the browser’s extension mechanism.
