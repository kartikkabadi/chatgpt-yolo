const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");

test("popup visibly marks and disables workflow-owned queue mutations", () => {
  assert.match(source, /function workflowOwned\(item\)/);
  assert.match(source, /managed by workflow/);
  assert.match(source, /moveUp\.disabled = managed/);
  assert.match(source, /moveDown\.disabled = managed/);
  assert.match(source, /edit\.disabled = managed/);
  assert.match(source, /remove\.disabled = managed/);
  assert.match(source, /els\.clearQueue\.disabled = busy \|\| items\.length === 0 \|\| hasWorkflowItem/);
  assert.match(source, /if \(item\.state === "failed" && !managed\)/);
});

test("busy-state release re-renders durable queue restrictions", () => {
  assert.match(source, /if \(!nextBusy && contentState\) \{\s*renderQueue\(\);\s*return;/);
});

test("queue management failures are surfaced to users", () => {
  assert.match(source, /Could not reorder the queue/);
  assert.match(source, /Could not retry the message/);
  assert.match(source, /Could not change queue state/);
  assert.match(source, /Could not clear the queue/);
});
