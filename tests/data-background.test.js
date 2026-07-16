const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDataBackground() {
  const storage = {};
  let listener = null;
  let failNextSet = false;
  let id = 0;
  const context = {
    console, Date, Promise, Math, JSON, URL, TextEncoder, setTimeout, clearTimeout,
    crypto: { randomUUID: () => `preview-${++id}` },
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
  for (const file of ["config.js", "portable-store.js", "portability.js", "data-background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  const dispatch = (message, sendResponse = () => {}, sender = {}) => listener(message, sender, sendResponse);
  const invoke = (message, sender = {}) => new Promise((resolve) => assert.equal(dispatch(message, resolve, sender), true));
  return { dispatch, invoke, storage, failStorageWrite() { failNextSet = true; } };
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

async function preview(invoke, value) {
  const response = await invoke({ type: "YOLODATA_IMPORT_PREVIEW", backup: JSON.stringify(value) });
  assert.equal(response.ok, true);
  assert.match(response.previewToken, /^preview-/);
  return response.previewToken;
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
  const previewToken = await preview(invoke, next);
  const applied = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(next), previewToken });
  assert.equal(applied.ok, true);
  assert.equal(storage.yoloGlobal.queueLimitPerHour, 23);
  assert.deepEqual(storage.yoloTemplatesV1, []);
  assert.equal(storage.yoloQueuesV1[pageId].items[0].text, "QUEUE-SECRET");
  assert.equal(storage[`yoloWorkflow:${encodeURIComponent(pageId)}`].objective, "WORKFLOW-SECRET");
});

test("imports reject replay, changed files, and concurrent portable storage changes", async () => {
  const { invoke, storage } = loadDataBackground();
  storage.yoloGlobal = { queueLimitPerHour: 9 };

  const value = backup();
  let token = await preview(invoke, value);
  const changed = backup({ globalSettings: { queueLimitPerHour: 31 } });
  let response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(changed), previewToken: token });
  assert.equal(response.code, "data.backup_changed");

  token = await preview(invoke, value);
  storage.yoloGlobal = { queueLimitPerHour: 10 };
  response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(value), previewToken: token });
  assert.equal(response.code, "data.storage_conflict");

  response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(value), previewToken: token });
  assert.equal(response.code, "data.preview_expired");
});

test("failed imports restore previous portable storage", async () => {
  const { invoke, storage, failStorageWrite } = loadDataBackground();
  storage.yoloGlobal = { queueLimitPerHour: 9 };
  const value = backup();
  const previewToken = await preview(invoke, value);
  failStorageWrite();
  const response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(value), previewToken });
  assert.equal(response.ok, false);
  assert.equal(storage.yoloGlobal.queueLimitPerHour, 9);
  assert.equal(storage[`yoloPage:${encodeURIComponent(pageId)}`], undefined);
  assert.equal(storage.yoloTemplatesV1, undefined);
});

test("the original YOLO message namespace remains separate", () => {
  const { dispatch } = loadDataBackground();
  assert.equal(dispatch({ type: "YOLO_QUEUE_GET", pageId }), false);
  assert.equal(dispatch({ type: "YOLODATA_EXPORT" }), true);
});

test("imports delete stale page overrides while preserving live automation state", async () => {
  const { invoke, storage } = loadDataBackground();
  const stalePage = "https://chatgpt.com/c/stale-import";
  storage.yoloPageSettings = { [stalePage]: { enabled: true } };
  storage[`yoloPage:${encodeURIComponent(stalePage)}`] = { enabled: true };
  storage.yoloQueuesV1 = { [stalePage]: { items: [{ text: "KEEP-QUEUE" }] } };
  const value = backup();
  const previewToken = await preview(invoke, value);
  const response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(value), previewToken });
  assert.equal(response.ok, true);
  assert.equal(storage.yoloPageSettings, undefined);
  assert.equal(storage[`yoloPage:${encodeURIComponent(stalePage)}`], undefined);
  assert.equal(storage.yoloQueuesV1[stalePage].items[0].text, "KEEP-QUEUE");
});

test("settings writes are revisioned, idempotent, and sender-bound", async () => {
  const { invoke, storage } = loadDataBackground();
  const message = { type: "YOLODATA_SETTINGS_SET", pageId, settings: { enabled: true, queueLimitPerHour: 19 } };
  let response = await invoke(message);
  assert.equal(response.ok, false);
  assert.equal(response.code, "data.page_mismatch");

  const sender = { tab: { url: pageId } };
  response = await invoke(message, sender);
  assert.equal(response.ok, true);
  assert.equal(response.revision, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);
  assert.equal(storage[`yoloPage:${encodeURIComponent(pageId)}`].queueLimitPerHour, 19);

  response = await invoke(message, sender);
  assert.equal(response.ok, true);
  assert.equal(response.changed, false);
  assert.equal(response.revision, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);
});

test("a normal settings mutation invalidates an import preview", async () => {
  const { invoke } = loadDataBackground();
  const value = backup();
  const token = await preview(invoke, value);
  const settings = await invoke(
    { type: "YOLODATA_SETTINGS_SET", pageId, settings: { enabled: true, queueLimitPerHour: 27 } },
    { tab: { url: pageId } }
  );
  assert.equal(settings.ok, true);
  const response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(value), previewToken: token });
  assert.equal(response.ok, false);
  assert.equal(response.code, "data.storage_conflict");
});
