const test = require("node:test");
const assert = require("node:assert/strict");
const Queue = require("../queue.js");

function workflowQueue() {
  return Queue.addItem(Queue.freshState(1000), {
    text: "workflow prompt",
    source: "workflow:goal",
    sourceId: "goal-a"
  }, { at: 1000 }).state;
}

test("workflow-owned queue items cannot be edited, retried, reordered, or bulk-cleared", () => {
  const state = workflowQueue();
  const item = state.items[0];
  assert.equal(Queue.isWorkflowOwned(item), true);

  for (const result of [
    Queue.updateItem(state, item.id, "modified prompt", 1100),
    Queue.retryItem({ ...state, items: [{ ...item, state: "failed" }] }, item.id, 1100),
    Queue.reorderItems(state, [item.id], 1100),
    Queue.clearItems(state, 1100)
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.code, "queue.workflow_owned");
    assert.equal(result.state.items.length, 1);
    assert.equal(result.state.items[0].text, "workflow prompt");
  }
});

test("stopping a workflow can still remove its pending queue item", () => {
  const state = workflowQueue();
  const removed = Queue.removeItem(state, state.items[0].id, 1100);
  assert.equal(removed.ok, true);
  assert.equal(removed.state.items.length, 0);
});

test("normal queue items retain their full management surface", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "one", source: "popup" }, { at: 1000 }).state;
  state = Queue.addItem(state, { text: "two", source: "popup" }, { at: 1001 }).state;
  const [one, two] = state.items;

  const edited = Queue.updateItem(state, one.id, "edited", 1100);
  assert.equal(edited.ok, true);
  const reordered = Queue.reorderItems(edited.state, [two.id, one.id], 1200);
  assert.equal(reordered.ok, true);
  assert.deepEqual(reordered.state.items.map((item) => item.id), [two.id, one.id]);
  const cleared = Queue.clearItems(reordered.state, 1300);
  assert.equal(cleared.ok, true);
  assert.equal(cleared.state.items.length, 0);
});
