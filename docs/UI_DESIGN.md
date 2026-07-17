# UI design contract

This branch redesigns YOLO's popup and Advanced settings surfaces without changing queue semantics, automation policy, or background ownership.

## Product principles

1. **Task first.** The popup prioritizes current state, composing, and the queue. Secondary metrics and administration stay visually quiet.
2. **Progressive disclosure.** Advanced capability remains available, but controls are grouped and searchable instead of presented as one continuous form.
3. **Calm hierarchy.** Neutral surfaces, restrained contrast, one primary action, compact status, and consistent spacing replace dashboard-like boxes of equal weight.
4. **State is explicit.** Enabled/disabled, running/paused, blocked, saving, failed, and destructive states must be understandable without color alone.
5. **Keyboard and screen-reader complete.** Focus order, labels, live status, navigation state, and reduced-motion behavior are part of the design, not follow-up polish.
6. **No hidden behavior changes.** Visual simplification must not silently remove or reinterpret any existing automation setting.

## Popup information architecture

- Product header with current conversation and automation master switch.
- Compact operating-state row with profile and queue count.
- One focused message composer with template selection and a single dominant queue action.
- Queue workspace with readable items, state badges, contextual item actions, pause/resume, send-next, and clear.
- Collapsible activity and limits disclosure.
- Clear route to Advanced settings.

## Advanced settings information architecture

- Sticky workspace header with conversation scope and save state.
- Persistent section navigation with search.
- Sections for Overview, Queue, Approvals, Recovery, Nudges, Refresh, Safety, Templates, and Data.
- Descriptive setting rows grouped into focused cards.
- Templates as a dedicated workspace rather than an attachment to the settings form.
- Defaults, runtime reset, and other destructive actions isolated in a clearly labeled Data section.

## Visual system

- Native system typography.
- Neutral near-black/near-white canvas with layered surfaces.
- Subtle one-pixel borders and restrained shadows.
- 8px spacing rhythm; 10–14px radii depending on hierarchy.
- One monochrome primary action; semantic color only for success, warning, and danger state.
- Minimum 36px pointer targets and visible focus rings.
- Responsive Advanced settings layout that collapses navigation on narrow windows.

## Acceptance criteria

- Every existing configurable key remains represented in Advanced settings.
- Popup primary path is understandable without expanding Activity.
- Section search filters navigation and visible setting groups.
- Save state remains visible while scrolling.
- Current section is reflected through `aria-current`.
- All dynamic status messages use live-region semantics.
- External scripts only; no inline event handlers.
- Existing queue, popup startup, options startup, manifest, and safety tests remain green.
- New static and startup tests cover hierarchy, navigation, search, focus/accessibility, and responsive structure.
