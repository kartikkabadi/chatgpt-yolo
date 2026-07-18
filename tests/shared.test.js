const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function loadShared({ crypto, chrome } = {}) {
  const context = {
    console, Date, Promise, Math, JSON, setTimeout, clearTimeout,
    crypto: crypto ?? { randomUUID: () => "test-uuid" },
    chrome,
    globalThis: undefined
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInNewContext(fs.readFileSync(path.join(root, "shared.js"), "utf8"), context, { filename: "shared.js" });
  return context.YOLOShared;
}

function mockStorage({ failGet = false, failSet = false, failRemove = false } = {}) {
  const calls = { get: [], set: [], remove: [] };
  let runtimeError = null;
  const storage = {};
  const chrome = {
    runtime: {
      get lastError() { return runtimeError; },
      set lastError(value) { runtimeError = value; }
    },
    storage: {
      local: {
        get(keys, callback) {
          calls.get.push(keys);
          const items = keys === null
            ? { ...storage }
            : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => key in storage).map((key) => [key, storage[key]]));
          runtimeError = failGet ? { message: "get failed" } : null;
          callback?.(items);
          runtimeError = null;
        },
        set(items, callback) {
          calls.set.push(Object.keys(items));
          runtimeError = failSet ? { message: "set failed" } : null;
          Object.assign(storage, items);
          callback?.();
          runtimeError = null;
        },
        remove(keys, callback) {
          calls.remove.push(keys);
          const list = Array.isArray(keys) ? keys : [keys];
          runtimeError = failRemove ? { message: "remove failed" } : null;
          for (const key of list) delete storage[key];
          callback?.();
          runtimeError = null;
        }
      }
    }
  };
  return { chrome, calls, storage };
}

test("makeId uses crypto.randomUUID when available", () => {
  const Shared = loadShared();
  assert.match(Shared.makeId("item"), /^item_test-uuid$/);
  assert.match(Shared.makeId(), /^id_test-uuid$/);
});

test("makeId falls back to timestamp + random when randomUUID is unavailable", () => {
  const Shared = loadShared({ crypto: {} });
  const id = Shared.makeId("q");
  assert.match(id, /^q_[a-z0-9]+_[a-z0-9]+$/);
});

test("errorMessage coerces errors and strings consistently", () => {
  const Shared = loadShared();
  assert.equal(Shared.errorMessage(new Error("message")), "message");
  assert.equal(Shared.errorMessage({ message: "object message" }), "object message");
  assert.equal(Shared.errorMessage("raw string"), "raw string");
  assert.equal(Shared.errorMessage(null), "");
  assert.equal(Shared.errorMessage(undefined), "");
});

test("withLock serializes tasks and recovers from failures", async () => {
  const Shared = loadShared();
  const lock = Shared.createLock();
  const order = [];
  const first = Shared.withLock(lock, async () => { order.push("a"); });
  const second = Shared.withLock(lock, async () => { order.push("b"); throw new Error("expected"); }).catch(() => {});
  const third = Shared.withLock(lock, async () => { order.push("c"); return 42; });
  await Promise.all([first, second, third]);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(await third, 42);
});

test("storage helpers reject on runtime.lastError in strict mode", async () => {
  const { chrome } = mockStorage({ failGet: true });
  const Shared = loadShared({ chrome });
  await assert.rejects(Shared.storageGet("key"), /get failed/i);
});

test("storage helpers resolve empty values softly when configured", async () => {
  const { chrome, calls } = mockStorage({ failGet: true });
  const Shared = loadShared({ chrome });
  const items = await Shared.storageGet("key", { soft: true });
  assert.equal(typeof items, "object");
  assert.equal(Object.keys(items).length, 0);
  assert.equal(calls.get.length, 1);
});

test("storageSet returns true on success and false softly on error", async () => {
  const { chrome } = mockStorage();
  const Shared = loadShared({ chrome });
  assert.equal(await Shared.storageSet({ name: "value" }), true);
  const { chrome: failChrome } = mockStorage({ failSet: true });
  const SharedFail = loadShared({ chrome: failChrome });
  await assert.rejects(SharedFail.storageSet({ name: "value" }), /set failed/i);
  assert.equal(await SharedFail.storageSet({ name: "value" }, { soft: true }), false);
});

test("storageRemove removes keys and reports errors strictly or softly", async () => {
  const { chrome, storage } = mockStorage();
  const Shared = loadShared({ chrome });
  storage.keep = "old";
  assert.equal(await Shared.storageRemove("keep"), true);
  assert.equal(storage.keep, undefined);
  const { chrome: failChrome } = mockStorage({ failRemove: true });
  const SharedFail = loadShared({ chrome: failChrome });
  await assert.rejects(SharedFail.storageRemove("keep"), /remove failed/i);
  assert.equal(await SharedFail.storageRemove("keep", { soft: true }), false);
});

test("sendMessage resolves the response when available", async () => {
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        callback?.({ ok: true, echo: message });
      }
    }
  };
  const Shared = loadShared({ chrome });
  const response = await Shared.sendMessage({ type: "TEST" });
  assert.deepEqual(response, { ok: true, echo: { type: "TEST" } });
});

test("sendMessage rejects on runtime.lastError in strict mode", async () => {
  const chrome = {
    runtime: {
      lastError: { message: "send failed" },
      sendMessage(_message, callback) { callback?.(); }
    }
  };
  const Shared = loadShared({ chrome });
  await assert.rejects(Shared.sendMessage({ type: "TEST" }), /send failed/i);
});

test("sendMessage resolves null softly on lastError", async () => {
  const chrome = {
    runtime: {
      lastError: { message: "send failed" },
      sendMessage(_message, callback) { callback?.(); }
    }
  };
  const Shared = loadShared({ chrome });
  const response = await Shared.sendMessage({ type: "TEST" }, { soft: true });
  assert.equal(response, null);
});

test("soft helpers honor destroyed guards and context invalidated callbacks", async () => {
  let invalidated = false;
  const Shared = loadShared();
  const result = await Shared.storageGet("key", {
    soft: true,
    isDestroyed: () => true,
    onContextInvalidated: () => { invalidated = true; }
  });
  assert.equal(typeof result, "object");
  assert.equal(Object.keys(result).length, 0);
  assert.equal(invalidated, false);

  const response = await Shared.sendMessage({ type: "TEST" }, {
    soft: true,
    isDestroyed: () => true,
    onContextInvalidated: () => { invalidated = true; }
  });
  assert.equal(response, null);
  assert.equal(invalidated, false);
});

test("soft storage helpers call onContextInvalidated on runtime errors", async () => {
  const { chrome } = mockStorage({ failSet: true });
  const Shared = loadShared({ chrome });
  let called = false;
  await Shared.storageSet({ a: 1 }, { soft: true, onContextInvalidated: () => { called = true; } });
  assert.equal(called, true);
});
