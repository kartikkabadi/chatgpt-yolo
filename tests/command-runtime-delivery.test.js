const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "command-runtime.js"), "utf8");

test("workflow sends refresh the background-owned atomic transition", () => {
  assert.match(source, /if \(workflow && sent && state\.pageId === pageId\) await refreshWorkflow\(pageId\)/);
  assert.doesNotMatch(source, /if \(workflow && sent[\s\S]{0,500}next\.pendingItemId = ""/);
});

test("failed workflow prompts are removed before the workflow blocks", () => {
  const failedBranch = source.slice(
    source.indexOf('if (item?.state === "failed")'),
    source.indexOf("if (item) {", source.indexOf('if (item?.state === "failed")'))
  );
  assert.match(failedBranch, /await removeQueueItem\(item\.id\)/);
  assert.match(failedBranch, /await markWorkflow\("blocked"/);
});

test("pending workflow recovery reads authoritative state before history fallback", () => {
  const pendingHandler = source.slice(
    source.indexOf("async function handlePendingWorkflowItem"),
    source.indexOf("async function handleWorkflow", source.indexOf("async function handlePendingWorkflowItem"))
  );
  assert.match(pendingHandler, /const refreshed = await refreshWorkflow\(\)/);
  assert.match(pendingHandler, /if \(refreshed\.awaitingResponse \|\| !refreshed\.pendingItemId\) return false/);
  assert.match(pendingHandler, /completedExactly/);
});
