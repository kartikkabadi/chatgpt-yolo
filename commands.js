((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOCommands = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const MAX_OBJECTIVE_LENGTH = 4000;
  const MAX_ITERATIONS = 50;
  const DEFAULT_MAX_ITERATIONS = 12;
  const WORKFLOW_STATUSES = new Set(["idle", "running", "paused", "completed", "blocked"]);
  const WORKFLOW_KINDS = new Set(["goal", "loop"]);
  const MARKER_RE = /\[YOLO:(CONTINUE|DONE|BLOCKED)\]\s*$/i;

  const COMMANDS = Object.freeze([
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
  ]);

  const COMMAND_BY_NAME = new Map(COMMANDS.map((command) => [command.name, command]));

  const cleanText = (value, max = MAX_OBJECTIVE_LENGTH) => String(value ?? "").trim().slice(0, max);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function makeId(prefix = "workflow") {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function command(name) {
    return COMMAND_BY_NAME.get(String(name || "").toLowerCase()) || null;
  }

  function filterCommands(query = "") {
    const needle = cleanText(query, 120).replace(/^\//, "").toLowerCase();
    if (!needle) return [...COMMANDS];
    return COMMANDS
      .map((entry) => {
        const name = entry.name.toLowerCase();
        const title = entry.title.toLowerCase();
        const description = entry.description.toLowerCase();
        let score = 0;
        if (name === needle) score += 100;
        if (name.startsWith(needle)) score += 60;
        if (title.startsWith(needle)) score += 40;
        if (name.includes(needle)) score += 25;
        if (description.includes(needle)) score += 10;
        return { entry, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
      .map(({ entry }) => entry);
  }

  function parseInvocation(input) {
    const text = String(input || "").trim();
    const match = text.match(/^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/i);
    if (!match) return null;
    const entry = command(match[1]);
    if (!entry) return null;
    return { command: entry, args: cleanText(match[2] || "") };
  }

  function parseLoopArgs(input) {
    const text = cleanText(input);
    const match = text.match(/^(\d{1,3})\s+([\s\S]+)$/);
    if (!match) return { objective: text, maxIterations: DEFAULT_MAX_ITERATIONS };
    return {
      objective: cleanText(match[2]),
      maxIterations: clamp(Math.round(Number(match[1])) || DEFAULT_MAX_ITERATIONS, 1, MAX_ITERATIONS)
    };
  }

  function fingerprint(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${value.length}:${(hash >>> 0).toString(36)}`;
  }

  function freshWorkflow(at = Date.now()) {
    return {
      version: 1,
      revision: 0,
      id: "",
      kind: "",
      objective: "",
      status: "idle",
      maxIterations: DEFAULT_MAX_ITERATIONS,
      iteration: 0,
      pendingItemId: "",
      awaitingResponse: false,
      sawGeneration: false,
      baselineFingerprint: "",
      lastAssistantFingerprint: "",
      promptFingerprint: "",
      responseCandidateFingerprint: "",
      responseCandidateSince: 0,
      runnerId: "",
      runnerExpiresAt: 0,
      lastPromptAt: 0,
      lastResponseAt: 0,
      reason: "",
      createdAt: at,
      updatedAt: at
    };
  }

  function normalizeWorkflow(raw, at = Date.now()) {
    const fallback = freshWorkflow(at);
    if (!raw || typeof raw !== "object") return fallback;
    const kind = WORKFLOW_KINDS.has(raw.kind) ? raw.kind : "";
    const objective = cleanText(raw.objective);
    const status = WORKFLOW_STATUSES.has(raw.status) ? raw.status : (kind && objective ? "paused" : "idle");
    const revision = Math.max(0, Math.round(finite(raw.revision, 0)));
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
      id: cleanText(raw.id, 180) || makeId(kind),
      kind,
      objective,
      status,
      maxIterations: clamp(Math.round(finite(raw.maxIterations, DEFAULT_MAX_ITERATIONS)), 1, MAX_ITERATIONS),
      iteration: clamp(Math.round(finite(raw.iteration, 0)), 0, MAX_ITERATIONS),
      pendingItemId: cleanText(raw.pendingItemId, 180),
      awaitingResponse: Boolean(raw.awaitingResponse),
      sawGeneration: Boolean(raw.sawGeneration),
      baselineFingerprint: cleanText(raw.baselineFingerprint, 180),
      lastAssistantFingerprint: cleanText(raw.lastAssistantFingerprint, 180),
      promptFingerprint: cleanText(raw.promptFingerprint, 180),
      responseCandidateFingerprint: Boolean(raw.awaitingResponse) ? cleanText(raw.responseCandidateFingerprint, 180) : "",
      responseCandidateSince: Boolean(raw.awaitingResponse) ? Math.max(0, finite(raw.responseCandidateSince, 0)) : 0,
      runnerId: status === "running" ? cleanText(raw.runnerId, 220) : "",
      runnerExpiresAt: status === "running" ? Math.max(0, finite(raw.runnerExpiresAt, 0)) : 0,
      lastPromptAt: Math.max(0, finite(raw.lastPromptAt, 0)),
      lastResponseAt: Math.max(0, finite(raw.lastResponseAt, 0)),
      reason: cleanText(raw.reason, 500),
      createdAt: finite(raw.createdAt, at),
      updatedAt: finite(raw.updatedAt, at)
    };
  }

  function startWorkflow(kind, input, { at = Date.now(), baselineFingerprint = "" } = {}) {
    if (!WORKFLOW_KINDS.has(kind)) return { ok: false, reason: "Unsupported workflow type" };
    const parsed = kind === "loop" ? parseLoopArgs(input) : { objective: cleanText(input), maxIterations: MAX_ITERATIONS };
    if (!parsed.objective) return { ok: false, reason: `/${kind} requires an objective` };
    return {
      ok: true,
      workflow: normalizeWorkflow({
        id: makeId(kind),
        kind,
        objective: parsed.objective,
        status: "running",
        maxIterations: parsed.maxIterations,
        iteration: 0,
        baselineFingerprint,
        lastAssistantFingerprint: baselineFingerprint,
        createdAt: at,
        updatedAt: at
      }, at)
    };
  }

  function setWorkflowStatus(raw, status, reason = "", at = Date.now()) {
    const workflow = normalizeWorkflow(raw, at);
    if (workflow.status === "idle") return workflow;
    workflow.status = WORKFLOW_STATUSES.has(status) ? status : workflow.status;
    workflow.reason = cleanText(reason, 500);
    workflow.updatedAt = at;
    if (workflow.status !== "running") {
      workflow.pendingItemId = "";
      workflow.awaitingResponse = false;
      workflow.sawGeneration = false;
      workflow.responseCandidateFingerprint = "";
      workflow.responseCandidateSince = 0;
      workflow.runnerId = "";
      workflow.runnerExpiresAt = 0;
    }
    return workflow;
  }

  function goalInitialPrompt(workflow) {
    return [
      "You are now working in YOLO Goal mode.",
      `Persistent objective: ${workflow.objective}`,
      "Work toward the objective concretely. Inspect the current conversation and continue from the actual state instead of restarting or repeating prior commentary.",
      "At the very end of every response, emit exactly one control marker on its own line:",
      "[YOLO:CONTINUE] when more autonomous work remains; [YOLO:DONE] only when the objective is genuinely complete; [YOLO:BLOCKED] when specific user input or unavailable access is required.",
      "Do not emit more than one marker. Begin now."
    ].join("\n\n");
  }

  function goalContinuationPrompt(workflow) {
    return [
      `Continue YOLO Goal mode for this persistent objective: ${workflow.objective}`,
      `This is iteration ${workflow.iteration + 1} of at most ${workflow.maxIterations}.`,
      "Continue from the latest completed work. Critically inspect assumptions, close gaps, execute the next concrete steps, and validate what you change. Do not repeat the previous answer.",
      "End with exactly one marker on its own line: [YOLO:CONTINUE], [YOLO:DONE], or [YOLO:BLOCKED]."
    ].join("\n\n");
  }

  function loopInitialPrompt(workflow) {
    return [
      "You are now working in YOLO Loop mode.",
      `Loop objective: ${workflow.objective}`,
      `Maximum iterations: ${workflow.maxIterations}.`,
      "Perform one meaningful iteration now. Build on the current conversation, make concrete progress, inspect your own work, and avoid repeating prior commentary.",
      "End with [YOLO:DONE] if the objective is complete, [YOLO:BLOCKED] if user input is required, or [YOLO:CONTINUE] when another iteration would help. A missing marker is treated as continue in Loop mode."
    ].join("\n\n");
  }

  function loopContinuationPrompt(workflow) {
    return [
      `Run the next YOLO Loop iteration for: ${workflow.objective}`,
      `Iteration ${workflow.iteration + 1} of ${workflow.maxIterations}.`,
      "Continue from the latest work, find the highest-value unfinished step, execute it, and validate the result. Do not restate the objective or repeat the prior response.",
      "End with [YOLO:DONE], [YOLO:BLOCKED], or [YOLO:CONTINUE]. A missing marker is treated as continue."
    ].join("\n\n");
  }

  function workflowPrompt(raw, phase = "initial") {
    const workflow = normalizeWorkflow(raw);
    if (workflow.status === "idle") return "";
    if (workflow.kind === "goal") return phase === "initial" ? goalInitialPrompt(workflow) : goalContinuationPrompt(workflow);
    return phase === "initial" ? loopInitialPrompt(workflow) : loopContinuationPrompt(workflow);
  }

  function evaluateResponse(text) {
    const match = String(text || "").match(MARKER_RE);
    if (!match) return "missing";
    return match[1].toLowerCase();
  }

  function decideWorkflowResponse(raw, responseText, { userFingerprint = "", at = Date.now() } = {}) {
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
    workflow.responseCandidateFingerprint = "";
    workflow.responseCandidateSince = 0;
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

  function oneShotPrompt(name, args = "") {
    const scope = cleanText(args);
    if (name === "plan") {
      if (!scope) return "";
      return [
        `Plan this objective before implementation: ${scope}`,
        "Inspect the current conversation first. Produce a concrete, ordered plan with assumptions, dependencies, risks, validation criteria, and the smallest sensible execution sequence. Ask only for input that is genuinely required. Do not begin implementation yet."
      ].join("\n\n");
    }
    if (name === "review") {
      return [
        scope ? `Review scope: ${scope}` : "Review the work completed so far in this conversation.",
        "Perform an adversarial, evidence-based review. Find concrete correctness, reliability, security, UX, maintainability, and completeness issues. Prioritize findings by severity, avoid generic praise, verify assumptions against the actual work, and distinguish blockers from optional improvements."
      ].join("\n\n");
    }
    if (name === "fix") {
      return [
        scope ? `Fix scope: ${scope}` : "Fix the current work from the latest known state.",
        "Identify concrete defects and unfinished parts, repair them directly, validate the result, and continue until the scoped work is complete or a real blocker remains. Do not stop at a plan and do not repeat prior commentary."
      ].join("\n\n");
    }
    if (name === "compact") {
      return "Create a durable context handoff for this conversation. Preserve the objective, decisions, constraints, completed work, exact current state, unresolved defects, risks, relevant identifiers, validation evidence, and next actions. Remove repetition and incidental discussion. Write it so another strong agent can continue immediately without guessing.";
    }
    if (name === "continue") {
      return "Continue from the current state and keep going deeper. Do not repeat the previous answer. Critically inspect assumptions, close gaps, execute the next concrete steps toward the original objective, and validate the result.";
    }
    return "";
  }

  function requiresArgs(name) {
    return ["goal", "loop", "plan"].includes(String(name || ""));
  }

  return Object.freeze({
    COMMANDS,
    MAX_OBJECTIVE_LENGTH,
    MAX_ITERATIONS,
    DEFAULT_MAX_ITERATIONS,
    command,
    filterCommands,
    parseInvocation,
    parseLoopArgs,
    fingerprint,
    freshWorkflow,
    normalizeWorkflow,
    startWorkflow,
    setWorkflowStatus,
    workflowPrompt,
    evaluateResponse,
    decideWorkflowResponse,
    oneShotPrompt,
    requiresArgs
  });
});
