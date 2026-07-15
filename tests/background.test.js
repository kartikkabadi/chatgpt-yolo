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
    console, Date, Promise, Math, JSON, setTimeout, clearTimeout,
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
  for (const file of ["config.js", "queue.js", "background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  const invoke = (message) => new Promise((resolve) => {
    const async = listener(message, {}, resolve);
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
