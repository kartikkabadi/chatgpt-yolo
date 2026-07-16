from pathlib import Path

root = Path.cwd()

def read(path):
    return (root / path).read_text(encoding="utf-8")

def write(path, content):
    (root / path).write_text(content, encoding="utf-8")

def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))

# Truthful command taxonomy: workflows are implemented by YOLO, prompt shortcuts only
# enqueue instructions, and controls operate on extension state.
replace_once(
    "commands.js",
    '''  const COMMANDS = Object.freeze([
    Object.freeze({ name: "goal", title: "Goal", description: "Start a persistent objective that continues until done, blocked, paused, or capped.", args: "objective", group: "Workflows" }),
    Object.freeze({ name: "loop", title: "Loop", description: "Repeat focused work toward an objective for a bounded number of iterations.", args: "[iterations] objective", group: "Workflows" }),
    Object.freeze({ name: "plan", title: "Plan", description: "Ask ChatGPT to shape a concrete multi-step plan before implementation.", args: "objective", group: "One-shot" }),
    Object.freeze({ name: "review", title: "Review", description: "Run a rigorous review of the current work or a supplied scope.", args: "[scope]", group: "One-shot" }),
    Object.freeze({ name: "fix", title: "Fix", description: "Find concrete defects, repair them, and validate the result.", args: "[scope]", group: "One-shot" }),
    Object.freeze({ name: "compact", title: "Compact", description: "Create a durable context handoff with decisions, state, risks, and next actions.", args: "", group: "One-shot" }),
    Object.freeze({ name: "continue", title: "Continue", description: "Continue the current task deeply without repeating prior work.", args: "", group: "One-shot" }),
    Object.freeze({ name: "status", title: "Status", description: "Show workflow, queue, generation, limits, and last-action state.", args: "", group: "Controls" }),
    Object.freeze({ name: "queue", title: "Queue", description: "Show the current conversation queue and workflow state.", args: "", group: "Controls" }),
    Object.freeze({ name: "pause", title: "Pause", description: "Pause the active goal or loop without clearing it.", args: "", group: "Controls" }),
    Object.freeze({ name: "resume", title: "Resume", description: "Resume the active paused goal or loop.", args: "", group: "Controls" }),
    Object.freeze({ name: "clear", title: "Clear", description: "Clear the active goal or loop after confirmation.", args: "", group: "Controls" }),
    Object.freeze({ name: "settings", title: "Settings", description: "Open YOLO advanced settings.", args: "", group: "Controls" }),
    Object.freeze({ name: "help", title: "Help", description: "Open the command palette and command reference.", args: "", group: "Controls" })
  ]);''',
    '''  const COMMANDS = Object.freeze([
    Object.freeze({ name: "goal", title: "Goal", description: "Start a marker-driven objective that YOLO can continue for bounded turns.", args: "objective", group: "Automated workflows", kind: "workflow" }),
    Object.freeze({ name: "loop", title: "Loop", description: "Run bounded, marker-driven iterations toward one objective.", args: "[iterations] objective", group: "Automated workflows", kind: "workflow" }),
    Object.freeze({ name: "plan", title: "Plan", description: "Queue a prompt asking ChatGPT to produce an execution plan.", args: "objective", group: "Prompt shortcuts", kind: "prompt" }),
    Object.freeze({ name: "review", title: "Review", description: "Queue an adversarial review prompt for the current work or scope.", args: "[scope]", group: "Prompt shortcuts", kind: "prompt" }),
    Object.freeze({ name: "fix", title: "Fix", description: "Queue a prompt asking ChatGPT to diagnose, repair, and validate work.", args: "[scope]", group: "Prompt shortcuts", kind: "prompt" }),
    Object.freeze({ name: "handoff", title: "Handoff", description: "Ask ChatGPT to write a continuation brief; this does not compact ChatGPT context.", args: "[focus]", group: "Prompt shortcuts", kind: "prompt" }),
    Object.freeze({ name: "continue", title: "Continue", description: "Queue a prompt to continue the current task, optionally with a direction.", args: "[direction]", group: "Prompt shortcuts", kind: "prompt" }),
    Object.freeze({ name: "status", title: "Status", description: "Show YOLO workflow, queue, generation, limits, and last-action state.", args: "", group: "YOLO controls", kind: "control" }),
    Object.freeze({ name: "pause", title: "Pause", description: "Pause the active YOLO goal or loop without deleting it.", args: "", group: "YOLO controls", kind: "control" }),
    Object.freeze({ name: "resume", title: "Resume", description: "Resume the active paused or blocked YOLO workflow.", args: "", group: "YOLO controls", kind: "control" }),
    Object.freeze({ name: "stop", title: "Stop", description: "Stop and clear the active YOLO goal or loop after confirmation.", args: "", group: "YOLO controls", kind: "control" }),
    Object.freeze({ name: "settings", title: "Settings", description: "Open YOLO Advanced settings.", args: "", group: "YOLO controls", kind: "control" }),
    Object.freeze({ name: "help", title: "Help", description: "Open the YOLO action palette and reference.", args: "", group: "YOLO controls", kind: "control" })
  ]);'''
)

replace_once(
    "commands.js",
    '''      "End with [YOLO:DONE] if the objective is complete, [YOLO:BLOCKED] if user input is required, or [YOLO:CONTINUE] when another iteration would help. A missing marker is treated as continue in Loop mode."''',
    '''      "At the very end, emit exactly one marker on its own line: [YOLO:DONE] if complete, [YOLO:BLOCKED] if user input is required, or [YOLO:CONTINUE] when another iteration would help. Missing or malformed markers pause the loop."'''
)
replace_once(
    "commands.js",
    '''      "End with [YOLO:DONE], [YOLO:BLOCKED], or [YOLO:CONTINUE]. A missing marker is treated as continue."''',
    '''      "At the very end, emit exactly one marker on its own line: [YOLO:DONE], [YOLO:BLOCKED], or [YOLO:CONTINUE]. Missing or malformed markers pause the loop."'''
)
replace_once(
    "commands.js",
    '''    if (workflow.kind === "goal" && outcome === "missing") {
      return {
        workflow,
        action: "paused",
        reason: "Goal response omitted the required terminal control marker",
        code: "command.goal.marker_missing"
      };
    }''',
    '''    if (outcome === "missing") {
      const label = workflow.kind === "goal" ? "Goal" : "Loop";
      return {
        workflow,
        action: "paused",
        reason: `${label} response omitted the required terminal control marker`,
        code: "command.workflow.marker_missing"
      };
    }'''
)
replace_once(
    "commands.js",
    '''    if (name === "compact") {
      return "Create a durable context handoff for this conversation. Preserve the objective, decisions, constraints, completed work, exact current state, unresolved defects, risks, relevant identifiers, validation evidence, and next actions. Remove repetition and incidental discussion. Write it so another strong agent can continue immediately without guessing.";
    }
    if (name === "continue") {
      return "Continue from the current state and keep going deeper. Do not repeat the previous answer. Critically inspect assumptions, close gaps, execute the next concrete steps toward the original objective, and validate the result.";
    }''',
    '''    if (name === "handoff") {
      return [
        scope ? `Handoff focus: ${scope}` : "Write a continuation handoff for the current work.",
        "Summarize the objective, decisions, constraints, completed work, exact current state, unresolved defects, risks, relevant identifiers, validation evidence, and next actions. Remove incidental repetition. This is a written handoff only; do not claim that ChatGPT context was compacted, truncated, or changed."
      ].join("\\n\\n");
    }
    if (name === "continue") {
      return [
        scope ? `Continue with this direction: ${scope}` : "Continue from the current state and keep going deeper.",
        "Do not repeat the previous answer. Critically inspect assumptions, close gaps, execute the next concrete steps toward the original objective, and validate the result."
      ].join("\\n\\n");
    }'''
)

# Runtime dispatch mirrors the truthful catalog.
replace_once(
    "command-runtime.js",
    '''    if (["plan", "review", "fix", "compact", "continue"].includes(name)) return runOneShot(name, args);
    if (name === "status" || name === "queue") return showStatus();''',
    '''    if (["plan", "review", "fix", "handoff", "continue"].includes(name)) return runOneShot(name, args);
    if (name === "status") return showStatus();'''
)
replace_once("command-runtime.js", '''    if (name === "clear") {''', '''    if (name === "stop") {''')
replace_once(
    "command-runtime.js",
    '''      if (!window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) return { ok: false, reason: "Workflow kept", keepOpen: true };''',
    '''      if (!window.confirm(`Stop and clear the active ${state.workflow.kind} workflow?`)) return { ok: false, reason: "Workflow kept", keepOpen: true };'''
)
replace_once(
    "command-runtime.js",
    '''      if (ok) await record(cancelled.reason || "Cleared command workflow", "info", "command.workflow.cleared");''',
    '''      if (ok) await record(cancelled.reason || "Stopped and cleared command workflow", "info", "command.workflow.stopped");'''
)

# Public documentation says what YOLO implements and what is only a queued prompt.
replace_once(
    "README.md",
    '''2. **Composer-native commands** such as `/goal`, `/loop`, `/plan`, and `/review`.''',
    '''2. **Composer-native YOLO actions**: automated workflows, prompt shortcuts, and extension controls.'''
)
replace_once(
    "README.md",
    '''- `/plan`, `/review`, `/fix`, `/compact`, and `/continue` one-shot commands.
- `/status`, `/queue`, `/pause`, `/resume`, `/clear`, `/settings`, and `/help` controls.''',
    '''- `/plan`, `/review`, `/fix`, `/handoff`, and `/continue` prompt shortcuts.
- `/status`, `/pause`, `/resume`, `/stop`, `/settings`, and `/help` YOLO controls.'''
)
replace_once(
    "README.md",
    '''## Commands

| Command | Purpose |
| --- | --- |
| `/goal <objective>` | Run a persistent objective. ChatGPT must finish each turn with `[YOLO:CONTINUE]`, `[YOLO:DONE]`, or `[YOLO:BLOCKED]`. |
| `/loop [count] <objective>` | Continue iteratively for a bounded number of turns. |
| `/plan <task>` | Ask ChatGPT to inspect context and produce an execution plan. |
| `/review <scope>` | Perform an adversarial review before changing more work. |
| `/fix <problem>` | Diagnose, fix, validate, and summarize a concrete problem. |
| `/compact [focus]` | Produce a compact handoff that preserves decisions and next actions. |
| `/continue [direction]` | Continue the current task without repeating earlier commentary. |
| `/status` or `/queue` | Show workflow, queue, runner, generation, profile, and limit state. |
| `/pause`, `/resume`, `/clear` | Control the active goal or loop. |
| `/settings`, `/help` | Open settings or the command palette. |

Only standalone terminal workflow markers control `/goal`. Inline marker-shaped text is ignored.''',
    '''## Slash actions

These are **YOLO extension actions**, not native ChatGPT or Codex commands. Automated workflows are implemented by YOLO. Prompt shortcuts simply turn an action into a visible queued prompt; they do not unlock hidden ChatGPT capabilities or modify ChatGPT's context window.

### Automated workflows

| Action | Purpose |
| --- | --- |
| `/goal <objective>` | Run a bounded persistent objective. Every turn must end with `[YOLO:CONTINUE]`, `[YOLO:DONE]`, or `[YOLO:BLOCKED]`. |
| `/loop [count] <objective>` | Run bounded iterations. Missing or malformed terminal markers pause the loop instead of guessing. |

### Prompt shortcuts

| Action | Purpose |
| --- | --- |
| `/plan <task>` | Queue a prompt asking ChatGPT to produce an execution plan. |
| `/review [scope]` | Queue an adversarial review prompt. |
| `/fix [scope]` | Queue a diagnose, repair, and validate prompt. |
| `/handoff [focus]` | Queue a prompt asking ChatGPT to write a continuation brief. It does **not** compact or alter ChatGPT context. |
| `/continue [direction]` | Queue a prompt to continue the current task with an optional direction. |

### YOLO controls

| Action | Purpose |
| --- | --- |
| `/status` | Show workflow, queue, runner, generation, profile, limits, and last action. |
| `/pause`, `/resume`, `/stop` | Pause, resume, or stop and clear the active workflow. |
| `/settings`, `/help` | Open Advanced settings or the action palette. |

Only standalone terminal markers control automated workflows. Inline marker-shaped text is ignored.'''
)

replace_once(
    "CHANGELOG.md",
    '''- Added a persistent, queue-backed command palette and direct slash commands.''',
    '''- Added a persistent, queue-backed slash-action palette with explicit workflow, prompt-shortcut, and YOLO-control categories.'''
)
replace_once(
    "CHANGELOG.md",
    '''- Added bounded `/goal` and `/loop` workflows with per-conversation state, CAS revisions, runner leases, exact delivery identity, response stabilization, and terminal control markers.''',
    '''- Added bounded `/goal` and `/loop` workflows with per-conversation state, CAS revisions, runner leases, exact delivery identity, response stabilization, and required terminal control markers.
- Replaced misleading `/compact`, `/queue`, and `/clear` actions with truthful `/handoff`, `/status`, and `/stop` semantics.'''
)

# Regression tests pin the product-sense contract.
replace_once(
    "tests/commands.test.js",
    '''test("filters and parses the composer command catalog", () => {
  assert.equal(Commands.filterCommands("rev")[0].name, "review");
  assert.equal(Commands.parseInvocation("/goal ship the extension").command.name, "goal");
  assert.equal(Commands.parseInvocation("/goal ship the extension").args, "ship the extension");
  assert.equal(Commands.parseInvocation("hello"), null);
  assert.equal(Commands.parseInvocation("/unknown"), null);
});''',
    '''test("filters and parses the truthful slash-action catalog", () => {
  assert.equal(Commands.filterCommands("rev")[0].name, "review");
  assert.equal(Commands.parseInvocation("/goal ship the extension").command.name, "goal");
  assert.equal(Commands.parseInvocation("/goal ship the extension").args, "ship the extension");
  assert.equal(Commands.parseInvocation("hello"), null);
  assert.equal(Commands.parseInvocation("/unknown"), null);
  assert.equal(Commands.parseInvocation("/compact"), null);
  assert.equal(Commands.parseInvocation("/queue"), null);
  assert.equal(Commands.parseInvocation("/clear"), null);

  assert.deepEqual(Commands.COMMANDS.map(({ name, kind }) => [name, kind]), [
    ["goal", "workflow"], ["loop", "workflow"],
    ["plan", "prompt"], ["review", "prompt"], ["fix", "prompt"], ["handoff", "prompt"], ["continue", "prompt"],
    ["status", "control"], ["pause", "control"], ["resume", "control"], ["stop", "control"], ["settings", "control"], ["help", "control"]
  ]);
});'''
)
replace_once(
    "tests/commands.test.js",
    '''  assert.match(Commands.oneShotPrompt("compact"), /durable context handoff/i);
  assert.equal(Commands.oneShotPrompt("plan", ""), "");''',
    '''  assert.match(Commands.oneShotPrompt("handoff", "release state"), /Handoff focus: release state/);
  assert.match(Commands.oneShotPrompt("handoff"), /does not claim that ChatGPT context was compacted/i);
  assert.match(Commands.oneShotPrompt("continue", "fix the tests"), /Continue with this direction: fix the tests/);
  assert.equal(Commands.oneShotPrompt("compact"), "");
  assert.equal(Commands.oneShotPrompt("plan", ""), "");'''
)
write("tests/commands.test.js", read("tests/commands.test.js").rstrip() + r'''

test("both automated workflows pause when the terminal marker is missing", () => {
  for (const kind of ["goal", "loop"]) {
    const workflow = Commands.normalizeWorkflow({
      kind,
      objective: "ship",
      status: "running",
      awaitingResponse: true,
      promptFingerprint: "owned"
    }, 1000);
    const decision = Commands.decideWorkflowResponse(workflow, "work without a terminal marker", {
      userFingerprint: "owned",
      at: 1100
    });
    assert.equal(decision.action, "paused");
    assert.equal(decision.code, "command.workflow.marker_missing");
  }
});
''')

write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + r'''

test("slash actions expose only viable product semantics", () => {
  const commands = read("commands.js");
  const runtime = read("command-runtime.js");
  const readme = read("README.md");
  assert.doesNotMatch(commands, /name: "compact"|name: "queue"|name: "clear"/);
  assert.match(commands, /name: "handoff"[\s\S]*kind: "prompt"/);
  assert.match(commands, /name: "stop"[\s\S]*kind: "control"/);
  assert.match(runtime, /\["plan", "review", "fix", "handoff", "continue"\]/);
  assert.doesNotMatch(runtime, /name === "queue"|name === "clear"|"compact"/);
  assert.match(readme, /not native ChatGPT or Codex commands/i);
  assert.match(readme, /does \*\*not\*\* compact or alter ChatGPT context/i);
});
''')

# The obsolete command names must not remain in user-facing/runtime command files.
for path in ["commands.js", "command-runtime.js", "README.md", "tests/commands.test.js", "tests/ui.test.js"]:
    content = read(path)
    if path not in ["tests/commands.test.js", "tests/ui.test.js"]:
      for token in ["/compact", "/queue", "/clear"]:
        if token in content:
          raise RuntimeError(f"Obsolete action remains in {path}: {token}")

print("Command viability corrections applied")
