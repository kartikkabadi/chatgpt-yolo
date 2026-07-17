## Problem

<!-- What concrete user or reliability problem does this solve? -->

## Change

<!-- Describe the smallest implementation that solves it. -->

## Verification

- [ ] `npm run validate:core`
- [ ] `npm run validate:assets` (when changing marketing assets)
- [ ] `npm run package`
- [ ] Loaded `dist/yolo` as an unpacked extension
- [ ] Tested on a saved ChatGPT conversation (`/c/...`)
- [ ] Tested pause/recovery or failure behavior affected by this change
- [ ] Added or updated regression tests

## Extension boundary

- [ ] No new host, optional, or sensitive browser permissions
- [ ] No remote code, analytics, backend, CLI, daemon, native messaging, or agent integration
- [ ] No conversation text or identifiers added to diagnostics
- [ ] Queue mutations remain background-owned and fail closed
- [ ] Draft protection and durable conversation scoping remain intact

## User-facing evidence

<!-- Add screenshots for UI changes and describe any migration or compatibility risk. -->
