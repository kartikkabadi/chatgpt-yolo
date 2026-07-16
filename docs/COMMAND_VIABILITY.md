# Command viability

YOLO command names must describe behavior the extension actually provides. The command palette is an extension interface, not a list of undocumented ChatGPT or Codex capabilities.

## Command classes

### Automated workflows

- `/goal <objective>`
- `/loop [iterations] <objective>`

These commands create YOLO-owned local workflow state and queue follow-up prompts. Every automated response must end with exactly one standalone `[YOLO:CONTINUE]`, `[YOLO:DONE]`, or `[YOLO:BLOCKED]` marker.

Missing or malformed markers pause the workflow without consuming a Loop iteration. YOLO never interprets a missing marker as permission to continue.

### Prompt shortcuts

- `/plan <objective>`
- `/review [scope]`
- `/fix [scope]`
- `/handoff [focus]`
- `/continue [direction]`

These commands generate ordinary text and place it in YOLO's queue. They do not:

- Activate hidden ChatGPT modes.
- Compact, delete, or otherwise alter ChatGPT's server-side context.
- Change the model or context-window size.
- Grant tools, permissions, or external-system access.
- Guarantee that ChatGPT can modify a repository, file, browser, or account.

`/handoff` creates a written summary for another person or agent. The optional focus is included in that prompt. `/continue` similarly includes its optional direction.

### YOLO controls

- `/status`
- `/pause`
- `/resume`
- `/stop`
- `/settings`
- `/help`

These operate only on YOLO's local queue, workflow, and interface state.

## Removed public commands

- `/compact` was misleading because YOLO cannot compact ChatGPT's context. `/handoff` accurately describes the actual written-summary behavior.
- `/queue` duplicated `/status`. Queue manipulation remains visible in the popup.
- `/clear` was ambiguous about whether it removed a workflow, queue, or conversation. `/stop` explicitly stops and clears only the active YOLO workflow.

## Compatibility boundary

The stable internal runtime predates these public names. A narrow compatibility layer translates `/handoff` to the existing summary action and `/stop` to the existing workflow-removal action. Those legacy identifiers are private implementation details: they are absent from public parsing, command filtering, palette results, and documentation.

## Acceptance test for new commands

A proposed command should be rejected unless all of the following are true:

1. Its name describes observable behavior YOLO can implement or guarantee.
2. The owner of the behavior is clear: ChatGPT prompt, YOLO workflow, or YOLO control.
3. Failure behavior is explicit and fail-closed where automation is involved.
4. Arguments have a real effect or are removed from the usage string.
5. It does not duplicate an existing command or visible UI action without a strong reason.
6. The README, palette copy, parser, direct invocation, fallback injection, package, and tests all agree.
