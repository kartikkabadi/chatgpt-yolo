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


# ---------------------------------------------------------------------------
# Pure workflow semantics: terminal markers, optimistic revisions, runner
# leases, prompt ownership, and a truly persistent (but bounded) goal cap.
# ---------------------------------------------------------------------------
replace_once(
    "commands.js",
    '  const MARKER_RE = /\\[YOLO:(CONTINUE|DONE|BLOCKED)\\]/i;',
    '  const MARKER_RE = /\\[YOLO:(CONTINUE|DONE|BLOCKED)\\]\\s*$/i;',
)
replace_once(
    "commands.js",
    '''      version: 1,
      id: "",
      kind: "",''',
    '''      version: 1,
      revision: 0,
      id: "",
      kind: "",''',
)
replace_once(
    "commands.js",
    '''      baselineFingerprint: "",
      lastAssistantFingerprint: "",
      lastPromptAt: 0,''',
    '''      baselineFingerprint: "",
      lastAssistantFingerprint: "",
      promptFingerprint: "",
      runnerId: "",
      runnerExpiresAt: 0,
      lastPromptAt: 0,''',
)
replace_once(
    "commands.js",
    '''    if (!kind || !objective || status === "idle") return fallback;
    return {
      version: 1,
      id:''',
    '''    const revision = Math.max(0, Math.round(finite(raw.revision, 0)));
    if (!kind || !objective || status === "idle") {
      return {
        ...fallback,
        revision,
        createdAt: finite(raw.createdAt, fallback.createdAt),
        updatedAt: finite(raw.updatedAt, at)
      };
    }
    return {
      version: 1,
      revision,
      id:''',
)
replace_once(
    "commands.js",
    '''      baselineFingerprint: cleanText(raw.baselineFingerprint, 180),
      lastAssistantFingerprint: cleanText(raw.lastAssistantFingerprint, 180),
      lastPromptAt:''',
    '''      baselineFingerprint: cleanText(raw.baselineFingerprint, 180),
      lastAssistantFingerprint: cleanText(raw.lastAssistantFingerprint, 180),
      promptFingerprint: cleanText(raw.promptFingerprint, 180),
      runnerId: status === "running" ? cleanText(raw.runnerId, 220) : "",
      runnerExpiresAt: status === "running" ? Math.max(0, finite(raw.runnerExpiresAt, 0)) : 0,
      lastPromptAt:''',
)
replace_once(
    "commands.js",
    '''    const parsed = kind === "loop" ? parseLoopArgs(input) : { objective: cleanText(input), maxIterations: DEFAULT_MAX_ITERATIONS };''',
    '''    const parsed = kind === "loop" ? parseLoopArgs(input) : { objective: cleanText(input), maxIterations: MAX_ITERATIONS };''',
)
replace_once(
    "commands.js",
    '''      workflow.awaitingResponse = false;
      workflow.sawGeneration = false;
    }''',
    '''      workflow.awaitingResponse = false;
      workflow.sawGeneration = false;
      workflow.runnerId = "";
      workflow.runnerExpiresAt = 0;
    }''',
)

# ---------------------------------------------------------------------------
# ChatGPT message ownership: inspect both the latest user prompt and assistant
# response, so manual conversation activity cannot be mistaken for a workflow
# turn.
# ---------------------------------------------------------------------------
replace_once(
    "platforms.js",
    '''      assistantSelectors: [
        "[data-message-author-role='assistant']",
        "article[data-testid^='conversation-turn'] [data-message-author-role='assistant']",
        "main article [data-message-author-role='assistant']"
      ]''',
    '''      assistantSelectors: [
        "[data-message-author-role='assistant']",
        "article[data-testid^='conversation-turn'] [data-message-author-role='assistant']",
        "main article [data-message-author-role='assistant']"
      ],
      userSelectors: [
        "[data-message-author-role='user']",
        "article[data-testid^='conversation-turn'] [data-message-author-role='user']",
        "main article [data-message-author-role='user']"
      ]''',
)
replace_once(
    "platforms.js",
    '''  function latestAssistantText(adapter, documentLike = document) {
    if (!adapter) return "";
    const selectors = Array.isArray(adapter.assistantSelectors) ? adapter.assistantSelectors : [];
    const candidates = uniqueElements(selectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return normalizedText(candidates.at(-1));
  }

  function isTextControl(element) {''',
    '''  function latestMessageText(selectors, documentLike = document) {
    const candidates = uniqueElements((Array.isArray(selectors) ? selectors : [])
      .flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return normalizedText(candidates.at(-1));
  }

  function latestAssistantText(adapter, documentLike = document) {
    return adapter ? latestMessageText(adapter.assistantSelectors, documentLike) : "";
  }

  function latestUserText(adapter, documentLike = document) {
    return adapter ? latestMessageText(adapter.userSelectors, documentLike) : "";
  }

  function isTextControl(element) {''',
)
replace_once(
    "platforms.js",
    '''    findErrorState,
    latestAssistantText,
    composerText,''',
    '''    findErrorState,
    latestAssistantText,
    latestUserText,
    composerText,''',
)

# ---------------------------------------------------------------------------
# Queue completion identity: command workflows may only transition to
# awaiting-response after their exact queue item has completed.
# ---------------------------------------------------------------------------
replace_once(
    "queue.js",
    '''      events: [],
      lastSentAt: 0,
      updatedAt: at''',
    '''      events: [],
      lastSentAt: 0,
      lastCompletedItemId: "",
      lastCompletedSource: "",
      lastCompletedSourceId: "",
      updatedAt: at''',
)
replace_once(
    "queue.js",
    '''      lastSentAt: Math.max(0, finite(source.lastSentAt, fallback.lastSentAt)),
      updatedAt:''',
    '''      lastSentAt: Math.max(0, finite(source.lastSentAt, fallback.lastSentAt)),
      lastCompletedItemId: cleanText(source.lastCompletedItemId, 180),
      lastCompletedSource: cleanText(source.lastCompletedSource, 120),
      lastCompletedSourceId: cleanText(source.lastCompletedSourceId, 180),
      updatedAt:''',
)
replace_once(
    "queue.js",
    '''    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return { state, ok: true, alreadyCompleted: true };
    if (item.state !== "sending" || item.claimToken !== claimToken) {''',
    '''    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) {
      if (state.lastCompletedItemId === itemId) return { state, ok: true, alreadyCompleted: true };
      return { state, ok: false, reason: "Queue item was not found", code: "queue.not_found" };
    }
    if (item.state !== "sending" || item.claimToken !== claimToken) {''',
)
replace_once(
    "queue.js",
    '''    state.items = state.items.filter((entry) => entry.id !== itemId);
    state.lastSentAt = at;
    state.updatedAt = at;''',
    '''    state.items = state.items.filter((entry) => entry.id !== itemId);
    state.lastSentAt = at;
    state.lastCompletedItemId = item.id;
    state.lastCompletedSource = item.source;
    state.lastCompletedSourceId = item.sourceId;
    state.updatedAt = at;''',
)

# ---------------------------------------------------------------------------
# Background workflow ownership: optimistic compare-and-set revisions and a
# renewable single-runner lease eliminate multi-tab duplicate continuations.
# ---------------------------------------------------------------------------
replace_once(
    "background.js",
    '''const workflowLock = { current: Promise.resolve() };
const MAX_CONVERSATION_QUEUES = 25;''',
    '''const workflowLock = { current: Promise.resolve() };
const MAX_CONVERSATION_QUEUES = 25;
const WORKFLOW_LEASE_MS = 15 * 1000;
const WORKFLOW_RENEW_WINDOW_MS = 5 * 1000;''',
)
workflow_pattern = re.compile(r'''async function handleWorkflowMessage\(message, sender\) \{.*?\n\}\n\nasync function handleQueueMessage''', re.S)
workflow_replacement = '''async function handleWorkflowMessage(message, sender) {
  const pageId = message.pageId;
  if (!validPageId(pageId)) return { ok: false, reason: "Invalid conversation identifier", code: "workflow.page_invalid" };
  if (!senderMatchesPageId(sender, pageId)) {
    return { ok: false, reason: "Conversation identifier does not match the sending tab", code: "workflow.page_mismatch" };
  }

  return withLock(workflowLock, async () => {
    const key = Config.workflowKey(pageId);
    const stored = await storageGet([key]);
    const current = Commands.normalizeWorkflow(stored[key]);

    if (message.type === "YOLO_WORKFLOW_GET") return { ok: true, workflow: current };

    if (message.type === "YOLO_WORKFLOW_SET") {
      const expectedRevision = Math.max(0, Math.round(Number(message.expectedRevision) || 0));
      if (expectedRevision !== current.revision) {
        return { ok: false, reason: "Workflow changed in another tab", code: "workflow.conflict", workflow: current };
      }
      const workflow = Commands.normalizeWorkflow({ ...message.workflow, revision: current.revision + 1 });
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };
    }

    if (message.type === "YOLO_WORKFLOW_CLEAR") {
      const expectedRevision = Math.max(0, Math.round(Number(message.expectedRevision) || 0));
      if (expectedRevision !== current.revision) {
        return { ok: false, reason: "Workflow changed in another tab", code: "workflow.conflict", workflow: current };
      }
      const workflow = Commands.normalizeWorkflow({ ...Commands.freshWorkflow(), revision: current.revision + 1 });
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };
    }

    if (message.type === "YOLO_WORKFLOW_CLAIM") {
      if (current.status !== "running") return { ok: false, reason: "Workflow is not running", code: "workflow.not_running", workflow: current };
      const ownerId = String(message.ownerId || "").trim().slice(0, 220);
      if (!ownerId) return { ok: false, reason: "Workflow runner identifier is required", code: "workflow.owner_invalid", workflow: current };
      const timestamp = Date.now();
      if (current.runnerId && current.runnerId !== ownerId && current.runnerExpiresAt > timestamp) {
        return { ok: false, reason: "Workflow is active in another tab", code: "workflow.busy", workflow: current };
      }
      if (current.runnerId === ownerId && current.runnerExpiresAt > timestamp + WORKFLOW_RENEW_WINDOW_MS) {
        return { ok: true, workflow: current, renewed: false };
      }
      const workflow = Commands.normalizeWorkflow({
        ...current,
        revision: current.revision + 1,
        runnerId: ownerId,
        runnerExpiresAt: timestamp + WORKFLOW_LEASE_MS,
        updatedAt: timestamp
      });
      await storageSet({ [key]: workflow });
      return { ok: true, workflow, renewed: true };
    }

    if (message.type === "YOLO_WORKFLOW_RELEASE") {
      const ownerId = String(message.ownerId || "").trim().slice(0, 220);
      if (current.runnerId !== ownerId) return { ok: true, workflow: current, released: false };
      const workflow = Commands.normalizeWorkflow({
        ...current,
        revision: current.revision + 1,
        runnerId: "",
        runnerExpiresAt: 0,
        updatedAt: Date.now()
      });
      await storageSet({ [key]: workflow });
      return { ok: true, workflow, released: true };
    }

    return { ok: false, reason: "Unknown workflow operation" };
  });
}

async function handleQueueMessage'''
background = read("background.js")
background, count = workflow_pattern.subn(workflow_replacement, background, count=1)
if count != 1:
    raise RuntimeError(f"Expected one workflow handler replacement, found {count}")
write("background.js", background)

# ---------------------------------------------------------------------------
# Runtime rewritten coherently around the reviewed invariants.
# ---------------------------------------------------------------------------
write("command-runtime.js", r'''(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Platforms = globalThis.YOLOPlatforms;
  const Commands = globalThis.YOLOCommands;
  const CommandUI = globalThis.YOLOCommandUI;
  if (!Config || !Platforms || !Commands || !CommandUI) return;

  if (window.__YOLO_COMMAND_RUNTIME__?.version === Config.VERSION) return;
  window.__YOLO_COMMAND_RUNTIME__?.destroy?.();

  const POLL_MS = 750;
  const RESPONSE_SETTLE_MS = 1200;
  const state = {
    destroyed: false,
    pageId: "",
    workflow: Commands.freshWorkflow(),
    ui: null,
    pollTimer: null,
    routeInFlight: false,
    tickInFlight: false,
    lastQueueAttemptAt: 0,
    unregisterEngineClient: null,
    mutationLock: { current: Promise.resolve() },
    ownerId: `command_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  };

  const now = () => Date.now();
  const engine = () => window.__YOLO_EXTENSION__?.commandApi || null;

  function withWorkflowLock(task) {
    const run = state.mutationLock.current.catch(() => {}).then(task);
    state.mutationLock.current = run.catch(() => {});
    return run;
  }

  const backgroundSend = (message) => new Promise((resolve) => {
    if (state.destroyed) return resolve(null);
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime?.lastError;
        resolve(error ? null : response || null);
      });
    } catch {
      resolve(null);
    }
  });

  function adapter() {
    return Platforms.adapterForLocation();
  }

  function composer() {
    return Platforms.findComposer(adapter());
  }

  function composerText() {
    return Platforms.composerText(composer());
  }

  function setComposerText(value) {
    const target = composer();
    if (!target) return false;
    Platforms.setComposerValue(target, value);
    return true;
  }

  function latestAssistantFingerprint() {
    return Commands.fingerprint(Platforms.latestAssistantText(adapter()));
  }

  function latestUserFingerprint() {
    return Commands.fingerprint(Platforms.latestUserText(adapter()));
  }

  async function record(message, level = "info", code = "command.status", log = true) {
    const api = engine();
    if (api?.recordStatus) await api.recordStatus(message, level, code, log);
  }

  function applyWorkflowResponse(response, targetPageId = state.pageId) {
    if (response?.workflow && state.pageId === targetPageId) {
      state.workflow = Commands.normalizeWorkflow(response.workflow);
      syncUI();
    }
  }

  async function readWorkflow(pageId = state.pageId) {
    const response = await backgroundSend({ type: "YOLO_WORKFLOW_GET", pageId });
    return response?.ok ? Commands.normalizeWorkflow(response.workflow) : Commands.freshWorkflow();
  }

  async function writeWorkflow(workflow = state.workflow, pageId = state.pageId) {
    const normalized = Commands.normalizeWorkflow(workflow);
    const response = await backgroundSend({
      type: "YOLO_WORKFLOW_SET",
      pageId,
      expectedRevision: normalized.revision,
      workflow: normalized
    });
    applyWorkflowResponse(response, pageId);
    return Boolean(response?.ok && state.pageId === pageId);
  }

  async function clearWorkflow(pageId = state.pageId) {
    const response = await backgroundSend({
      type: "YOLO_WORKFLOW_CLEAR",
      pageId,
      expectedRevision: state.workflow.revision
    });
    applyWorkflowResponse(response, pageId);
    return Boolean(response?.ok && state.pageId === pageId);
  }

  async function claimWorkflow() {
    const pageId = state.pageId;
    const response = await backgroundSend({
      type: "YOLO_WORKFLOW_CLAIM",
      pageId,
      ownerId: state.ownerId
    });
    applyWorkflowResponse(response, pageId);
    return Boolean(response?.ok && state.pageId === pageId);
  }

  function releaseWorkflow() {
    if (!state.pageId || state.workflow.runnerId !== state.ownerId) return;
    backgroundSend({
      type: "YOLO_WORKFLOW_RELEASE",
      pageId: state.pageId,
      ownerId: state.ownerId
    });
  }

  async function queueState(pageId = state.pageId) {
    return backgroundSend({ type: "YOLO_QUEUE_GET", pageId });
  }

  async function removeQueueItem(itemId, pageId = state.pageId) {
    if (!itemId) return true;
    const response = await backgroundSend({ type: "YOLO_QUEUE_REMOVE", pageId, itemId });
    return Boolean(response?.ok || response?.code === "queue.not_found");
  }

  async function queuePrompt(text, { workflow = null, source = "command" } = {}) {
    const prompt = String(text || "").trim();
    const pageId = state.pageId;
    if (!prompt) return { ok: false, reason: "Command produced an empty prompt" };
    const response = await backgroundSend({
      type: "YOLO_QUEUE_ADD",
      pageId,
      front: true,
      item: {
        text: prompt,
        source,
        sourceId: workflow?.id || ""
      }
    });
    if (!response?.ok) return response || { ok: false, reason: "Could not add the command prompt to the queue" };

    if (workflow) {
      const next = Commands.normalizeWorkflow(workflow);
      next.pendingItemId = response.item.id;
      next.awaitingResponse = false;
      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.promptFingerprint = Commands.fingerprint(prompt);
      next.lastPromptAt = now();
      next.reason = "Queued command prompt";
      next.updatedAt = now();
      state.workflow = next;
      if (!await writeWorkflow(next, pageId)) {
        await removeQueueItem(response.item.id, pageId);
        return { ok: false, reason: "Workflow changed before its prompt could be committed" };
      }
    }

    const api = engine();
    const sent = api ? await api.runAction("queue-next") : false;
    if (workflow && sent && state.pageId === pageId) {
      const next = Commands.normalizeWorkflow(state.workflow);
      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.reason = "Waiting for ChatGPT";
      next.updatedAt = now();
      await writeWorkflow(next, pageId);
    }
    return { ...response, sent };
  }

  async function cancelPendingWorkflowPrompt(workflow = state.workflow) {
    if (!workflow.pendingItemId) return { ok: true, removed: false };
    const response = await backgroundSend({
      type: "YOLO_QUEUE_REMOVE",
      pageId: state.pageId,
      itemId: workflow.pendingItemId
    });
    if (response?.ok || response?.code === "queue.not_found") return { ok: true, removed: true };
    if (response?.code === "queue.sending") {
      return { ok: true, removed: false, reason: "The current workflow prompt is already sending and cannot be unsent" };
    }
    return { ok: false, removed: false, reason: response?.reason || "Could not remove the pending workflow prompt" };
  }

  async function startWorkflow(kind, args) {
    await syncRoute();
    const latest = await readWorkflow(state.pageId);
    state.workflow = latest;
    syncUI();

    if (latest.status !== "idle") {
      if (latest.status === "running" && (latest.pendingItemId || latest.awaitingResponse || engine()?.getState?.().generating)) {
        return { ok: false, reason: "Pause or clear the active workflow after its current turn finishes before replacing it", keepOpen: true };
      }
      if (!window.confirm(`Replace the active ${latest.kind} workflow?`)) {
        return { ok: false, reason: "Existing workflow kept", keepOpen: true };
      }
      const cancelled = await cancelPendingWorkflowPrompt(latest);
      if (!cancelled.ok) return { ok: false, reason: cancelled.reason, keepOpen: true };
    }

    const current = Commands.startWorkflow(kind, args, {
      at: now(),
      baselineFingerprint: latestAssistantFingerprint()
    });
    if (!current.ok) return { ...current, keepOpen: true };
    current.workflow.revision = latest.revision;
    current.workflow.runnerId = state.ownerId;
    state.workflow = current.workflow;
    if (!await writeWorkflow(state.workflow)) return { ok: false, reason: "Workflow changed in another tab", keepOpen: true };

    const prompt = Commands.workflowPrompt(state.workflow, "initial");
    const queued = await queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${kind}` });
    if (!queued.ok) {
      await markWorkflow("blocked", queued.reason || "Could not queue workflow prompt", `command.${kind}.blocked`);
      return { ...queued, keepOpen: true };
    }
    await record(`Started /${kind}: ${state.workflow.objective}`, "success", `command.${kind}.started`);
    return { ok: true };
  }

  async function runOneShot(name, args) {
    if (state.workflow.status === "running") {
      return { ok: false, reason: "Pause the active goal or loop before running another prompt command", keepOpen: true };
    }
    const prompt = Commands.oneShotPrompt(name, args);
    if (!prompt) return { ok: false, reason: `/${name} requires more detail`, keepOpen: true };
    const queued = await queuePrompt(prompt, { source: `command:${name}` });
    if (!queued.ok) {
      await record(`/${name} failed: ${queued.reason || "queue unavailable"}`, "error", `command.${name}.failed`);
      return { ...queued, keepOpen: true };
    }
    await record(queued.sent ? `Ran /${name}` : `Queued /${name}`, "success", `command.${name}`);
    return { ok: true };
  }

  async function setStatus(status, reason) {
    if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop", keepOpen: true };
    if (status === "paused") {
      const cancelled = await cancelPendingWorkflowPrompt(state.workflow);
      if (!cancelled.ok) return { ok: false, reason: cancelled.reason, keepOpen: true };
      if (cancelled.reason) reason = `${reason}. ${cancelled.reason}`;
    }
    const next = Commands.setWorkflowStatus(state.workflow, status, reason, now());
    const ok = await writeWorkflow(next);
    if (ok) await record(`${state.workflow.kind} ${status}`, status === "blocked" ? "warning" : "info", `command.workflow.${status}`);
    return { ok, reason: ok ? "" : "Workflow changed in another tab", keepOpen: !ok };
  }

  async function resumeWorkflow() {
    if (!["paused", "blocked"].includes(state.workflow.status)) return { ok: false, reason: "Workflow is not paused", keepOpen: true };
    const next = Commands.normalizeWorkflow(state.workflow);
    next.status = "running";
    next.reason = "Resumed by user";
    next.updatedAt = now();
    if (!await writeWorkflow(next)) return { ok: false, reason: "Workflow changed in another tab", keepOpen: true };
    if (!state.workflow.pendingItemId && !state.workflow.awaitingResponse) {
      const prompt = Commands.workflowPrompt(state.workflow, state.workflow.iteration === 0 ? "initial" : "continue");
      return queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${state.workflow.kind}` });
    }
    return { ok: true };
  }

  async function showStatus() {
    const apiState = engine()?.getState?.() || {};
    const queue = await queueState();
    const workflow = Commands.normalizeWorkflow(state.workflow);
    state.ui?.showStatus({
      Conversation: state.pageId || "Unavailable",
      Workflow: workflow.status === "idle" ? "None" : `/${workflow.kind} · ${workflow.status}`,
      Objective: workflow.status === "idle" ? "—" : workflow.objective,
      Iteration: workflow.status === "idle" ? "—" : `${workflow.iteration}/${workflow.maxIterations}`,
      Queue: queue?.ok ? `${queue.state.items.length} item${queue.state.items.length === 1 ? "" : "s"}${queue.state.paused ? " · paused" : ""}` : "Unavailable",
      Runner: workflow.status === "running" ? (workflow.runnerId === state.ownerId ? "This tab" : (workflow.runnerId ? "Another tab" : "Acquiring")) : "—",
      Generation: apiState.generating ? "Active" : "Idle",
      Profile: apiState.settings?.profile || "Unknown",
      "Session actions": apiState.runtime?.sessionActionCount ?? 0,
      "Last action": apiState.lastAction?.message || "Idle"
    });
    return { ok: true, focusComposer: false };
  }

  async function executeCommandUnlocked(name, args = "") {
    await syncRoute();
    const api = engine();
    if (!api || !await api.ensureReady()) return { ok: false, reason: "YOLO is not ready in this conversation", keepOpen: true };
    if (["goal", "loop"].includes(name)) return startWorkflow(name, args);
    if (["plan", "review", "fix", "compact", "continue"].includes(name)) return runOneShot(name, args);
    if (name === "status" || name === "queue") return showStatus();
    if (name === "pause") return setStatus("paused", "Paused by user");
    if (name === "resume") return resumeWorkflow();
    if (name === "clear") {
      if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop", keepOpen: true };
      if (!window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) return { ok: false, reason: "Workflow kept", keepOpen: true };
      const cancelled = await cancelPendingWorkflowPrompt(state.workflow);
      if (!cancelled.ok) return { ok: false, reason: cancelled.reason, keepOpen: true };
      const ok = await clearWorkflow();
      if (ok) await record(cancelled.reason || "Cleared command workflow", "info", "command.workflow.cleared");
      return { ok, reason: ok ? "" : "Workflow changed in another tab", keepOpen: !ok };
    }
    if (name === "settings") {
      chrome.runtime.openOptionsPage?.();
      return { ok: true, focusComposer: false };
    }
    if (name === "help") {
      state.ui?.open();
      return { ok: true, keepOpen: true, focusComposer: false };
    }
    return { ok: false, reason: "Unknown command", keepOpen: true };
  }

  function executeCommand(name, args = "") {
    return withWorkflowLock(() => executeCommandUnlocked(name, args));
  }

  function syncUI() {
    state.ui?.update({ workflow: state.workflow });
  }

  async function syncRoute() {
    const nextPageId = Config.pageId(location.href);
    if (!Config.isSupportedUrl(location.href) || nextPageId === state.pageId || state.routeInFlight) return;
    state.routeInFlight = true;
    try {
      state.pageId = nextPageId;
      state.workflow = await readWorkflow(nextPageId);
      syncUI();
    } finally {
      state.routeInFlight = false;
    }
  }

  async function markWorkflow(status, reason, code) {
    const next = Commands.setWorkflowStatus(state.workflow, status, reason, now());
    const saved = await writeWorkflow(next);
    if (saved) await record(`${state.workflow.kind} ${status}: ${reason}`, status === "completed" ? "success" : "warning", code);
    return saved;
  }

  async function processResponse() {
    const workflow = Commands.normalizeWorkflow(state.workflow);
    const text = Platforms.latestAssistantText(adapter());
    const fingerprint = Commands.fingerprint(text);
    if (!text || fingerprint === workflow.baselineFingerprint || fingerprint === workflow.lastAssistantFingerprint) return false;

    if (latestUserFingerprint() !== workflow.promptFingerprint) {
      await markWorkflow("paused", "Conversation advanced outside the active workflow", "command.workflow.ownership_lost");
      return true;
    }

    workflow.awaitingResponse = false;
    workflow.sawGeneration = false;
    workflow.lastAssistantFingerprint = fingerprint;
    workflow.lastResponseAt = now();
    workflow.iteration += 1;
    workflow.updatedAt = now();
    const outcome = Commands.evaluateResponse(text);

    if (outcome === "done") {
      state.workflow = workflow;
      await markWorkflow("completed", "ChatGPT reported the objective complete", "command.workflow.completed");
      return true;
    }
    if (outcome === "blocked") {
      state.workflow = workflow;
      await markWorkflow("blocked", "ChatGPT requested user input or unavailable access", "command.workflow.blocked");
      return true;
    }
    if (workflow.kind === "goal" && outcome === "missing") {
      state.workflow = workflow;
      await markWorkflow("paused", "Goal response omitted the required terminal control marker", "command.goal.marker_missing");
      return true;
    }
    if (workflow.iteration >= workflow.maxIterations) {
      state.workflow = workflow;
      await markWorkflow("paused", `Reached the ${workflow.maxIterations}-iteration safety cap`, "command.workflow.cap_reached");
      return true;
    }

    state.workflow = workflow;
    if (!await writeWorkflow(workflow)) return true;
    const prompt = Commands.workflowPrompt(state.workflow, "continue");
    const queued = await queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${state.workflow.kind}` });
    if (!queued.ok) await markWorkflow("blocked", queued.reason || "Could not queue the next workflow iteration", "command.workflow.queue_failed");
    return true;
  }

  async function handlePendingWorkflowItem(apiState) {
    const workflow = Commands.normalizeWorkflow(state.workflow);
    const queue = await queueState();
    if (!queue?.ok) return false;
    const item = queue.state.items.find((entry) => entry.id === workflow.pendingItemId);
    if (item?.state === "failed") {
      await markWorkflow("blocked", item.error || "Workflow prompt failed", "command.workflow.delivery_failed");
      return true;
    }
    if (item) {
      if (!apiState.generating && now() - state.lastQueueAttemptAt >= POLL_MS) {
        state.lastQueueAttemptAt = now();
        const sent = await engine()?.runAction?.("queue-next");
        if (sent) {
          const next = Commands.normalizeWorkflow(state.workflow);
          next.pendingItemId = "";
          next.awaitingResponse = true;
          next.sawGeneration = false;
          next.baselineFingerprint = latestAssistantFingerprint();
          next.lastAssistantFingerprint = next.baselineFingerprint;
          next.reason = "Waiting for ChatGPT";
          next.updatedAt = now();
          await writeWorkflow(next);
        }
      }
      return false;
    }

    const completedExactly = queue.state.lastCompletedItemId === workflow.pendingItemId
      && queue.state.lastCompletedSourceId === workflow.id;
    if (completedExactly) {
      const next = Commands.normalizeWorkflow(state.workflow);
      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.reason = "Waiting for ChatGPT";
      next.updatedAt = now();
      await writeWorkflow(next);
      return false;
    }

    await markWorkflow("blocked", "Workflow prompt was removed before confirmed delivery", "command.workflow.prompt_removed");
    return true;
  }

  async function handleWorkflow() {
    if (Commands.normalizeWorkflow(state.workflow).status !== "running") return false;
    if (!await claimWorkflow()) return false;
    const workflow = Commands.normalizeWorkflow(state.workflow);
    if (workflow.runnerId !== state.ownerId) return false;
    const api = engine();
    if (!api || !await api.ensureReady()) return false;
    const apiState = api.getState();

    if (workflow.pendingItemId) return handlePendingWorkflowItem(apiState);
    if (!workflow.awaitingResponse) return false;

    if (apiState.generating) {
      if (!workflow.sawGeneration) {
        workflow.sawGeneration = true;
        workflow.reason = "ChatGPT is working";
        workflow.updatedAt = now();
        await writeWorkflow(workflow);
      }
      return false;
    }

    if (now() - workflow.lastPromptAt < RESPONSE_SETTLE_MS) return false;
    return processResponse();
  }

  async function tick() {
    if (state.destroyed || state.tickInFlight) return;
    state.tickInFlight = true;
    try {
      await withWorkflowLock(async () => {
        await syncRoute();
        await handleWorkflow();
      });
      syncUI();
      state.ui?.reposition?.();
    } finally {
      state.tickInFlight = false;
    }
  }

  function editWorkflow(workflow) {
    setComposerText(`/${workflow.kind} ${workflow.kind === "loop" ? `${workflow.maxIterations} ` : ""}${workflow.objective}`);
    composer()?.focus?.();
  }

  function mountUI() {
    state.ui = CommandUI.mount({
      execute: executeCommand,
      pause: () => executeCommand("pause"),
      resume: () => executeCommand("resume"),
      clear: () => executeCommand("clear"),
      edit: editWorkflow,
      getComposer: composer,
      getComposerText: composerText,
      setComposerText
    });
    syncUI();
  }

  function destroy() {
    if (state.destroyed) return;
    releaseWorkflow();
    state.destroyed = true;
    window.clearInterval(state.pollTimer);
    state.unregisterEngineClient?.();
    state.ui?.destroy?.();
  }

  window.__YOLO_COMMAND_RUNTIME__ = { version: Config.VERSION, destroy };
  mountUI();
  const api = engine();
  state.unregisterEngineClient = api?.registerClient?.(destroy) || null;
  syncRoute().then(tick);
  state.pollTimer = window.setInterval(tick, POLL_MS);
})();
''')

# ---------------------------------------------------------------------------
# Command palette feedback, optional arguments, safe direct invocation, and
# blocked-workflow resume behavior.
# ---------------------------------------------------------------------------
replace_once(
    "command-ui.js",
    '''      .search::placeholder { color: #71717a; }
      .escape {''',
    '''      .search::placeholder { color: #71717a; }
      .feedback { display: none; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,.08); color: #fca5a5; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .feedback[data-visible="true"] { display: block; }
      .escape {''',
)
replace_once(
    "command-ui.js",
    '''    palette.appendChild(searchRow);
    const list = element("div", "list");''',
    '''    palette.appendChild(searchRow);
    const feedback = element("div", "feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.dataset.visible = "false";
    palette.appendChild(feedback);
    const list = element("div", "list");''',
)
replace_once(
    "command-ui.js",
    '''        button.setAttribute("role", "option");
        button.dataset.active = String(index === selectedIndex);''',
    '''        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === selectedIndex));
        button.dataset.active = String(index === selectedIndex);''',
)
replace_once(
    "command-ui.js",
    '''      argumentCommand = null;
      search.value = "";''',
    '''      argumentCommand = null;
      feedback.textContent = "";
      feedback.dataset.visible = "false";
      search.value = "";''',
)
run_pattern = re.compile(r'''    async function run\(entry, args = ""\) \{.*?\n    \}\n\n    function select''', re.S)
run_replacement = '''    function showFeedback(message) {
      feedback.textContent = String(message || "");
      feedback.dataset.visible = String(Boolean(message));
    }

    async function run(entry, args = "", { originalComposerText = "" } = {}) {
      if (!entry || search.disabled) return { ok: false };
      search.disabled = true;
      showFeedback("");
      try {
        const result = await callbacks.execute(entry.name, args);
        if (!result?.ok) {
          showFeedback(result?.reason || `/${entry.name} could not run`);
          if (originalComposerText) {
            callbacks.setComposerText(originalComposerText);
            callbacks.getComposer()?.focus?.();
          }
          return result || { ok: false };
        }
        if (!result.keepOpen) closePalette({ restoreComposer: result.focusComposer !== false });
        return result;
      } catch (error) {
        const reason = String(error?.message || error || `/${entry.name} failed`);
        showFeedback(reason);
        if (originalComposerText) callbacks.setComposerText(originalComposerText);
        return { ok: false, reason };
      } finally {
        search.disabled = false;
      }
    }

    function select'''
command_ui = read("command-ui.js")
command_ui, count = run_pattern.subn(run_replacement, command_ui, count=1)
if count != 1:
    raise RuntimeError(f"Expected one command UI run replacement, found {count}")
write("command-ui.js", command_ui)
replace_once(
    "command-ui.js",
    '''      if (entry.args && !argumentCommand) {''',
    '''      if (Commands.requiresArgs(entry.name) && !argumentCommand) {''',
)
replace_once(
    "command-ui.js",
    '''      pauseButton.textContent = currentWorkflow.status === "paused" ? "Resume" : "Pause";
      pauseButton.disabled = !["running", "paused"].includes(currentWorkflow.status);''',
    '''      pauseButton.textContent = ["paused", "blocked"].includes(currentWorkflow.status) ? "Resume" : "Pause";
      pauseButton.disabled = !["running", "paused", "blocked"].includes(currentWorkflow.status);''',
)
replace_once(
    "command-ui.js",
    '''            callbacks.setComposerText("");
            run(invocation.command, invocation.args);''',
    '''            const originalComposerText = composerText;
            callbacks.setComposerText("");
            run(invocation.command, invocation.args, { originalComposerText });''',
)
replace_once(
    "command-ui.js",
    '''      if (!open) return;
      if (event.key === "Escape") {''',
    '''      if (!open) {
        if (event.key === "Escape" && status.dataset.open === "true") {
          event.preventDefault();
          status.dataset.open = "false";
          callbacks.getComposer()?.focus?.();
        }
        return;
      }
      if (event.key === "Escape") {''',
)

# ---------------------------------------------------------------------------
# Regression tests for each reviewed invariant.
# ---------------------------------------------------------------------------
replace_once(
    "tests/commands.test.js",
    '''  assert.equal(goal.workflow.lastAssistantFingerprint, "old");
  assert.match(Commands.workflowPrompt(goal.workflow, "initial"), /\\[YOLO:CONTINUE\\]/);''',
    '''  assert.equal(goal.workflow.lastAssistantFingerprint, "old");
  assert.equal(goal.workflow.maxIterations, Commands.MAX_ITERATIONS);
  assert.equal(goal.workflow.revision, 0);
  assert.match(Commands.workflowPrompt(goal.workflow, "initial"), /\\[YOLO:CONTINUE\\]/);''',
)
replace_once(
    "tests/commands.test.js",
    '''  assert.equal(Commands.evaluateResponse("done\\n[YOLO:DONE]"), "done");
  assert.equal(Commands.evaluateResponse("[yolo:blocked]"), "blocked");
  assert.equal(Commands.evaluateResponse("no marker"), "missing");''',
    '''  assert.equal(Commands.evaluateResponse("done\\n[YOLO:DONE]"), "done");
  assert.equal(Commands.evaluateResponse("[yolo:blocked]"), "blocked");
  assert.equal(Commands.evaluateResponse("[YOLO:DONE]\\nbut actually keep going"), "missing");
  assert.equal(Commands.evaluateResponse("no marker"), "missing");''',
)
commands_append = r'''

test("workflow revisions and runner leases normalize safely", () => {
  const workflow = Commands.normalizeWorkflow({
    revision: 7,
    kind: "goal",
    objective: "ship",
    status: "running",
    runnerId: "tab-a",
    runnerExpiresAt: 5000,
    promptFingerprint: "prompt"
  }, 1000);
  assert.equal(workflow.revision, 7);
  assert.equal(workflow.runnerId, "tab-a");
  assert.equal(workflow.promptFingerprint, "prompt");

  const paused = Commands.setWorkflowStatus(workflow, "paused", "manual", 2000);
  assert.equal(paused.runnerId, "");
  assert.equal(paused.runnerExpiresAt, 0);
});
'''
if "workflow revisions and runner leases" not in read("tests/commands.test.js"):
    write("tests/commands.test.js", read("tests/commands.test.js").rstrip() + commands_append)

replace_once(
    "tests/background.test.js",
    '''    workflow: { kind: "goal", objective: "Ship it", status: "running", maxIterations: 5 }
  }, sender);''',
    '''    expectedRevision: 0,
    workflow: { kind: "goal", objective: "Ship it", status: "running", maxIterations: 5 }
  }, sender);''',
)
replace_once(
    "tests/background.test.js",
    '''  const cleared = await invoke({ type: "YOLO_WORKFLOW_CLEAR", pageId }, sender);
  assert.equal(cleared.workflow.status, "idle");''',
    '''  const stale = await invoke({
    type: "YOLO_WORKFLOW_SET",
    pageId,
    expectedRevision: 0,
    workflow: { kind: "goal", objective: "stale overwrite", status: "running" }
  }, sender);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "workflow.conflict");

  const claimed = await invoke({ type: "YOLO_WORKFLOW_CLAIM", pageId, ownerId: "tab-a" }, sender);
  assert.equal(claimed.ok, true);
  assert.equal(claimed.workflow.runnerId, "tab-a");
  const competing = await invoke({ type: "YOLO_WORKFLOW_CLAIM", pageId, ownerId: "tab-b" }, sender);
  assert.equal(competing.ok, false);
  assert.equal(competing.code, "workflow.busy");

  const cleared = await invoke({
    type: "YOLO_WORKFLOW_CLEAR",
    pageId,
    expectedRevision: claimed.workflow.revision
  }, sender);
  assert.equal(cleared.workflow.status, "idle");
  assert.equal(cleared.workflow.revision, claimed.workflow.revision + 1);''',
)

platforms_append = r'''

test("reads the latest ChatGPT user prompt for workflow ownership", () => {
  const first = { textContent: "manual prompt" };
  const second = { textContent: "workflow prompt" };
  const documentLike = {
    querySelectorAll(selector) {
      return selector === "user" ? [first, second] : [];
    }
  };
  assert.equal(Platforms.latestUserText({ userSelectors: ["user"] }, documentLike), "workflow prompt");
});
'''
if "latest ChatGPT user prompt" not in read("tests/platforms.test.js"):
    write("tests/platforms.test.js", read("tests/platforms.test.js").rstrip() + platforms_append)

queue_append = r'''

test("queue completion records exact command workflow identity", () => {
  let state = Queue.addItem(Queue.freshState(1000), {
    text: "workflow prompt",
    source: "workflow:goal",
    sourceId: "goal-1"
  }, { id: "workflow-item", at: 1001 }).state;
  const claim = Queue.claimNext(state, "owner", { at: 1100 });
  const completed = Queue.completeClaim(claim.state, "workflow-item", claim.item.claimToken, 1200);
  assert.equal(completed.ok, true);
  assert.equal(completed.state.lastCompletedItemId, "workflow-item");
  assert.equal(completed.state.lastCompletedSource, "workflow:goal");
  assert.equal(completed.state.lastCompletedSourceId, "goal-1");

  const duplicate = Queue.completeClaim(completed.state, "workflow-item", claim.item.claimToken, 1201);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.alreadyCompleted, true);
  const unknown = Queue.completeClaim(completed.state, "other-item", "missing", 1202);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "queue.not_found");
});
'''
if "records exact command workflow identity" not in read("tests/queue.test.js"):
    write("tests/queue.test.js", read("tests/queue.test.js").rstrip() + queue_append)

ui_append = r'''

test("command workflow runtime enforces ownership, CAS, and a single runner", () => {
  const runtime = read("command-runtime.js");
  assert.match(runtime, /expectedRevision: normalized\.revision/);
  assert.match(runtime, /YOLO_WORKFLOW_CLAIM/);
  assert.match(runtime, /latestUserFingerprint\(\) !== workflow\.promptFingerprint/);
  assert.match(runtime, /lastCompletedItemId === workflow\.pendingItemId/);
  assert.doesNotMatch(runtime, /lastSentAt >= workflow\.lastPromptAt/);
});

test("command palette preserves failed direct commands and exposes feedback", () => {
  const source = read("command-ui.js");
  assert.match(source, /role", "status"/);
  assert.match(source, /originalComposerText/);
  assert.match(source, /Commands\.requiresArgs\(entry\.name\)/);
  assert.match(source, /\["paused", "blocked"\]\.includes\(currentWorkflow\.status\)/);
});
'''
if "single runner" not in read("tests/ui.test.js"):
    write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + ui_append)

print("Adversarial command workflow review fixes applied")
