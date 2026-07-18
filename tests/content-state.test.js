const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content-state.js"), "utf8");

function createMockConfig() {
  const HOUR_MS = 60 * 60 * 1000;
  return {
    VERSION: "1.1.0-test",
    STORAGE_KEYS: { runtime: "yoloRuntimeV1" },
    DEFAULT_SETTINGS: Object.freeze({
      refreshIntervalMinMin: 10,
      refreshIntervalMaxMin: 20,
      queueIntervalMinSec: 20,
      queueIntervalMaxSec: 45
    }),
    pageId(url) {
      return String(url || "").split("#")[0].split("?")[0];
    },
    randomBetween(min) {
      return min;
    },
    pruneHistory(history, at = Date.now()) {
      const cutoff = at - HOUR_MS;
      return (Array.isArray(history) ? history : [])
        .filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff && timestamp <= at);
    }
  };
}

function createMockShared() {
  let counter = 0;
  return {
    makeId(prefix = "id") {
      counter += 1;
      return `${prefix}_mock_${counter}`;
    }
  };
}

function createMockPlatforms() {
  const adapter = Object.freeze({ id: "chatgpt", label: "ChatGPT" });
  return {
    adapterForLocation: () => adapter
  };
}

function createMockStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function loadContentState({ locationHref = "https://chatgpt.com/c/test", storage } = {}) {
  const Config = createMockConfig();
  const Shared = createMockShared();
  const Platforms = createMockPlatforms();
  const context = {
    console,
    Date,
    Math,
    JSON,
    Number,
    Array,
    Object,
    Promise,
    Set,
    URL,
    globalThis: undefined,
    location: { href: locationHref, hostname: "chatgpt.com" },
    sessionStorage: storage || createMockStorage(),
    YOLOConfig: Config,
    YOLOShared: Shared,
    YOLOPlatforms: Platforms
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInNewContext(source, context, { filename: "content-state.js" });
  return { api: context.YOLOContentState, context };
}

test("initial state has the expected shape and identifiers", () => {
  const { api: ContentState } = loadContentState();
  const { state } = ContentState;

  assert.equal(typeof state.ownerId, "string");
  assert.match(state.ownerId, /^content_mock_\d+$/);
  assert.equal(state.pageId, "https://chatgpt.com/c/test");
  assert.equal(state.platform?.label, "ChatGPT");
  assert.equal(state.destroyed, false);
  assert.equal(state.loaded, false);
  assert.equal(state.runtime, null);
  assert.equal(state.generationActive, false);
  assert.equal(typeof state.counters, "object");
  assert.equal(state.counters.approvalsClicked, 0);
  assert.equal(typeof state.settings, "object");
  assert.equal(state.settings.enabled, undefined);
  assert.equal(state.lastAction.code, "idle");
});

test("freshRuntime returns expected default runtime", () => {
  const { api: ContentState } = loadContentState();
  const before = Date.now();
  const runtime = ContentState.freshRuntime();
  const after = Date.now();

  assert.ok(runtime.sessionStartedAt >= before && runtime.sessionStartedAt <= after);
  assert.equal(runtime.sessionActionCount, 0);
  assert.equal(JSON.stringify(runtime.history), JSON.stringify({ approval: [], recovery: [], nudge: [], refresh: [], queue: [] }));
  assert.equal(JSON.stringify(runtime.approvalSignatures), JSON.stringify([]));
  assert.equal(runtime.lastActionAt, 0);
  assert.equal(runtime.lastRefreshAt, 0);
  assert.equal(runtime.nextRefreshAt, 0);
  assert.equal(runtime.nextQueueAt, 0);
  assert.equal(runtime.lastErrorSignature, "");
  assert.equal(runtime.lastErrorHandledAt, 0);
});

test("normalizeRuntime fills missing fields and prunes stale history", () => {
  const { api: ContentState, context } = loadContentState();
  const now = Date.now();
  const old = now - 2 * 60 * 60 * 1000;
  const fresh = ContentState.freshRuntime();

  const partial = {
    sessionActionCount: 7,
    history: {
      approval: [old, now],
      recovery: [],
      nudge: [old],
      refresh: [now],
      queue: [old, old, now]
    },
    nextQueueAt: 12345
  };

  context.sessionStorage.setItem(
    context.YOLOConfig.STORAGE_KEYS.runtime,
    JSON.stringify({ "https://chatgpt.com/c/other": partial })
  );

  const loaded = ContentState.loadRuntime("https://chatgpt.com/c/other");
  assert.equal(loaded.sessionActionCount, 7);
  assert.equal(loaded.history.approval.length, 1);
  assert.equal(loaded.history.queue.length, 1);
  assert.equal(loaded.history.refresh.length, 1);
  assert.equal(loaded.nextQueueAt, 12345);
  assert.ok(loaded.sessionStartedAt >= fresh.sessionStartedAt);
});

test("saveRuntime and loadRuntime round-trip through sessionStorage", () => {
  const storage = createMockStorage();
  const { api: ContentState } = loadContentState({ storage });
  const runtime = ContentState.freshRuntime();
  runtime.sessionActionCount = 3;
  runtime.nextQueueAt = 9999;

  ContentState.state.runtime = runtime;
  ContentState.saveRuntime();

  ContentState.state.runtime = null;
  const loaded = ContentState.loadRuntime();
  assert.equal(loaded.sessionActionCount, 3);
  assert.equal(loaded.nextQueueAt, 9999);
});

test("scheduleNextRefresh and scheduleNextQueue reset relevant runtime fields", () => {
  const { api: ContentState } = loadContentState();
  ContentState.state.runtime = ContentState.freshRuntime();

  const before = Date.now();
  ContentState.scheduleNextRefresh(true);
  ContentState.scheduleNextQueue(true);
  const after = Date.now();

  assert.ok(ContentState.state.runtime.nextRefreshAt >= before + 10 * 60 * 1000);
  assert.ok(ContentState.state.runtime.nextRefreshAt <= after + 10 * 60 * 1000);
  assert.ok(ContentState.state.runtime.nextQueueAt >= before + 20 * 1000);
  assert.ok(ContentState.state.runtime.nextQueueAt <= after + 20 * 1000);
});

test("runtimeSummary and responseState match commandApi expectations", () => {
  const { api: ContentState } = loadContentState();
  const now = Date.now();
  ContentState.state.runtime = ContentState.freshRuntime();
  ContentState.state.runtime.sessionActionCount = 2;
  ContentState.state.runtime.history.queue.push(now);
  ContentState.state.blockedReason = "busy";
  ContentState.state.blockedCode = "composer.busy";
  ContentState.state.hydrated = true;
  ContentState.state.generationActive = true;

  const summary = ContentState.runtimeSummary();
  assert.equal(summary.sessionActionCount, 2);
  assert.equal(summary.queueCountLastHour, 1);
  assert.equal(summary.blockedReason, "busy");
  assert.equal(summary.blockedCode, "composer.busy");
  assert.ok(Object.hasOwn(summary, "nextRefreshAt"));
  assert.ok(Object.hasOwn(summary, "nextQueueAt"));

  const response = ContentState.responseState();
  assert.equal(response.version, "1.1.0-test");
  assert.equal(response.pageId, "https://chatgpt.com/c/test");
  assert.equal(response.platform, "ChatGPT");
  assert.equal(response.generating, true);
  assert.equal(response.hydrated, true);
  assert.equal(response.runtime.sessionActionCount, 2);
  assert.equal(typeof response.lastAction, "object");
  assert.equal(typeof response.settings, "object");
  assert.equal(typeof response.counters, "object");
});

test("second load with the same Config.VERSION returns the existing singleton", () => {
  const { api: first, context } = loadContentState();
  // Re-run the module source in the same global context; the UMD guard should short-circuit.
  vm.runInNewContext(source, context, { filename: "content-state-second.js" });
  assert.equal(first, context.YOLOContentState);
});
