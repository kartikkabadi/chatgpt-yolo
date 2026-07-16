(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  if (!Config) return;

  const COUNTER_KEYS = Object.freeze([
    "approvalsClicked",
    "continuesSent",
    "deepNudgesSent",
    "refreshesTriggered",
    "queuedMessagesSent"
  ]);
  const allowedKeys = new Set(COUNTER_KEYS);
  const lock = { current: Promise.resolve() };

  const storageGet = (keys) => new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || "Extension storage read failed"));
      else resolve(items || {});
    });
  });

  const storageSet = (items) => new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || "Extension storage write failed"));
      else resolve(true);
    });
  });

  function withLock(task) {
    const run = lock.current.catch(() => {}).then(task);
    lock.current = run.catch(() => {});
    return run;
  }

  function normalizeCounters(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const counters = {};
    for (const key of COUNTER_KEYS) {
      counters[key] = Math.max(0, Math.floor(Number(source[key]) || 0));
    }
    counters.updatedAt = Math.max(0, Number(source.updatedAt) || 0);
    return counters;
  }

  async function increment(counterKey, at = Date.now()) {
    const key = String(counterKey || "").trim();
    if (!allowedKeys.has(key)) {
      return { ok: false, reason: "Unknown counter", code: "counter.key_invalid" };
    }

    return withLock(async () => {
      const stored = await storageGet([Config.STORAGE_KEYS.counters]);
      const counters = normalizeCounters(stored[Config.STORAGE_KEYS.counters]);
      counters[key] = Math.min(Number.MAX_SAFE_INTEGER, counters[key] + 1);
      counters.updatedAt = Math.max(counters.updatedAt, Number(at) || Date.now());
      await storageSet({ [Config.STORAGE_KEYS.counters]: counters });
      return { ok: true, counters, key, value: counters[key] };
    });
  }

  function handle(message) {
    if (message.type === "YOLOCOUNTER_INCREMENT") return increment(message.counterKey, message.at);
    return Promise.resolve({ ok: false, reason: "Unknown counter operation", code: "counter.unknown" });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type?.startsWith("YOLOCOUNTER_")) return false;
    Promise.resolve(handle(message))
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error), code: "counter.storage_failed" }));
    return true;
  });

  globalThis.YOLOCounterBackground = Object.freeze({ COUNTER_KEYS, normalizeCounters, increment, handle });
})();
