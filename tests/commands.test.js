const test = require("node:test");
const assert = require("node:assert/strict");
const Commands = require("../commands.js");

test("filters and parses the composer command catalog", () => {
  assert.equal(Commands.filterCommands("rev")[0].name, "review");
  assert.equal(Commands.parseInvocation("/goal ship the extension").command.name, "goal");
  assert.equal(Commands.parseInvocation("/goal ship the extension").args, "ship the extension");
  assert.equal(Commands.parseInvocation("hello"), null);
  assert.equal(Commands.parseInvocation("/unknown"), null);
});

test("parses bounded loop iteration counts", () => {
  assert.deepEqual(Commands.parseLoopArgs("7 review and fix"), {
    objective: "review and fix",
    maxIterations: 7
  });
  assert.equal(Commands.parseLoopArgs("99 finish it").maxIterations, Commands.MAX_ITERATIONS);
  assert.equal(Commands.parseLoopArgs("finish it").maxIterations, Commands.DEFAULT_MAX_ITERATIONS);
});

test("creates normalized persistent goal and loop workflows", () => {
  const goal = Commands.startWorkflow("goal", "Ship production", { at: 1000, baselineFingerprint: "old" });
  assert.equal(goal.ok, true);
  assert.equal(goal.workflow.kind, "goal");
  assert.equal(goal.workflow.status, "running");
  assert.equal(goal.workflow.lastAssistantFingerprint, "old");
  assert.match(Commands.workflowPrompt(goal.workflow, "initial"), /\[YOLO:CONTINUE\]/);

  const loop = Commands.startWorkflow("loop", "4 review again", { at: 1000 });
  assert.equal(loop.workflow.maxIterations, 4);
  assert.equal(loop.workflow.objective, "review again");
  assert.match(Commands.workflowPrompt(loop.workflow, "continue"), /Iteration 1 of 4/);
});

test("goal response markers are explicit and case-insensitive", () => {
  assert.equal(Commands.evaluateResponse("done\n[YOLO:DONE]"), "done");
  assert.equal(Commands.evaluateResponse("[yolo:blocked]"), "blocked");
  assert.equal(Commands.evaluateResponse("no marker"), "missing");
});

test("one-shot commands build concrete prompts", () => {
  assert.match(Commands.oneShotPrompt("plan", "ship it"), /Plan this objective/);
  assert.match(Commands.oneShotPrompt("review", "security"), /adversarial/i);
  assert.match(Commands.oneShotPrompt("fix"), /repair/i);
  assert.match(Commands.oneShotPrompt("compact"), /durable context handoff/i);
  assert.equal(Commands.oneShotPrompt("plan", ""), "");
});

test("workflow normalization fails closed for malformed state", () => {
  assert.equal(Commands.normalizeWorkflow({ kind: "goal", objective: "", status: "running" }).status, "idle");
  const paused = Commands.setWorkflowStatus(Commands.startWorkflow("goal", "test").workflow, "paused", "manual");
  assert.equal(paused.status, "paused");
  assert.equal(paused.pendingItemId, "");
  assert.equal(paused.reason, "manual");
});

test("fingerprints are stable and content-sensitive", () => {
  assert.equal(Commands.fingerprint("hello   world"), Commands.fingerprint("hello world"));
  assert.notEqual(Commands.fingerprint("hello"), Commands.fingerprint("world"));
});
