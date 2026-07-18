const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content-storage.js"), "utf8");

function createMockConfig(version = "1.1.0-test") {
  return {
    VERSION: version,
    STORAGE_KEYS: Object.freeze({
      global: "yoloGlobal",
      pages: "yoloPageSettings",
      counters: "yoloCounters",
      lastAction: "yoloLastAction",
      runtime: "yoloRuntimeV1",
      queues: "yoloQueuesV1",
      templates: "yoloTemplatesV1",
      actionGuards: "yoloActionGuardsV1",
      portableRevision: "yoloPortableRevisionV1"
    }),
    lastActionKey(id) {
      return `yoloLastAction:${encodeURIComponent(String(id || ""))}`;
    }
  };
}

function createMockShared({ failContext = false, storageGetData = {}, sendResponse = null, sendResponses = null } = {}) {
  const calls = { storageGet: [], storageSet: [], sendMessage: [] };
  let sendIndex = 0;

  function handleContextError(options) {
    if (!failContext) return null;
    const error = new Error("context invalidated");
    if (options?.onContextInvalidated) options.onContextInvalidated(error);
    return error;
  }

  const Shared = {
    storageGet(keys, options = {}) {
      if (options.isDestroyed?.()) return Promise.resolve({});
      calls.storageGet.push({ keys, options });
      const error = handleContextError(options);
      if (error) return options.soft ? Promise.resolve({}) : Promise.reject(error);
      return Promise.resolve({ ...storageGetData });
    },
    storageSet(items, options = {}) {
      if (options.isDestroyed?.()) return Promise.resolve(false);
      calls.storageSet.push({ items, options });
      const error = handleContextError(options);
      if (error) return options.soft ? Promise.resolve(false) : Promise.reject(error);
      return Promise.resolve(true);
    },
    sendMessage(message, options = {}) {
      if (options.isDestroyed?.()) return Promise.resolve(null);
      calls.sendMessage.push({ message, options });
      const error = handleContextError(options);
      if (error) return options.soft ? Promise.resolve(null) : Promise.reject(error);
      const responses = sendResponses != null ? sendResponses : [sendResponse];
      const response = sendIndex < responses.length ? responses[sendIndex] : null;
      sendIndex += 1;
      return Promise.resolve(response);
    }
  };

  return { Shared, calls };
}

function createMockContentState({ pageId = "https://chatgpt.com/c/test", destroyed = false } = {}) {
  return {
    state: {
      pageId,
      destroyed,
      counters: {
        approvalsClicked: 0,
        continuesSent: 0,
        deepNudgesSent: 0,
        refreshesTriggered: 0,
        queuedMessagesSent: 0
      },
      lastAction: { message: "Idle", at: 0, level: "info", code: "idle" },
      blockedCode: "",
      blockedReason: ""
    }
  };
}

function loadContentStorage({ version = "1.1.0-test", Config, Shared, ContentState } = {}) {
  const timeouts = [];
  const finalShared = Shared ?? createMockShared().Shared;
  const context = {
    console, Date, Promise, Math, JSON, Number, Array, Object, Set, String, encodeURIComponent, decodeURIComponent,
    globalThis: undefined,
    location: { href: "https://chatgpt.com/c/test" },
    YOLOConfig: Config ?? createMockConfig(version),
    YOLOShared: finalShared,
    YOLOContentState: ContentState ?? createMockContentState({ pageId: "https://chatgpt.com/c/test" }),
    setTimeout(callback, delay) {
      timeouts.push(delay);
      callback();
      return 1;
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInNewContext(source, context, { filename: "content-storage.js" });
  return { api: context.YOLOContentStorage, context, timeouts };
}

test("exports a versioned singleton keyed on Config.VERSION", () => {
  const Config = createMockConfig("1.1.0-test");
  const first = loadContentStorage({ Config });
  vm.runInNewContext(source, first.context, { filename: "content-storage-second.js" });
  assert.equal(first.context.YOLOContentStorage, first.api);
  assert.equal(first.api.version, Config.VERSION);
});

test("setContext wires isDestroyed and onContextInvalidated hooks", async () => {
  const { Shared, calls } = createMockShared();
  const { api, context } = loadContentStorage({ Shared });
  let invalidated = false;
  api.setContext({ isDestroyed: () => true, onContextInvalidated: () => { invalidated = true; } });

  assert.equal(context.YOLOContentStorage, api);
  assert.equal(api.version, "1.1.0-test");
  const getResult = await api.storageGet(["key"]);
  assert.equal(Object.keys(getResult).length, 0);
  assert.equal(calls.storageGet.length, 0);
  assert.equal(invalidated, false);
});

test("storageGet routes to Shared with soft fail and destroyed guard returns {}", async () => {
  const { Shared, calls } = createMockShared();
  const { api } = loadContentStorage({ Shared });
  api.setContext({ isDestroyed: () => true });

  const result = await api.storageGet(["key"]);
  assert.equal(Object.keys(result).length, 0);
  assert.equal(calls.storageGet.length, 0);
});

test("storageSet routes to Shared with soft fail and destroyed guard returns false", async () => {
  const { Shared, calls } = createMockShared();
  const { api } = loadContentStorage({ Shared });
  api.setContext({ isDestroyed: () => true });

  const result = await api.storageSet({ key: "value" });
  assert.equal(result, false);
  assert.equal(calls.storageSet.length, 0);
});

test("storageGet routes to Shared and passes soft, isDestroyed, and onContextInvalidated options", async () => {
  const { Shared, calls } = createMockShared();
  const { api } = loadContentStorage({ Shared });

  const result = await api.storageGet(["a", "b"]);
  assert.equal(Object.keys(result).length, 0);
  assert.equal(calls.storageGet.length, 1);
  assert.equal(calls.storageGet[0].keys.length, 2);
  assert.equal(calls.storageGet[0].keys[0], "a");
  assert.equal(calls.storageGet[0].keys[1], "b");
  assert.equal(calls.storageGet[0].options.soft, true);
  assert.equal(typeof calls.storageGet[0].options.isDestroyed, "function");
  assert.equal(Object.prototype.hasOwnProperty.call(calls.storageGet[0].options, "onContextInvalidated"), true);
  assert.equal(calls.storageGet[0].options.onContextInvalidated, null);
});

test("storageSet routes to Shared and passes soft options", async () => {
  const { Shared, calls } = createMockShared();
  const { api } = loadContentStorage({ Shared });

  const result = await api.storageSet({ key: "value" });
  assert.equal(result, true);
  assert.equal(calls.storageSet.length, 1);
  assert.deepEqual(Object.keys(calls.storageSet[0].items), ["key"]);
  assert.equal(calls.storageSet[0].options.soft, true);
  assert.equal(typeof calls.storageSet[0].options.isDestroyed, "function");
});

test("onContextInvalidated is called on Shared runtime errors", async () => {
  const { Shared, calls } = createMockShared({ failContext: true });
  const { api } = loadContentStorage({ Shared });
  let invalidated = false;
  api.setContext({ onContextInvalidated: () => { invalidated = true; } });

  await api.storageGet(["key"]);
  assert.equal(invalidated, true);
  assert.equal(calls.storageGet.length, 1);

  invalidated = false;
  await api.storageSet({ key: "value" });
  assert.equal(invalidated, true);

  invalidated = false;
  await api.backgroundSend({ type: "TEST" });
  assert.equal(invalidated, true);
});

test("backgroundSend returns the Shared response", async () => {
  const { Shared, calls } = createMockShared({ sendResponse: { ok: true } });
  const { api } = loadContentStorage({ Shared });

  const response = await api.backgroundSend({ type: "TEST" });
  assert.equal(response.ok, true);
  assert.equal(calls.sendMessage.length, 1);
  assert.equal(calls.sendMessage[0].message.type, "TEST");
  assert.equal(calls.sendMessage[0].options.soft, true);
});

test("backgroundSend resolves null softly when destroyed", async () => {
  const { Shared, calls } = createMockShared({ sendResponse: { ok: true } });
  const { api } = loadContentStorage({ Shared });
  api.setContext({ isDestroyed: () => true });

  const response = await api.backgroundSend({ type: "TEST" });
  assert.equal(response, null);
  assert.equal(calls.sendMessage.length, 0);
});

test("backgroundSendWithRetry returns on first success", async () => {
  const { Shared, calls } = createMockShared({ sendResponses: [null, { ok: true }] });
  const { api, timeouts } = loadContentStorage({ Shared });

  const response = await api.backgroundSendWithRetry({ type: "TEST" }, 3);
  assert.equal(response.ok, true);
  assert.equal(calls.sendMessage.length, 2);
  assert.deepEqual(timeouts, [150]);
});

test("backgroundSendWithRetry backs off and returns null after exhausting attempts", async () => {
  const { Shared, calls } = createMockShared({ sendResponses: [null, null, null] });
  const { api, timeouts } = loadContentStorage({ Shared });

  const response = await api.backgroundSendWithRetry({ type: "TEST" }, 3);
  assert.equal(response, null);
  assert.equal(calls.sendMessage.length, 3);
  assert.deepEqual(timeouts, [150, 300]);
});

test("appendEvent sends YOLO_EVENT_APPEND with timestamp when not destroyed and pageId present", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState({ pageId: "https://chatgpt.com/c/test" });
  const { api } = loadContentStorage({ Shared, ContentState });

  const before = Date.now();
  await api.appendEvent("code", "message", "warning");
  const after = Date.now();

  assert.equal(calls.sendMessage.length, 1);
  assert.equal(calls.sendMessage[0].message.type, "YOLO_EVENT_APPEND");
  assert.equal(calls.sendMessage[0].message.pageId, "https://chatgpt.com/c/test");
  assert.equal(calls.sendMessage[0].message.event.code, "code");
  assert.equal(calls.sendMessage[0].message.event.message, "message");
  assert.equal(calls.sendMessage[0].message.event.level, "warning");
  assert.ok(calls.sendMessage[0].message.event.at >= before && calls.sendMessage[0].message.event.at <= after);
});

test("appendEvent is a no-op when there is no pageId", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState({ pageId: "" });
  const { api } = loadContentStorage({ Shared, ContentState });

  await api.appendEvent("code", "message");
  assert.equal(calls.sendMessage.length, 0);
});

test("appendEvent is a no-op when destroyed", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState({ pageId: "https://chatgpt.com/c/test" });
  const { api } = loadContentStorage({ Shared, ContentState });
  api.setContext({ isDestroyed: () => true });

  await api.appendEvent("code", "message");
  assert.equal(calls.sendMessage.length, 0);
});

test("setLastAction updates state and writes per-page and global keys", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState({ pageId: "https://chatgpt.com/c/test" });
  const { api, context } = loadContentStorage({ Shared, ContentState });

  const before = Date.now();
  await api.setLastAction("Working", "info", "status", false);
  const after = Date.now();

  assert.equal(ContentState.state.lastAction.message, "Working");
  assert.equal(ContentState.state.lastAction.level, "info");
  assert.equal(ContentState.state.lastAction.code, "status");
  assert.ok(ContentState.state.lastAction.at >= before && ContentState.state.lastAction.at <= after);

  assert.equal(calls.storageSet.length, 1);
  const items = calls.storageSet[0].items;
  const pageKey = `yoloLastAction:${encodeURIComponent("https://chatgpt.com/c/test")}`;
  assert.equal(Object.prototype.hasOwnProperty.call(items, pageKey), true);
  assert.equal(Object.prototype.hasOwnProperty.call(items, "yoloLastAction"), true);
  assert.equal(items[pageKey].message, "Working");
  assert.equal(items[pageKey].url, context.location.href);
  assert.equal(items[pageKey].pageId, "https://chatgpt.com/c/test");
});

test("setLastAction can append an event when logEvent is true", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState({ pageId: "https://chatgpt.com/c/test" });
  const { api } = loadContentStorage({ Shared, ContentState });

  await api.setLastAction("Done", "success", "status", true);
  assert.equal(calls.storageSet.length, 1);
  assert.equal(calls.sendMessage.length, 1);
  assert.equal(calls.sendMessage[0].message.type, "YOLO_EVENT_APPEND");
});

test("setBlocked and clearBlocked mutate state.blockedCode and state.blockedReason", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState({ pageId: "https://chatgpt.com/c/test" });
  const { api } = loadContentStorage({ Shared, ContentState });

  await api.setBlocked("composer.busy", "Composer is busy", { log: false });
  assert.equal(ContentState.state.blockedCode, "composer.busy");
  assert.equal(ContentState.state.blockedReason, "Composer is busy");
  assert.equal(calls.sendMessage.length, 0);

  await api.setBlocked("composer.busy", "Composer is busy", { log: true });
  assert.equal(calls.sendMessage.length, 0);

  await api.setBlocked("queue.paused", "Queue is paused", { log: true });
  assert.equal(calls.sendMessage.length, 1);
  assert.equal(calls.sendMessage[0].message.event.code, "queue.paused");

  api.clearBlocked("queue.");
  assert.equal(ContentState.state.blockedCode, "");
  assert.equal(ContentState.state.blockedReason, "");

  await api.setBlocked("other.code", "Other reason");
  api.clearBlocked("queue.");
  assert.equal(ContentState.state.blockedCode, "other.code");

  api.clearBlocked();
  assert.equal(ContentState.state.blockedCode, "");
});

test("incrementCounter reads, increments, persists, and updates state.counters", async () => {
  const { Shared, calls } = createMockShared({ storageGetData: { yoloCounters: { approvalsClicked: 2, continuesSent: 5 } } });
  const ContentState = createMockContentState();
  const { api } = loadContentStorage({ Shared, ContentState });

  await api.incrementCounter("approvalsClicked");

  assert.equal(ContentState.state.counters.approvalsClicked, 3);
  assert.equal(ContentState.state.counters.continuesSent, 5);
  assert.equal(calls.storageGet.length, 1);
  assert.equal(calls.storageGet[0].keys.length, 1);
  assert.equal(calls.storageGet[0].keys[0], "yoloCounters");
  assert.equal(calls.storageSet.length, 1);
  assert.equal(calls.storageSet[0].items.yoloCounters.approvalsClicked, 3);
  assert.equal(typeof calls.storageSet[0].items.yoloCounters.updatedAt, "number");
});

test("incrementCounter is a no-op for empty keys", async () => {
  const { Shared, calls } = createMockShared();
  const ContentState = createMockContentState();
  const { api } = loadContentStorage({ Shared, ContentState });

  await api.incrementCounter("");
  assert.equal(calls.storageGet.length, 0);
  assert.equal(calls.storageSet.length, 0);
});
