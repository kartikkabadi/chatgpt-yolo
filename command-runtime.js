(() => {
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
    unregisterEngineClient: null
  };

  const now = () => Date.now();
  const engine = () => window.__YOLO_EXTENSION__?.commandApi || null;

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

  function composer() {
    return Platforms.findComposer(Platforms.adapterForLocation());
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
    return Commands.fingerprint(Platforms.latestAssistantText(Platforms.adapterForLocation()));
  }

  async function record(message, level = "info", code = "command.status", log = true) {
    const api = engine();
    if (api?.recordStatus) await api.recordStatus(message, level, code, log);
  }

  async function readWorkflow(pageId = state.pageId) {
    const response = await backgroundSend({ type: "YOLO_WORKFLOW_GET", pageId });
    return response?.ok ? Commands.normalizeWorkflow(response.workflow) : Commands.freshWorkflow();
  }

  async function writeWorkflow(workflow = state.workflow) {
    const normalized = Commands.normalizeWorkflow(workflow);
    const response = await backgroundSend({ type: "YOLO_WORKFLOW_SET", pageId: state.pageId, workflow: normalized });
    if (!response?.ok) return false;
    state.workflow = Commands.normalizeWorkflow(response.workflow);
    syncUI();
    return true;
  }

  async function clearWorkflow() {
    const response = await backgroundSend({ type: "YOLO_WORKFLOW_CLEAR", pageId: state.pageId });
    state.workflow = response?.ok ? Commands.normalizeWorkflow(response.workflow) : Commands.freshWorkflow();
    syncUI();
    return Boolean(response?.ok);
  }

  async function queueState() {
    return backgroundSend({ type: "YOLO_QUEUE_GET", pageId: state.pageId });
  }

  async function queuePrompt(text, { workflow = null, source = "command" } = {}) {
    const prompt = String(text || "").trim();
    if (!prompt) return { ok: false, reason: "Command produced an empty prompt" };
    const response = await backgroundSend({
      type: "YOLO_QUEUE_ADD",
      pageId: state.pageId,
      front: true,
      item: {
        text: prompt,
        source,
        sourceId: workflow?.id || ""
      }
    });
    if (!response?.ok) return response || { ok: false, reason: "Could not add the command prompt to the queue" };

    if (workflow) {
      workflow.pendingItemId = response.item.id;
      workflow.awaitingResponse = false;
      workflow.sawGeneration = false;
      workflow.baselineFingerprint = latestAssistantFingerprint();
      workflow.lastAssistantFingerprint = workflow.baselineFingerprint;
      workflow.lastPromptAt = now();
      workflow.reason = "Queued command prompt";
      workflow.updatedAt = now();
      state.workflow = workflow;
      if (!await writeWorkflow(workflow)) return { ok: false, reason: "Could not persist workflow delivery state" };
    }

    const api = engine();
    const sent = api ? await api.runAction("queue-next") : false;
    if (workflow && sent) {
      state.workflow.pendingItemId = "";
      state.workflow.awaitingResponse = true;
      state.workflow.sawGeneration = false;
      state.workflow.reason = "Waiting for ChatGPT";
      state.workflow.updatedAt = now();
      await writeWorkflow(state.workflow);
    }
    return { ...response, sent };
  }

  async function startWorkflow(kind, args) {
    const current = Commands.startWorkflow(kind, args, {
      at: now(),
      baselineFingerprint: latestAssistantFingerprint()
    });
    if (!current.ok) return current;
    if (state.workflow.status !== "idle" && !window.confirm(`Replace the active ${state.workflow.kind} workflow?`)) {
      return { ok: false, reason: "Existing workflow kept", keepOpen: true };
    }

    state.workflow = current.workflow;
    if (!await writeWorkflow(state.workflow)) return { ok: false, reason: "Could not persist workflow" };
    const prompt = Commands.workflowPrompt(state.workflow, "initial");
    const queued = await queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${kind}` });
    if (!queued.ok) {
      state.workflow = Commands.setWorkflowStatus(state.workflow, "blocked", queued.reason || "Could not queue workflow prompt");
      await writeWorkflow(state.workflow);
      await record(`/${kind} blocked: ${state.workflow.reason}`, "error", `command.${kind}.blocked`);
      return queued;
    }
    await record(`Started /${kind}: ${state.workflow.objective}`, "success", `command.${kind}.started`);
    return { ok: true };
  }

  async function runOneShot(name, args) {
    const prompt = Commands.oneShotPrompt(name, args);
    if (!prompt) return { ok: false, reason: `/${name} requires more detail`, keepOpen: true };
    const queued = await queuePrompt(prompt, { source: `command:${name}` });
    if (!queued.ok) {
      await record(`/${name} failed: ${queued.reason || "queue unavailable"}`, "error", `command.${name}.failed`);
      return queued;
    }
    await record(queued.sent ? `Ran /${name}` : `Queued /${name}`, "success", `command.${name}`);
    return { ok: true };
  }

  async function cancelPendingWorkflowPrompt(workflow = state.workflow) {
    if (!workflow.pendingItemId) return true;
    const response = await backgroundSend({
      type: "YOLO_QUEUE_REMOVE",
      pageId: state.pageId,
      itemId: workflow.pendingItemId
    });
    return Boolean(response?.ok || response?.code === "queue.sending" || response?.code === "queue.not_found");
  }

  async function setStatus(status, reason) {
    if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop" };
    if (status === "paused") await cancelPendingWorkflowPrompt(state.workflow);
    state.workflow = Commands.setWorkflowStatus(state.workflow, status, reason, now());
    const ok = await writeWorkflow(state.workflow);
    if (ok) await record(`${state.workflow.kind} ${status}`, status === "blocked" ? "warning" : "info", `command.workflow.${status}`);
    return { ok, reason: ok ? "" : "Could not persist workflow state" };
  }

  async function resumeWorkflow() {
    if (!["paused", "blocked"].includes(state.workflow.status)) return { ok: false, reason: "Workflow is not paused" };
    state.workflow.status = "running";
    state.workflow.reason = "Resumed by user";
    state.workflow.updatedAt = now();
    if (!await writeWorkflow(state.workflow)) return { ok: false, reason: "Could not resume workflow" };
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
      Generation: apiState.generating ? "Active" : "Idle",
      Profile: apiState.settings?.profile || "Unknown",
      "Session actions": apiState.runtime?.sessionActionCount ?? 0,
      "Last action": apiState.lastAction?.message || "Idle"
    });
    return { ok: true, focusComposer: false };
  }

  async function executeCommand(name, args = "") {
    const api = engine();
    if (!api || !await api.ensureReady()) return { ok: false, reason: "YOLO is not ready in this conversation", keepOpen: true };
    if (["goal", "loop"].includes(name)) return startWorkflow(name, args);
    if (["plan", "review", "fix", "compact", "continue"].includes(name)) return runOneShot(name, args);
    if (name === "status" || name === "queue") return showStatus();
    if (name === "pause") return setStatus("paused", "Paused by user");
    if (name === "resume") return resumeWorkflow();
    if (name === "clear") {
      if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop" };
      if (!window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) return { ok: false, keepOpen: true };
      await cancelPendingWorkflowPrompt(state.workflow);
      const ok = await clearWorkflow();
      if (ok) await record("Cleared command workflow", "info", "command.workflow.cleared");
      return { ok };
    }
    if (name === "settings") {
      chrome.runtime.openOptionsPage?.();
      return { ok: true, focusComposer: false };
    }
    if (name === "help") {
      state.ui?.open();
      return { ok: true, keepOpen: true, focusComposer: false };
    }
    return { ok: false, reason: "Unknown command" };
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
    state.workflow = Commands.setWorkflowStatus(state.workflow, status, reason, now());
    await writeWorkflow(state.workflow);
    await record(`${state.workflow.kind} ${status}: ${reason}`, status === "completed" ? "success" : "warning", code);
  }

  async function processResponse() {
    const workflow = Commands.normalizeWorkflow(state.workflow);
    const text = Platforms.latestAssistantText(Platforms.adapterForLocation());
    const fingerprint = Commands.fingerprint(text);
    if (!text || fingerprint === workflow.baselineFingerprint || fingerprint === workflow.lastAssistantFingerprint) return false;

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
      await markWorkflow("paused", "Goal response omitted the required control marker", "command.goal.marker_missing");
      return true;
    }
    if (workflow.iteration >= workflow.maxIterations) {
      state.workflow = workflow;
      await markWorkflow("completed", `Reached the ${workflow.maxIterations}-iteration safety cap`, "command.workflow.cap_reached");
      return true;
    }

    state.workflow = workflow;
    await writeWorkflow(workflow);
    const prompt = Commands.workflowPrompt(workflow, "continue");
    const queued = await queuePrompt(prompt, { workflow, source: `workflow:${workflow.kind}` });
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
          state.workflow.pendingItemId = "";
          state.workflow.awaitingResponse = true;
          state.workflow.sawGeneration = false;
          state.workflow.reason = "Waiting for ChatGPT";
          state.workflow.updatedAt = now();
          await writeWorkflow(state.workflow);
        }
      }
      return false;
    }

    if (queue.state.lastSentAt >= workflow.lastPromptAt) {
      state.workflow.pendingItemId = "";
      state.workflow.awaitingResponse = true;
      state.workflow.reason = "Waiting for ChatGPT";
      state.workflow.updatedAt = now();
      await writeWorkflow(state.workflow);
      return false;
    }

    await markWorkflow("blocked", "Workflow prompt was removed before delivery", "command.workflow.prompt_removed");
    return true;
  }

  async function handleWorkflow() {
    const workflow = Commands.normalizeWorkflow(state.workflow);
    if (workflow.status !== "running") return false;
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
        state.workflow = workflow;
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
      await syncRoute();
      await handleWorkflow();
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
      pause: () => setStatus("paused", "Paused by user"),
      resume: resumeWorkflow,
      clear: async () => {
        if (state.workflow.status !== "idle" && window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) {
          await cancelPendingWorkflowPrompt(state.workflow);
          await clearWorkflow();
        }
      },
      edit: editWorkflow,
      getComposer: composer,
      getComposerText: composerText,
      setComposerText
    });
    syncUI();
  }

  function destroy() {
    if (state.destroyed) return;
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
