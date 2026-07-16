const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackground() {
  const storage = {};
  let listener = null;
  let failNextSet = false;
  const context = {
    console, Date, Promise, Math, JSON, URL, setTimeout, clearTimeout,
    crypto: { randomUUID: () => `id-${Math.random()}` },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onMessage: { addListener(value) { listener = value; } }
      },
      storage: {
        local: {
          get(keys, callback) {
            if (keys === null) {
              callback({ ...storage });
              return;
            }
            const list = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]])));
          },
          set(items, callback) {
            if (failNextSet) {
              failNextSet = false;
              context.chrome.runtime.lastError = { message: "quota exceeded" };
              callback?.();
              context.chrome.runtime.lastError = null;
              return;
            }
            Object.assign(storage, items);
            callback?.();
          }
        }
      }
    },
    importScripts() {}
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["config.js", "queue.js", "commands.js", "background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  const invoke = (message, sender = {}) => new Promise((resolve) => {
    const async = listener(message, sender, resolve);
    assert.equal(async, true);
  });
  return { invoke, storage, failStorageWrite() { failNextSet = true; } };
}

test("background serializes queue mutations and claim lifecycle", async () => {
  const { invoke } = loadBackground();
  const pageId = "https://chatgpt.com/c/test";
  let response = await invoke({ type: "YOLO_QUEUE_ADD", pageId, item: { text: "one" } });
  assert.equal(response.ok, true);
  response = await invoke({ type: "YOLO_QUEUE_ADD", pageId, item: { text: "two" } });
  assert.equal(response.state.items.length, 2);
  const claim = await invoke({ type: "YOLO_QUEUE_CLAIM", pageId, ownerId: "tab" });
  assert.equal(claim.ok, true);
  const submitting = await invoke({
    type: "YOLO_QUEUE_MARK_SUBMITTING",
    pageId,
    itemId: claim.item.id,
    claimToken: claim.item.claimToken
  });
  assert.equal(submitting.ok, true);
  assert.equal(submitting.item.claimPhase, "submitting");
  const completed = await invoke({
    type: "YOLO_QUEUE_COMPLETE",
    pageId,
    itemId: claim.item.id,
    claimToken: claim.item.claimToken
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.state.items.length, 1);
});


test("background reports storage write failures instead of acknowledging lost queue data", async () => {
  const { invoke, failStorageWrite } = loadBackground();
  failStorageWrite();
  const response = await invoke({
    type: "YOLO_QUEUE_ADD",
    pageId: "https://chatgpt.com/c/storage-failure",
    item: { text: "must not be acknowledged" }
  });
  assert.equal(response.ok, false);
  assert.match(response.reason, /quota exceeded/i);
});

test("background bounds active conversation queues and does not persist read-only visits", async () => {
  const { invoke, storage } = loadBackground();
  for (let index = 0; index < 40; index += 1) {
    const response = await invoke({ type: "YOLO_QUEUE_GET", pageId: `https://chatgpt.com/c/read-${index}` });
    assert.equal(response.ok, true);
  }
  assert.equal(storage.yoloQueuesV1, undefined);

  for (let index = 0; index < 25; index += 1) {
    const response = await invoke({
      type: "YOLO_QUEUE_ADD",
      pageId: `https://chatgpt.com/c/active-${index}`,
      item: { text: `message ${index}` }
    });
    assert.equal(response.ok, true);
  }
  const rejected = await invoke({
    type: "YOLO_QUEUE_ADD",
    pageId: "https://chatgpt.com/c/active-overflow",
    item: { text: "overflow" }
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "queue.conversation_limit");
});


test("background persists ambiguous delivery as terminal manual recovery", async () => {
  const { invoke } = loadBackground();
  const pageId = "https://chatgpt.com/c/ambiguous-delivery";
  await invoke({ type: "YOLO_QUEUE_ADD", pageId, item: { text: "send once" } });
  const claim = await invoke({ type: "YOLO_QUEUE_CLAIM", pageId, ownerId: "tab" });
  await invoke({
    type: "YOLO_QUEUE_MARK_SUBMITTING",
    pageId,
    itemId: claim.item.id,
    claimToken: claim.item.claimToken
  });
  const failed = await invoke({
    type: "YOLO_QUEUE_FAIL",
    pageId,
    itemId: claim.item.id,
    claimToken: claim.item.claimToken,
    error: "submission could not be observed",
    errorCode: "composer.unconfirmed",
    maxRetries: 5,
    backoffSec: 1,
    pauseOnFailure: false,
    deliveryAmbiguous: true
  });

  assert.equal(failed.ok, true);
  assert.equal(failed.state.items[0].state, "failed");
  assert.equal(failed.state.items[0].errorCode, "queue.delivery_unknown");
  assert.equal(failed.state.paused, true);
  const nextClaim = await invoke({ type: "YOLO_QUEUE_CLAIM", pageId, ownerId: "other-tab" });
  assert.equal(nextClaim.ok, false);
  assert.equal(nextClaim.code, "queue.paused");
});

test("tab-backed queue messages must match the sender conversation", async () => {
  const { invoke } = loadBackground();
  const pageId = "https://chatgpt.com/c/sender-bound";
  await invoke({ type: "YOLO_QUEUE_ADD", pageId, item: { text: "bound" } });

  const matching = await invoke(
    { type: "YOLO_QUEUE_GET", pageId },
    { tab: { url: "https://chatgpt.com/c/sender-bound?temporary-chat=true" } }
  );
  assert.equal(matching.ok, true);

  const mismatched = await invoke(
    { type: "YOLO_QUEUE_GET", pageId },
    { tab: { url: "https://chatgpt.com/c/other" } }
  );
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.code, "queue.page_mismatch");
});

test("install-time template initialization uses the template lock", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  assert.match(source, /onInstalled[\s\S]*withLock\(templateLock/);
});

test("background persists sender-bound command workflow state", async () => {
  const { invoke } = loadBackground();
  const pageId = "https://chatgpt.com/c/workflow";
  const sender = { tab: { url: `${pageId}?temporary-chat=true` } };
  const started = await invoke({
    type: "YOLO_WORKFLOW_SET",
    pageId,
    expectedRevision: 0,
    workflow: { kind: "goal", objective: "Ship it", status: "running", maxIterations: 5 }
  }, sender);
  assert.equal(started.ok, true);
  assert.equal(started.workflow.kind, "goal");

  const loaded = await invoke({ type: "YOLO_WORKFLOW_GET", pageId }, sender);
  assert.equal(loaded.workflow.objective, "Ship it");
  assert.equal(loaded.workflow.maxIterations, 5);

  const mismatch = await invoke(
    { type: "YOLO_WORKFLOW_GET", pageId },
    { tab: { url: "https://chatgpt.com/c/other" } }
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "workflow.page_mismatch");

  const stale = await invoke({
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
  assert.equal(cleared.workflow.revision, claimed.workflow.revision + 1);
});

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
