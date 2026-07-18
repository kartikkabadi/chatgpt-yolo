((root, factory) => {
  if (!root) return;
  if (root.YOLOContentStorage?.version === root.YOLOConfig?.VERSION) return;

  const Config = root.YOLOConfig || (typeof require === "function" && require("./config.js"));
  const Shared = root.YOLOShared || (typeof require === "function" && require("./shared.js"));
  const ContentState = root.YOLOContentState || (typeof require === "function" && require("./content-state.js"));

  if (!Config || !Shared || !ContentState) return;

  const api = factory(Config, Shared, ContentState);

  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOContentStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Config, Shared, ContentState) => {
  "use strict";

  const VERSION = Config.VERSION;
  const state = ContentState.state;

  let isDestroyed = () => state.destroyed;
  let onContextInvalidated = null;

  function setContext(handlers = {}) {
    isDestroyed = handlers.isDestroyed ?? isDestroyed;
    onContextInvalidated = handlers.onContextInvalidated ?? onContextInvalidated;
  }

  const now = () => Date.now();
  const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

  function sharedOptions() {
    return { soft: true, isDestroyed, onContextInvalidated };
  }

  const storageGet = (keys) => Shared.storageGet(keys, sharedOptions());
  const storageSet = (items) => Shared.storageSet(items, sharedOptions());
  const backgroundSend = (message) => Shared.sendMessage(message, sharedOptions());

  async function backgroundSendWithRetry(message, attempts = 3) {
    for (let index = 0; index < attempts; index += 1) {
      if (isDestroyed()) return null;
      const response = await backgroundSend(message);
      if (response) return response;
      if (index < attempts - 1) await sleep(150 * (index + 1));
    }
    return null;
  }

  async function appendEvent(code, message, level = "info") {
    if (!state.pageId || state.destroyed) return;
    if (!code || !message || String(message).length > 2000) return;
    await backgroundSend({
      type: "YOLO_EVENT_APPEND",
      pageId: state.pageId,
      event: { code, message, level, at: now() }
    });
  }

  async function setLastAction(message, level = "info", code = "status", logEvent = false) {
    state.lastAction = { message, at: now(), level, code };
    const value = { ...state.lastAction, url: location.href, pageId: state.pageId };
    await storageSet({
      [Config.lastActionKey(state.pageId)]: value,
      [Config.STORAGE_KEYS.lastAction]: value
    });
    if (logEvent) await appendEvent(code, message, level);
  }

  async function setBlocked(code, message, { log = false } = {}) {
    const changed = state.blockedCode !== code || state.blockedReason !== message;
    state.blockedCode = code;
    state.blockedReason = message;
    if (log && changed) await appendEvent(code, message, "warning");
  }

  function clearBlocked(prefix = "") {
    if (!prefix || state.blockedCode.startsWith(prefix)) {
      state.blockedCode = "";
      state.blockedReason = "";
    }
  }

  async function incrementCounter(key) {
    if (!key) return;
    const stored = await storageGet([Config.STORAGE_KEYS.counters]);
    const counters = { ...(stored[Config.STORAGE_KEYS.counters] || {}) };
    counters[key] = (Number(counters[key]) || 0) + 1;
    counters.updatedAt = now();
    state.counters = { ...state.counters, ...counters };
    await storageSet({ [Config.STORAGE_KEYS.counters]: counters });
  }

  return Object.freeze({
    version: VERSION,
    VERSION,
    setContext,
    storageGet,
    storageSet,
    backgroundSend,
    backgroundSendWithRetry,
    appendEvent,
    setLastAction,
    setBlocked,
    clearBlocked,
    incrementCounter
  });
});
