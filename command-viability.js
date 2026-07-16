((root, factory) => {
  const Base = typeof module === "object" && module.exports ? require("./commands.js") : root.YOLOCommands;
  const api = factory(Base);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOCommands = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Base) => {
  "use strict";

  if (!Base) return null;

  const PUBLIC_COMMANDS = Object.freeze([
    Object.freeze({ name: "goal", title: "Goal", description: "Run a bounded YOLO workflow that continues only after an explicit response marker.", args: "objective", group: "Automated workflows" }),
    Object.freeze({ name: "loop", title: "Loop", description: "Run a fixed-cap YOLO workflow; every turn requires an explicit response marker.", args: "[iterations] objective", group: "Automated workflows" }),
    Object.freeze({ name: "plan", title: "Plan", description: "Queue an ordinary planning prompt; this is not a native ChatGPT mode.", args: "objective", group: "Prompt shortcuts" }),
    Object.freeze({ name: "review", title: "Review", description: "Queue an adversarial review prompt for the current work or a supplied scope.", args: "[scope]", group: "Prompt shortcuts" }),
    Object.freeze({ name: "fix", title: "Fix", description: "Queue a prompt asking ChatGPT to repair and validate the scoped work.", args: "[scope]", group: "Prompt shortcuts" }),
    Object.freeze({ name: "handoff", title: "Handoff", description: "Queue a written context summary; it does not compact or alter ChatGPT context.", args: "[focus]", group: "Prompt shortcuts" }),
    Object.freeze({ name: "continue", title: "Continue", description: "Queue a continuation prompt, optionally emphasizing a direction.", args: "[direction]", group: "Prompt shortcuts" }),
    Object.freeze({ name: "status", title: "Status", description: "Show YOLO workflow, queue, generation, limits, and last-action state.", args: "", group: "YOLO controls" }),
    Object.freeze({ name: "pause", title: "Pause", description: "Pause the active YOLO workflow without clearing it.", args: "", group: "YOLO controls" }),
    Object.freeze({ name: "resume", title: "Resume", description: "Resume the active paused or blocked YOLO workflow.", args: "", group: "YOLO controls" }),
    Object.freeze({ name: "stop", title: "Stop workflow", description: "Stop and clear the active YOLO workflow after confirmation.", args: "", group: "YOLO controls" }),
    Object.freeze({ name: "settings", title: "Settings", description: "Open YOLO advanced settings.", args: "", group: "YOLO controls" }),
    Object.freeze({ name: "help", title: "Help", description: "Open the YOLO command palette and reference.", args: "", group: "YOLO controls" })
  ]);
  const BY_NAME = new Map(PUBLIC_COMMANDS.map((entry) => [entry.name, entry]));
  const clean = (value, max = 4000) => String(value ?? "").trim().slice(0, max);

  function command(name) {
    return BY_NAME.get(String(name || "").toLowerCase()) || null;
  }

  function filterCommands(query = "") {
    const needle = clean(query, 120).replace(/^\//, "").toLowerCase();
    if (!needle) return [...PUBLIC_COMMANDS];
    return PUBLIC_COMMANDS
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
    return entry ? { command: entry, args: clean(match[2] || "") } : null;
  }

  function handoffPrompt(scope = "") {
    return [
      scope ? `Handoff focus: ${clean(scope)}` : "Create a durable written handoff for this conversation.",
      "Preserve the objective, decisions, constraints, completed work, exact current state, unresolved defects, risks, relevant identifiers, validation evidence, and next actions. Remove repetition and incidental discussion. This is an ordinary summary prompt; it does not compact, delete, or alter ChatGPT's context."
    ].join("\n\n");
  }

  function continuationPrompt(scope = "") {
    return [
      scope ? `Continue with this emphasis: ${clean(scope)}` : "Continue from the current state and keep going deeper.",
      "Do not repeat the previous answer. Critically inspect assumptions, close gaps, execute the next concrete steps toward the original objective, and validate the result."
    ].join("\n\n");
  }

  function oneShotPrompt(name, args = "") {
    if (name === "handoff" || name === "compact") return handoffPrompt(args);
    if (name === "continue") return continuationPrompt(args);
    return Base.oneShotPrompt(name, args);
  }

  function workflowPrompt(raw, phase = "initial") {
    return Base.workflowPrompt(raw, phase)
      .replace("A missing marker is treated as continue in Loop mode.", "A missing or malformed marker pauses the workflow.")
      .replace("A missing marker is treated as continue.", "A missing or malformed marker pauses the workflow.");
  }

  function decideWorkflowResponse(raw, responseText, options = {}) {
    const outcome = Base.evaluateResponse(responseText);
    const result = Base.decideWorkflowResponse(raw, responseText, options);
    const workflow = Base.normalizeWorkflow(result.workflow || raw, options.at);
    if (workflow.kind === "loop" && outcome === "missing" && result.action === "continue") {
      return {
        workflow,
        action: "paused",
        reason: "Loop response omitted the required terminal control marker",
        code: "command.loop.marker_missing"
      };
    }
    return result;
  }

  return Object.freeze({
    ...Base,
    COMMANDS: PUBLIC_COMMANDS,
    command,
    filterCommands,
    parseInvocation,
    oneShotPrompt,
    workflowPrompt,
    decideWorkflowResponse
  });
});
