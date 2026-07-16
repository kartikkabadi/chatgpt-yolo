from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))


replace_once(
    "tests/background.test.js",
    '''  for (const file of ["config.js", "queue.js", "commands.js", "background.js"]) {''',
    '''  for (const file of ["config.js", "coordinator.js", "portable-store.js", "queue.js", "commands.js", "background.js"]) {'''
)

write("tests/background.test.js", read("tests/background.test.js").rstrip() + r'''

test("template additions are idempotent and share the portable revision", async () => {
  const { invoke, storage } = loadBackground();
  const message = {
    type: "YOLO_TEMPLATE_ADD",
    template: { id: "client-template-id", name: "Stable", text: "same mutation" }
  };
  const first = await invoke(message);
  assert.equal(first.ok, true);
  assert.equal(storage.yoloPortableRevisionV1, 1);
  const second = await invoke(message);
  assert.equal(second.ok, true);
  assert.equal(second.deduplicated, true);
  assert.equal(second.templates.length, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);
});
''')

replace_once(
    "tests/data-background.test.js",
    '''  for (const file of ["config.js", "portability.js", "data-background.js"]) {''',
    '''  for (const file of ["config.js", "portable-store.js", "portability.js", "data-background.js"]) {'''
)

replace_once(
    "tests/data-background.test.js",
    '''  const dispatch = (message, sendResponse = () => {}) => listener(message, {}, sendResponse);
  const invoke = (message) => new Promise((resolve) => assert.equal(dispatch(message, resolve), true));''',
    '''  const dispatch = (message, sendResponse = () => {}, sender = {}) => listener(message, sender, sendResponse);
  const invoke = (message, sender = {}) => new Promise((resolve) => assert.equal(dispatch(message, resolve, sender), true));'''
)

write("tests/data-background.test.js", read("tests/data-background.test.js").rstrip() + r'''

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
''')

write("tests/portable-store.test.js", r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadStore() {
  const storage = {};
  let failNextRemove = false;
  const context = {
    console, Date, Promise, Math, JSON, URL, TextEncoder, setTimeout, clearTimeout,
    chrome: {
      runtime: { lastError: null },
      storage: {
        local: {
          get(keys, callback) {
            if (keys === null) return callback({ ...storage });
            const list = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]])));
          },
          set(items, callback) {
            Object.assign(storage, items);
            callback?.();
          },
          remove(keys, callback) {
            if (failNextRemove) {
              failNextRemove = false;
              context.chrome.runtime.lastError = { message: "remove failed" };
              callback?.();
              context.chrome.runtime.lastError = null;
              return;
            }
            for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
            callback?.();
          }
        }
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["config.js", "portable-store.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  return { Store: context.YOLOPortableStore, storage, failRemove() { failNextRemove = true; } };
}

test("portable mutations serialize and increment one monotonic revision", async () => {
  const { Store, storage } = loadStore();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = Store.mutate(async ({ stored }) => {
    await gate;
    return { setItems: { value: (stored.value || 0) + 1 } };
  });
  const second = Store.mutate(({ stored }) => ({ setItems: { value: (stored.value || 0) + 1 } }));
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.revision, 1);
  assert.equal(b.revision, 2);
  assert.equal(storage.value, 2);
  assert.equal(storage.yoloPortableRevisionV1, 2);
});

test("identical portable writes are no-ops and do not invalidate previews", async () => {
  const { Store, storage } = loadStore();
  const first = await Store.mutate(() => ({ setItems: { value: { enabled: true } } }));
  const second = await Store.mutate(() => ({ setItems: { value: { enabled: true } } }));
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(first.revision, 1);
  assert.equal(second.revision, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);
});

test("a failed remove rolls back values and the revision", async () => {
  const { Store, storage, failRemove } = loadStore();
  storage.keep = "old";
  storage.removeMe = "restore-me";
  storage.yoloPortableRevisionV1 = 4;
  failRemove();
  await assert.rejects(
    Store.mutate(() => ({ setItems: { keep: "new", created: true }, removeKeys: ["removeMe"] })),
    /remove failed/i
  );
  assert.equal(storage.keep, "old");
  assert.equal(storage.removeMe, "restore-me");
  assert.equal(storage.created, undefined);
  assert.equal(storage.yoloPortableRevisionV1, 4);
});
''')

write("tests/portable-mutation-integration.test.js", r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadIntegratedBackground() {
  const storage = {};
  const listeners = [];
  let id = 0;
  const context = {
    console, Date, Promise, Math, JSON, URL, TextEncoder, setTimeout, clearTimeout,
    crypto: { randomUUID: () => `id-${++id}` },
    chrome: {
      runtime: {
        lastError: null,
        getURL: (value) => value,
        onInstalled: { addListener() {} },
        onMessage: { addListener(value) { listeners.push(value); } }
      },
      tabs: { create() {} },
      storage: {
        local: {
          get(keys, callback) {
            if (keys === null) return callback({ ...storage });
            const list = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]])));
          },
          set(items, callback) { Object.assign(storage, items); callback?.(); },
          remove(keys, callback) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
            callback?.();
          }
        }
      }
    },
    importScripts() {}
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of [
    "config.js", "coordinator.js", "portable-store.js", "queue.js", "commands.js", "background.js", "portability.js", "data-background.js"
  ]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });

  const invoke = (message, sender = {}) => new Promise((resolve, reject) => {
    let handled = false;
    for (const listener of listeners) {
      const async = listener(message, sender, resolve);
      if (async) {
        if (handled) return reject(new Error(`Multiple listeners claimed ${message.type}`));
        handled = true;
      }
    }
    if (!handled) reject(new Error(`No listener claimed ${message.type}`));
  });
  return { invoke, storage };
}

const pageId = "https://chatgpt.com/c/portable-integration";
const backup = () => ({
  format: "chatgpt-yolo-backup",
  schemaVersion: 1,
  appVersion: "1.0.0",
  exportedAt: "2026-07-16T00:00:00.000Z",
  globalSettings: { queueLimitPerHour: 30 },
  pageSettings: { [pageId]: { enabled: true, profile: "safe" } },
  templates: []
});

test("template mutation and import preview share one revision boundary", async () => {
  const { invoke, storage } = loadIntegratedBackground();
  const value = backup();
  const preview = await invoke({ type: "YOLODATA_IMPORT_PREVIEW", backup: JSON.stringify(value) });
  assert.equal(preview.ok, true);
  const added = await invoke({
    type: "YOLO_TEMPLATE_ADD",
    template: { id: "stable-template", name: "Stable", text: "Template body" }
  });
  assert.equal(added.ok, true);
  assert.equal(storage.yoloPortableRevisionV1, 1);
  const apply = await invoke({
    type: "YOLODATA_IMPORT_APPLY",
    backup: JSON.stringify(value),
    previewToken: preview.previewToken
  });
  assert.equal(apply.ok, false);
  assert.equal(apply.code, "data.storage_conflict");
});

test("settings and templates serialize through the same transaction service", async () => {
  const { invoke, storage } = loadIntegratedBackground();
  const sender = { tab: { url: pageId } };
  const [settings, template] = await Promise.all([
    invoke({ type: "YOLODATA_SETTINGS_SET", pageId, settings: { enabled: true, queueLimitPerHour: 18 } }, sender),
    invoke({ type: "YOLO_TEMPLATE_ADD", template: { id: "parallel-template", name: "Parallel", text: "Body" } })
  ]);
  assert.equal(settings.ok, true);
  assert.equal(template.ok, true);
  assert.equal(storage.yoloPortableRevisionV1, 2);
  assert.equal(storage[`yoloPage:${encodeURIComponent(pageId)}`].queueLimitPerHour, 18);
  assert.equal(storage.yoloTemplatesV1.length, 1);
});
''')

replace_once(
    "tests/portability-integration.test.js",
    '''  for (const file of ["background-wrapper.js", "data-background.js", "portability.js", "options-portability.js"]) {''',
    '''  for (const file of ["background-wrapper.js", "portable-store.js", "data-background.js", "portability.js", "options-portability.js"]) {'''
)

write("tests/portability-integration.test.js", read("tests/portability-integration.test.js").rstrip() + r'''

test("all portable mutations share the background transaction service", () => {
  const background = read("background.js");
  const dataBackground = read("data-background.js");
  const content = read("content.js");
  assert.match(background, /PortableStore\.mutate/);
  assert.match(dataBackground, /Store\.mutate/);
  assert.match(dataBackground, /YOLODATA_SETTINGS_SET/);
  assert.match(content, /type: "YOLODATA_SETTINGS_SET"/);
  const persistStart = content.indexOf("async function persistSettings");
  const persistEnd = content.indexOf("function actionLimit", persistStart);
  assert.doesNotMatch(content.slice(persistStart, persistEnd), /storageSet\(/);
});

test("template creation carries a stable client id for idempotency", () => {
  assert.match(read("options.js"), /YOLO_TEMPLATE_ADD[\s\S]*id: crypto\.randomUUID\(\)/);
});
''')
