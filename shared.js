((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOShared = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function makeId(prefix = "id") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function errorMessage(error, fallback = "") {
    if (error?.message) return String(error.message);
    if (error === null || error === undefined) return fallback;
    return String(error);
  }

  function createLock() {
    return { current: Promise.resolve() };
  }

  function withLock(lock, task) {
    const run = lock.current.catch(() => {}).then(task);
    lock.current = run.catch(() => {});
    return run;
  }

  function lastErrorMessage(fallback = "Extension runtime error") {
    const error = typeof chrome !== "undefined" ? chrome.runtime?.lastError : undefined;
    return error ? error.message || fallback : "";
  }

  function storageGet(keys, options = {}) {
    const { soft = false, isDestroyed = () => false, onContextInvalidated = null } = options;
    return new Promise((resolve, reject) => {
      if (soft && isDestroyed()) return resolve({});
      try {
        chrome.storage.local.get(keys, (items) => {
          const message = lastErrorMessage("Extension storage read failed");
          if (message) {
            const error = new Error(message);
            if (onContextInvalidated) onContextInvalidated(error);
            if (soft) resolve({});
            else reject(error);
          } else {
            resolve(items || {});
          }
        });
      } catch (error) {
        if (onContextInvalidated) onContextInvalidated(error);
        if (soft) resolve({});
        else reject(error);
      }
    });
  }

  function storageSet(items, options = {}) {
    const { soft = false, isDestroyed = () => false, onContextInvalidated = null } = options;
    return new Promise((resolve, reject) => {
      if (soft && isDestroyed()) return resolve(false);
      try {
        chrome.storage.local.set(items, () => {
          const message = lastErrorMessage("Extension storage write failed");
          if (message) {
            const error = new Error(message);
            if (onContextInvalidated) onContextInvalidated(error);
            if (soft) resolve(false);
            else reject(error);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        if (onContextInvalidated) onContextInvalidated(error);
        if (soft) resolve(false);
        else reject(error);
      }
    });
  }

  function storageRemove(keys, options = {}) {
    const { soft = false, isDestroyed = () => false, onContextInvalidated = null } = options;
    return new Promise((resolve, reject) => {
      if (soft && isDestroyed()) return resolve(false);
      try {
        chrome.storage.local.remove(keys, () => {
          const message = lastErrorMessage("Extension storage remove failed");
          if (message) {
            const error = new Error(message);
            if (onContextInvalidated) onContextInvalidated(error);
            if (soft) resolve(false);
            else reject(error);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        if (onContextInvalidated) onContextInvalidated(error);
        if (soft) resolve(false);
        else reject(error);
      }
    });
  }

  function sendMessage(message, options = {}) {
    const { soft = false, isDestroyed = () => false, onContextInvalidated = null } = options;
    return new Promise((resolve, reject) => {
      if (soft && isDestroyed()) return resolve(null);
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = lastErrorMessage("Extension message failed");
          if (runtimeError) {
            const error = new Error(runtimeError);
            if (onContextInvalidated) onContextInvalidated(error);
            if (soft) resolve(null);
            else reject(error);
          } else {
            resolve(response || null);
          }
        });
      } catch (error) {
        if (onContextInvalidated) onContextInvalidated(error);
        if (soft) resolve(null);
        else reject(error);
      }
    });
  }

  return Object.freeze({
    makeId,
    errorMessage,
    createLock,
    withLock,
    storageGet,
    storageSet,
    storageRemove,
    sendMessage
  });
});
