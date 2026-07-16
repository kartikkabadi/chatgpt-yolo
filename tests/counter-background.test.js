const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCounters() {
  const storage = {};
  let listener = null;
  let failNextSet = false;
  const context = {
    console, Date, Promise, Math, JSON, Number, setTimeout, clearTimeout,
    chrome: {
      runtime: {
        lastError: null,
        onMessage: { addListener(value) { listener = value; } }
      },
      storage: {
        local: {
          get(keys, callback) {
            const list = Array.isArray(keys) ? keys : [keys];
            queueMicrotask(() => callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]]))));
          },
          set(items, callback) {
            queueMicrotask(() => {
              if (failNextSet) {
                failNextSet = false;
                context.chrome.runtime.lastError = { message: "quota exceeded" };
                callback?.();
                context.chrome.runtime.lastError = null;
                return;
              }
              Object.assign(storage, items);
              callback?.();
            });
          }
        }
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["config.js", "counter-background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  const dispatch = (message, sendResponse = () => {}) => listener(message, {}, sendResponse);
  const invoke = (message) => new Promise((resolve) => assert.equal(dispatch(message, resolve), true));
  return { dispatch, invoke, storage, failStorageWrite() { failNextSet = true; } };
}

test("counter increments are serialized without lost updates", async () => {
  const { invoke, storage } = loadCounters();
  const results = await Promise.all(Array.from({ length: 100 }, () => invoke({
    type: "YOLOCOUNTER_INCREMENT",
    counterKey: "queuedMessagesSent"
  })));
  assert.equal(results.every((result) => result.ok), true);
  assert.equal(storage.yoloCounters.queuedMessagesSent, 100);
  assert.equal(storage.yoloCounters.approvalsClicked, 0);
  assert.ok(storage.yoloCounters.updatedAt > 0);
});

test("counter service rejects unknown keys and namespaces", async () => {
  const { dispatch, invoke, storage } = loadCounters();
  assert.equal(dispatch({ type: "YOLO_QUEUE_GET" }), false);
  const response = await invoke({ type: "YOLOCOUNTER_INCREMENT", counterKey: "arbitrary" });
  assert.equal(response.ok, false);
  assert.equal(response.code, "counter.key_invalid");
  assert.equal(storage.yoloCounters, undefined);
});

test("counter storage failures are reported without false acknowledgement", async () => {
  const { invoke, storage, failStorageWrite } = loadCounters();
  failStorageWrite();
  const response = await invoke({
    type: "YOLOCOUNTER_INCREMENT",
    counterKey: "approvalsClicked"
  });
  assert.equal(response.ok, false);
  assert.equal(response.code, "counter.storage_failed");
  assert.match(response.reason, /quota exceeded/i);
  assert.equal(storage.yoloCounters, undefined);
});
