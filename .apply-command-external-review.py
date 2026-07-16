from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:140]!r}")
    write(path, content.replace(old, new))


# /loop 0 is an explicit bound and must clamp to one, not silently expand to 12.
replace_once(
    "commands.js",
    '''      maxIterations: clamp(Math.round(Number(match[1])) || DEFAULT_MAX_ITERATIONS, 1, MAX_ITERATIONS)''',
    '''      maxIterations: clamp(Math.round(Number(match[1])), 1, MAX_ITERATIONS)''',
)

# Workflow markers must be standalone terminal lines. Inline text ending with a
# marker-shaped substring cannot control the state machine.
replace_once(
    "commands.js",
    '''  const MARKER_RE = /\[YOLO:(CONTINUE|DONE|BLOCKED)\]\s*$/i;''',
    '''  const MARKER_RE = /(?:^|\n)\[YOLO:(CONTINUE|DONE|BLOCKED)\][ \t]*$/i;''',
)

# Preserve response line boundaries only for chat messages; compact DOM text
# normalization remains unchanged for buttons, cards, and error classification.
replace_once(
    "platforms.js",
    '''  function latestMessageText(selectors, documentLike = document) {
    const candidates = uniqueElements((Array.isArray(selectors) ? selectors : [])
      .flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return normalizedText(candidates.at(-1));
  }''',
    '''  function normalizedMultilineText(element) {
    return String(element?.innerText || element?.textContent || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function latestMessageText(selectors, documentLike = document) {
    const candidates = uniqueElements((Array.isArray(selectors) ? selectors : [])
      .flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return normalizedMultilineText(candidates.at(-1));
  }''',
)

# A pending prompt that has entered sending cannot be cancelled. Preserve its
# identity and refuse pause/clear rather than creating an untracked delivery.
replace_once(
    "command-runtime.js",
    '''      const cancelled = await cancelPendingWorkflowPrompt(state.workflow);
      if (!cancelled.ok) return { ok: false, reason: cancelled.reason, keepOpen: true };
      if (cancelled.reason) reason = `${reason}. ${cancelled.reason}`;''',
    '''      const cancelled = await cancelPendingWorkflowPrompt(state.workflow);
      if (!cancelled.ok || (state.workflow.pendingItemId && !cancelled.removed)) {
        return { ok: false, reason: cancelled.reason || "The workflow prompt is already sending", keepOpen: true };
      }
      if (cancelled.reason) reason = `${reason}. ${cancelled.reason}`;''',
)
replace_once(
    "command-runtime.js",
    '''      const cancelled = await cancelPendingWorkflowPrompt(state.workflow);
      if (!cancelled.ok) return { ok: false, reason: cancelled.reason, keepOpen: true };
      const ok = await clearWorkflow();''',
    '''      const cancelled = await cancelPendingWorkflowPrompt(state.workflow);
      if (!cancelled.ok || (state.workflow.pendingItemId && !cancelled.removed)) {
        return { ok: false, reason: cancelled.reason || "The workflow prompt is already sending", keepOpen: true };
      }
      const ok = await clearWorkflow();''',
)

# Command palette follows the ARIA combobox/listbox active-option pattern.
replace_once(
    "command-ui.js",
    '''    search.setAttribute("aria-label", "Filter YOLO commands");
    search.placeholder = "Type a command";''',
    '''    search.setAttribute("aria-label", "Filter YOLO commands");
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-controls", "yolo-command-list");
    search.setAttribute("aria-expanded", "false");
    search.placeholder = "Type a command";''',
)
replace_once(
    "command-ui.js",
    '''    const list = element("div", "list");
    list.setAttribute("role", "listbox");''',
    '''    const list = element("div", "list");
    list.id = "yolo-command-list";
    list.setAttribute("role", "listbox");''',
)
replace_once(
    "command-ui.js",
    '''      if (!results.length) {
        list.appendChild(element("div", "empty", "No matching YOLO command"));
        return;
      }
      results.forEach((entry, index) => {
        const button = element("button", "item");
        button.type = "button";
        button.setAttribute("role", "option");''',
    '''      if (!results.length) {
        search.removeAttribute("aria-activedescendant");
        list.appendChild(element("div", "empty", "No matching YOLO command"));
        return;
      }
      const selectedId = `yolo-command-option-${results[selectedIndex].name}`;
      search.setAttribute("aria-activedescendant", selectedId);
      results.forEach((entry, index) => {
        const button = element("button", "item");
        button.id = `yolo-command-option-${entry.name}`;
        button.type = "button";
        button.setAttribute("role", "option");''',
)
replace_once(
    "command-ui.js",
    '''      palette.dataset.open = "true";
      argumentCommand = null;''',
    '''      palette.dataset.open = "true";
      search.setAttribute("aria-expanded", "true");
      argumentCommand = null;''',
)
replace_once(
    "command-ui.js",
    '''      palette.dataset.open = "false";
      resetPalette();
      if (restoreComposer)''',
    '''      palette.dataset.open = "false";
      search.setAttribute("aria-expanded", "false");
      resetPalette();
      search.removeAttribute("aria-activedescendant");
      if (restoreComposer)''',
)

# Recalculate every workflow-bar action after asynchronous operations finish.
replace_once(
    "command-ui.js",
    '''      pauseButton.textContent = ["paused", "blocked"].includes(currentWorkflow.status) ? "Resume" : "Pause";
      pauseButton.disabled = !["running", "paused", "blocked"].includes(currentWorkflow.status);
      editButton.disabled = !["running", "paused", "blocked"].includes(currentWorkflow.status);
      position();''',
    '''      pauseButton.textContent = ["paused", "blocked"].includes(currentWorkflow.status) ? "Resume" : "Pause";
      const actionable = ["running", "paused", "blocked"].includes(currentWorkflow.status);
      pauseButton.disabled = workflowActionInFlight || !actionable;
      editButton.disabled = workflowActionInFlight || !actionable;
      clearButton.disabled = workflowActionInFlight;
      position();''',
)

# Regression coverage for all accepted reviewer findings.
replace_once(
    "tests/commands.test.js",
    '''  assert.equal(Commands.parseLoopArgs("99 finish it").maxIterations, Commands.MAX_ITERATIONS);
  assert.equal(Commands.parseLoopArgs("finish it").maxIterations, Commands.DEFAULT_MAX_ITERATIONS);''',
    '''  assert.equal(Commands.parseLoopArgs("99 finish it").maxIterations, Commands.MAX_ITERATIONS);
  assert.equal(Commands.parseLoopArgs("0 finish it").maxIterations, 1);
  assert.equal(Commands.parseLoopArgs("finish it").maxIterations, Commands.DEFAULT_MAX_ITERATIONS);''',
)
replace_once(
    "tests/commands.test.js",
    '''  assert.equal(Commands.evaluateResponse("[YOLO:DONE]\nbut actually keep going"), "missing");
  assert.equal(Commands.evaluateResponse("no marker"), "missing");''',
    '''  assert.equal(Commands.evaluateResponse("[YOLO:DONE]\nbut actually keep going"), "missing");
  assert.equal(Commands.evaluateResponse("inline [YOLO:DONE]"), "missing");
  assert.equal(Commands.evaluateResponse("prefix\n[YOLO:DONE]"), "done");
  assert.equal(Commands.evaluateResponse("no marker"), "missing");''',
)
replace_once(
    "tests/platforms.test.js",
    '''  const adapter = { assistantSelectors: ["assistant"] };
  assert.match(Platforms.latestAssistantText(adapter, documentLike), /latest response/);
  assert.match(Platforms.latestAssistantText(adapter, documentLike), /YOLO:CONTINUE/);''',
    '''  const adapter = { assistantSelectors: ["assistant"] };
  assert.equal(Platforms.latestAssistantText(adapter, documentLike), "latest response\n[YOLO:CONTINUE]");''',
)

ui_append = r'''

test("command palette exposes active keyboard selection and restores every workflow action", () => {
  const source = read("command-ui.js");
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /role", "combobox"/);
  assert.match(source, /yolo-command-option-\$\{entry\.name\}/);
  assert.match(source, /clearButton\.disabled = workflowActionInFlight/);
});

test("pause and clear preserve prompts that are already sending", () => {
  const runtime = read("command-runtime.js");
  const guards = runtime.match(/state\.workflow\.pendingItemId && !cancelled\.removed/g) || [];
  assert.equal(guards.length, 2);
});
'''
if "active keyboard selection" not in read("tests/ui.test.js"):
    write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + ui_append)

print("Accepted external command workflow review findings applied")
