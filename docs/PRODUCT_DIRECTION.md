# Product direction

## One-sentence product

YOLO is a local-first Chrome extension for reliably queueing and running bounded instructions inside long ChatGPT conversations.

## The problem

ChatGPT is useful for long, iterative work, but the web interface is designed around one prompt at a time. Users who work in long conversations repeatedly need to:

- remember and send the next instruction
- continue after a long response or recoverable error
- keep work bounded instead of starting an uncontrolled loop
- avoid replacing a draft or sending the same instruction twice
- understand what is queued, running, paused, or blocked

YOLO turns those repeated manual actions into an inspectable, fail-closed queue and workflow layer.

## Product principles

1. **Extension, not platform.** The product lives in the browser and improves the existing ChatGPT experience.
2. **Reliability before autonomy.** Exact delivery, draft protection, bounded retries, and clear recovery matter more than adding more automatic behavior.
3. **Local by default.** No hosted backend, telemetry, remote code, or external account system.
4. **Progressive disclosure.** Queue and status are easy to reach; advanced timing and safety controls stay out of the default path.
5. **Fail closed.** When delivery or state is ambiguous, pause and ask the user rather than guessing.
6. **One supported site.** ChatGPT is the only host surface until another site can meet the same reliability and maintenance standard.

## Deliberate non-goals

The core project will not include:

- coding-agent adapters or hooks
- a local companion daemon, CLI, MCP server, or native-messaging host
- local repository, filesystem, terminal, Git, or credential access
- automatic code review, repair, merge, deployment, or agent orchestration
- a hosted YOLO backend or subscription account system
- broad browser permissions or support for arbitrary websites
- hidden prompts, invisible actions, or unbounded loops

Related experiments should live in separate repositories so the extension remains understandable and auditable.

## Near-term roadmap

### 1. Reliability

- keep selectors compatible with the live ChatGPT interface
- expand regression coverage for queue claims, route changes, hydration, recovery, and multi-tab ownership
- improve diagnostics without collecting conversation content
- make release smoke testing repeatable

### 2. Simplicity

- reduce the everyday popup to queue, current status, pause/resume, and settings
- improve empty, blocked, retry, and stale-tab states
- keep keyboard and screen-reader use first-class
- preserve a no-build, no-runtime-dependency architecture

### 3. Distribution

- publish signed, reproducible GitHub release archives
- run a small public beta before considering Chrome Web Store distribution
- document current browser compatibility and known ChatGPT UI breakage quickly
- use issues and discussions to learn which workflows users repeat most often

## Success measures

The useful metrics are product outcomes, not feature count:

- a new user can install and queue a first instruction without assistance
- queued instructions are not duplicated or silently lost
- ambiguous states pause instead of producing unintended actions
- most users stay on Safe or Balanced defaults
- selector regressions are detected and repaired quickly
- users return because the queue removes repeated work, not because the product adds complexity
