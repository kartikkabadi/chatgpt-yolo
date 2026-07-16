from __future__ import annotations

import re
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
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))


# Accept three-digit iteration input before clamping to the hard safety limit.
replace_once("commands.js", r"    const match = text.match(/^(\d{1,2})\s+([\s\S]+)$/);", r"    const match = text.match(/^(\d{1,3})\s+([\s\S]+)$/);")

# Make response transitions pure and exhaustively testable.
replace_once(
    "commands.js",
    '''  function oneShotPrompt(name, args = "") {''',
    '''  function decideWorkflowResponse(raw, responseText, { userFingerprint = "", at = Date.now() } = {}) {
    const workflow = normalizeWorkflow(raw, at);
    if (workflow.status !== "running" || !workflow.awaitingResponse) {
      return { workflow, action: "ignore", reason: "Workflow is not awaiting a response", code: "workflow.not_waiting" };
    }
    if (!workflow.promptFingerprint || userFingerprint !== workflow.promptFingerprint) {
      return {
        workflow,
        action: "paused",
        reason: "Conversation advanced outside the active workflow",
        code: "command.workflow.ownership_lost"
      };
    }

    const text = String(responseText || "").trim();
    if (!text) return { workflow, action: "ignore", reason: "No assistant response is available", code: "workflow.response_missing" };

    workflow.awaitingResponse = false;
    workflow.sawGeneration = false;
    workflow.lastAssistantFingerprint = fingerprint(text);
    workflow.lastResponseAt = at;
    workflow.iteration += 1;
    workflow.updatedAt = at;
    const outcome = evaluateResponse(text);

    if (outcome === "done") {
      return { workflow, action: "completed", reason: "ChatGPT reported the objective complete", code: "command.workflow.completed" };
    }
    if (outcome === "blocked") {
      return { workflow, action: "blocked", reason: "ChatGPT requested user input or unavailable access", code: "command.workflow.blocked" };
    }
    if (workflow.kind === "goal" && outcome === "missing") {
      return {
        workflow,
        action: "paused",
        reason: "Goal response omitted the required terminal control marker",
        code: "command.goal.marker_missing"
      };
    }
    if (workflow.iteration >= workflow.maxIterations) {
      return {
        workflow,
        action: "paused",
        reason: `Reached the ${workflow.maxIterations}-iteration safety cap`,
        code: "command.workflow.cap_reached"
      };
    }
    return { workflow, action: "continue", reason: "Continue workflow", code: "command.workflow.continue" };
  }

  function oneShotPrompt(name, args = "") {''',
)
replace_once(
    "commands.js",
    '''    evaluateResponse,
    oneShotPrompt,''',
    '''    evaluateResponse,
    decideWorkflowResponse,
    oneShotPrompt,''',
)

# Keep a bounded history of exact completions so a later queue send cannot
# overwrite workflow delivery evidence before the command runtime polls.
replace_once(
    "queue.js",
    '''  const MAX_EVENTS = 100;
  const CLAIM_TTL_MS = 2 * 60 * 1000;''',
    '''  const MAX_EVENTS = 100;
  const MAX_COMPLETIONS = 20;
  const CLAIM_TTL_MS = 2 * 60 * 1000;''',
)
replace_once(
    "queue.js",
    '''      lastCompletedSourceId: "",
      updatedAt: at''',
    '''      lastCompletedSourceId: "",
      completions: [],
      updatedAt: at''',
)
replace_once(
    "queue.js",
    '''  function normalizeState(raw, at = Date.now()) {''',
    '''  function normalizeCompletion(raw, at = Date.now()) {
    if (!raw || typeof raw !== "object") return null;
    const itemId = cleanText(raw.itemId, 180);
    if (!itemId) return null;
    return {
      itemId,
      source: cleanText(raw.source, 120),
      sourceId: cleanText(raw.sourceId, 180),
      at: Math.max(0, finite(raw.at, at))
    };
  }

  function normalizeState(raw, at = Date.now()) {''',
)
replace_once(
    "queue.js",
    '''      lastCompletedSourceId: cleanText(source.lastCompletedSourceId, 180),
      updatedAt:''',
    '''      lastCompletedSourceId: cleanText(source.lastCompletedSourceId, 180),
      completions: (Array.isArray(source.completions) ? source.completions : [])
        .map((completion) => normalizeCompletion(completion, at))
        .filter(Boolean)
        .sort((a, b) => a.at - b.at)
        .slice(-MAX_COMPLETIONS),
      updatedAt:''',
)
replace_once(
    "queue.js",
    '''    if (!item) {
      if (state.lastCompletedItemId === itemId) return { state, ok: true, alreadyCompleted: true };
      return { state, ok: false, reason: "Queue item was not found", code: "queue.not_found" };
    }''',
    '''    if (!item) {
      if (state.completions.some((completion) => completion.itemId === itemId)) {
        return { state, ok: true, alreadyCompleted: true };
      }
      return { state, ok: false, reason: "Queue item was not found", code: "queue.not_found" };
    }''',
)
replace_once(
    "queue.js",
    '''    state.lastCompletedSource = item.source;
    state.lastCompletedSourceId = item.sourceId;
    state.updatedAt = at;''',
    '''    state.lastCompletedSource = item.source;
    state.lastCompletedSourceId = item.sourceId;
    state.completions = [...state.completions, {
      itemId: item.id,
      source: item.source,
      sourceId: item.sourceId,
      at
    }].slice(-MAX_COMPLETIONS);
    state.updatedAt = at;''',
)

# Bound active per-conversation workflows to protect local extension storage.
replace_once(
    "background.js",
    '''const MAX_CONVERSATION_QUEUES = 25;
const WORKFLOW_LEASE_MS = 15 * 1000;''',
    '''const MAX_CONVERSATION_QUEUES = 25;
const MAX_ACTIVE_WORKFLOWS = 25;
const WORKFLOW_LEASE_MS = 15 * 1000;''',
)
replace_once(
    "background.js",
    '''      const workflow = Commands.normalizeWorkflow({ ...message.workflow, revision: current.revision + 1 });
      await storageSet({ [key]: workflow });''',
    '''      const workflow = Commands.normalizeWorkflow({ ...message.workflow, revision: current.revision + 1 });
      if (current.status === "idle" && workflow.status !== "idle") {
        const allStored = await storageGet(null);
        const activeCount = Object.entries(allStored)
          .filter(([storedKey]) => storedKey.startsWith("yoloWorkflow:") && storedKey !== key)
          .map(([, value]) => Commands.normalizeWorkflow(value))
          .filter((entry) => entry.status !== "idle")
          .length;
        if (activeCount >= MAX_ACTIVE_WORKFLOWS) {
          return {
            ok: false,
            reason: `Active workflow limit of ${MAX_ACTIVE_WORKFLOWS} conversations reached; clear an old workflow first`,
            code: "workflow.conversation_limit",
            workflow: current
          };
        }
      }
      await storageSet({ [key]: workflow });''',
)

# Runtime consumes the pure response transition and bounded completion history.
response_pattern = re.compile(r'''  async function processResponse\(\) \{.*?\n  \}\n\n  async function handlePendingWorkflowItem''', re.S)
response_replacement = '''  async function processResponse() {
    const workflow = Commands.normalizeWorkflow(state.workflow);
    const text = Platforms.latestAssistantText(adapter());
    const fingerprint = Commands.fingerprint(text);
    if (!text || fingerprint === workflow.baselineFingerprint || fingerprint === workflow.lastAssistantFingerprint) return false;

    const decision = Commands.decideWorkflowResponse(workflow, text, {
      userFingerprint: latestUserFingerprint(),
      at: now()
    });
    state.workflow = decision.workflow;
    if (decision.action === "ignore") return false;
    if (decision.action !== "continue") {
      await markWorkflow(decision.action, decision.reason, decision.code);
      return true;
    }

    if (!await writeWorkflow(state.workflow)) return true;
    const prompt = Commands.workflowPrompt(state.workflow, "continue");
    const queued = await queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${state.workflow.kind}` });
    if (!queued.ok) await markWorkflow("blocked", queued.reason || "Could not queue the next workflow iteration", "command.workflow.queue_failed");
    return true;
  }

  async function handlePendingWorkflowItem'''
runtime = read("command-runtime.js")
runtime, count = response_pattern.subn(response_replacement, runtime, count=1)
if count != 1:
    raise RuntimeError(f"Expected one runtime response replacement, found {count}")
write("command-runtime.js", runtime)
replace_once(
    "command-runtime.js",
    '''    const completedExactly = queue.state.lastCompletedItemId === workflow.pendingItemId
      && queue.state.lastCompletedSourceId === workflow.id;''',
    '''    const completedExactly = queue.state.completions.some((completion) =>
      completion.itemId === workflow.pendingItemId && completion.sourceId === workflow.id);''',
)

# Command UI: avoid IME execution, avoid global Cmd/Ctrl+K hijacking, make the
# blocked Resume button actually resume, and serialize workflow-bar actions.
replace_once(
    "command-ui.js",
    '''    let currentWorkflow = Commands.freshWorkflow();
    let destroyed = false;''',
    '''    let currentWorkflow = Commands.freshWorkflow();
    let workflowActionInFlight = false;
    let destroyed = false;''',
)
replace_once(
    "command-ui.js",
    '''    function keydown(event) {
      if (destroyed) return;
      const commandShortcut = (event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === "k" || (event.shiftKey && event.key.toLowerCase() === "p"));''',
    '''    function keydown(event) {
      if (destroyed || event.isComposing) return;
      const composerTarget = isComposerTarget(event.target);
      const commandShortcut = (event.metaKey || event.ctrlKey)
        && ((event.shiftKey && event.key.toLowerCase() === "p") || (composerTarget && event.key.toLowerCase() === "k"));''',
)
replace_once(
    "command-ui.js",
    '''      if (isComposerTarget(event.target)) {
        const composerText = callbacks.getComposerText();''',
    '''      if (composerTarget) {
        const composerText = callbacks.getComposerText();''',
)
replace_once(
    "command-ui.js",
    '''    pauseButton.addEventListener("click", () => currentWorkflow.status === "paused" ? callbacks.resume() : callbacks.pause());
    editButton.addEventListener("click", () => callbacks.edit(currentWorkflow));
    clearButton.addEventListener("click", () => callbacks.clear(currentWorkflow));''',
    '''    async function runWorkflowAction(action) {
      if (workflowActionInFlight) return;
      workflowActionInFlight = true;
      pauseButton.disabled = true;
      editButton.disabled = true;
      clearButton.disabled = true;
      try {
        const result = await action();
        if (result && result.ok === false && result.reason) workflowSub.textContent = result.reason;
      } finally {
        workflowActionInFlight = false;
        update({ workflow: currentWorkflow });
      }
    }

    pauseButton.addEventListener("click", () => runWorkflowAction(() =>
      ["paused", "blocked"].includes(currentWorkflow.status) ? callbacks.resume() : callbacks.pause()));
    editButton.addEventListener("click", () => callbacks.edit(currentWorkflow));
    clearButton.addEventListener("click", () => runWorkflowAction(() => callbacks.clear(currentWorkflow)));''',
)

# Tests for the pure response state machine, completion ring, storage cap, IME,
# and blocked Resume behavior.
commands_append = r'''

test("workflow response decisions enforce ownership, markers, and caps", () => {
  const base = Commands.normalizeWorkflow({
    kind: "goal",
    objective: "ship",
    status: "running",
    maxIterations: 2,
    iteration: 0,
    awaitingResponse: true,
    promptFingerprint: "owned"
  }, 1000);

  assert.equal(Commands.decideWorkflowResponse(base, "work\n[YOLO:CONTINUE]", {
    userFingerprint: "manual",
    at: 1100
  }).action, "paused");

  const continued = Commands.decideWorkflowResponse(base, "work\n[YOLO:CONTINUE]", {
    userFingerprint: "owned",
    at: 1100
  });
  assert.equal(continued.action, "continue");
  assert.equal(continued.workflow.iteration, 1);

  const capped = Commands.decideWorkflowResponse({ ...continued.workflow, awaitingResponse: true }, "more\n[YOLO:CONTINUE]", {
    userFingerprint: "owned",
    at: 1200
  });
  assert.equal(capped.action, "paused");
  assert.match(capped.reason, /safety cap/);

  const done = Commands.decideWorkflowResponse(base, "complete\n[YOLO:DONE]", {
    userFingerprint: "owned",
    at: 1300
  });
  assert.equal(done.action, "completed");
});
'''
if "workflow response decisions enforce ownership" not in read("tests/commands.test.js"):
    write("tests/commands.test.js", read("tests/commands.test.js").rstrip() + commands_append)

queue_append = r'''

test("recent completion identity remains available after later sends", () => {
  let state = Queue.addItem(Queue.freshState(1000), {
    text: "first",
    source: "workflow:goal",
    sourceId: "goal-1"
  }, { id: "first", at: 1001 }).state;
  state = Queue.addItem(state, { text: "second" }, { id: "second", at: 1002 }).state;
  const firstClaim = Queue.claimNext(state, "owner", { at: 1100 });
  state = Queue.completeClaim(firstClaim.state, "first", firstClaim.item.claimToken, 1200).state;
  const secondClaim = Queue.claimNext(state, "owner", { at: 1300 });
  state = Queue.completeClaim(secondClaim.state, "second", secondClaim.item.claimToken, 1400).state;
  assert.equal(state.completions.some((entry) => entry.itemId === "first" && entry.sourceId === "goal-1"), true);
});
'''
if "recent completion identity remains available" not in read("tests/queue.test.js"):
    write("tests/queue.test.js", read("tests/queue.test.js").rstrip() + queue_append)

background_append = r'''

test("background bounds active command workflows", async () => {
  const { invoke } = loadBackground();
  for (let index = 0; index < 25; index += 1) {
    const pageId = `https://chatgpt.com/c/workflow-${index}`;
    const response = await invoke({
      type: "YOLO_WORKFLOW_SET",
      pageId,
      expectedRevision: 0,
      workflow: { kind: "loop", objective: `work ${index}`, status: "running" }
    });
    assert.equal(response.ok, true);
  }
  const rejected = await invoke({
    type: "YOLO_WORKFLOW_SET",
    pageId: "https://chatgpt.com/c/workflow-overflow",
    expectedRevision: 0,
    workflow: { kind: "goal", objective: "overflow", status: "running" }
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "workflow.conversation_limit");
});
'''
if "background bounds active command workflows" not in read("tests/background.test.js"):
    write("tests/background.test.js", read("tests/background.test.js").rstrip() + background_append)

ui_append = r'''

test("command UI handles blocked resume, IME, and shortcut scope safely", () => {
  const source = read("command-ui.js");
  assert.match(source, /destroyed \|\| event\.isComposing/);
  assert.match(source, /composerTarget && event\.key\.toLowerCase\(\) === "k"/);
  assert.match(source, /\["paused", "blocked"\]\.includes\(currentWorkflow\.status\) \? callbacks\.resume\(\) : callbacks\.pause\(\)/);
  assert.match(source, /workflowActionInFlight/);
});

test("runtime uses the pure workflow response decision and completion ring", () => {
  const runtime = read("command-runtime.js");
  assert.match(runtime, /Commands\.decideWorkflowResponse/);
  assert.match(runtime, /queue\.state\.completions\.some/);
});
'''
if "blocked resume, IME" not in read("tests/ui.test.js"):
    write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + ui_append)

print("Second adversarial command workflow review applied")
