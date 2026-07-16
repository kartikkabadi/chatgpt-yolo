const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDataBackground() {
  const storage = {};
  let listener = null;
  let failNextSet = false;
  const context = {
    console, Date, Promise, Math, JSON, URL, TextEncoder, setTimeout, clearTimeout,
    chrome: {
      runtime: {
        lastError: null,
        onMessage: { addListener(value) { listener = value; } }
      },
      storage: {
        local: {
          get(keys, callback) {
            if (keys === null) return callback({ ...storage });
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
          },
          remove(keys, callback) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
            callback?.();
          }
        }
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["config.js", "portability.js", "data-background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  const invoke = (message) => new Promise((resolve) => {
    const async = listener(message, {}, resolve);
    assert.equal(async, true);
  });
  return { invoke, storage, failStorageWrite() { failNextSet = true; } };
}

const pageId = "https://chatgpt.com/c/data-background";

function backup(overrides = {}) {
  return {
    format: "chatgpt-yolo-backup",
    schemaVersion: 1,
    appVersion: "1.0.0",
    exportedAt: "2026-07-16T00:00:00.000Z",
    globalSettings: { queueLimitPerHour: 30 },
    pageSettings: { [pageId]: { enabled: true, profile: "safe" } },
    templates: [],
    ...overrides
  };
}

test("data background exports and imports without touching live automation", async () => {
  const { invoke, storage } = loadDataBackground();
  storage.yoloGlobal = { queueLimitPerHour: 11 };
  storage[`yoloPage:${encodeURIComponent(pageId)}`] = { enabled: true };
  storage.yoloTemplatesV1 = [{ id: "one", name: "One", text: "template text" }];
  storage.yoloQueuesV1 = { [pageId]: { items: [{ text: "QUEUE-SECRET" }] } };
  storage[`yoloWorkflow:${encodeURIComponent(pageId)}`] = { objective: "WORKFLOW-SECRET" };

  const exported = await invoke({ type: "YOLODATA_EXPORT" });
  assert.equal(exported.ok, true);
  assert.doesNotMatch(JSON.stringify(exported.backup), /QUEUE-SECRET|WORKFLOW-SECRET/);

  const next = exported.backup;
  next.globalSettings.queueLimitPerHour = 23;
  next.templates = [];
  assert.equal((await invoke({ type: "YOLODATA_IMPORT_PREVIEW", backup: JSON.stringify(next) })).ok, true);
  assert.equal((await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(next) })).ok, true);
  assert.equal(storage.yoloGlobal.queueLimitPerHour, 23);
  assert.deepEqual(storage.yoloTemplatesV1, []);
  assert.equal(storage.yoloQueuesV1[pageId].items[0].text, "QUEUE-SECRET");
  assert.equal(storage[`yoloWorkflow:${encodeURIComponent(pageId)}`].objective, "WORKFLOW-SECRET");
});

test("failed imports restore previous portable storage", async () => {
  const { invoke, storage, failStorageWrite } = loadDataBackground();
  storage.yoloGlobal = { queueLimitPerHour: 9 };
  failStorageWrite();
  const response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(backup()) });
  assert.equal(response.ok, false);
  assert.equal(storage.yoloGlobal.queueLimitPerHour, 9);
  assert.equal(storage[`yoloPage:${encodeURIComponent(pageId)}`], undefined);
  assert.equal(storage.yoloTemplatesV1, undefined);
});

test("the original YOLO message namespace remains separate", () => {
  const { invoke } = loadDataBackground();
  return assert.rejects(() => Promise.race([
    invoke({ type: "YOLO_QUEUE_GET", pageId }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("ignored")), 10))
  ]), /ignored/);
});
