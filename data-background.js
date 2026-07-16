(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Portability = globalThis.YOLOPortability;
  if (!Config || !Portability) return;

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
  const storageRemove = (keys) => new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || "Extension storage remove failed"));
      else resolve(true);
    });
  });

  function withLock(task) {
    const run = lock.current.catch(() => {}).then(task);
    lock.current = run.catch(() => {});
    return run;
  }

  async function handle(message) {
    if (message.type === "YOLODATA_EXPORT") {
      const backup = Portability.createBackup(await storageGet(null));
      return { ok: true, backup, summary: Portability.backupSummary(backup) };
    }

    if (message.type === "YOLODATA_IMPORT_PREVIEW") {
      const backup = Portability.normalizeBackup(message.backup);
      return { ok: true, summary: Portability.backupSummary(backup) };
    }

    if (message.type === "YOLODATA_IMPORT_APPLY") {
      return withLock(async () => {
        const backup = Portability.normalizeBackup(message.backup);
        const payload = Portability.storagePayload(backup);
        const keys = Object.keys(payload);
        const previous = await storageGet(keys);
        const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(previous, key));
        try {
          await storageSet(payload);
        } catch (error) {
          try {
            if (Object.keys(previous).length) await storageSet(previous);
            if (missing.length) await storageRemove(missing);
          } catch {
            throw new Error(`${String(error?.message || error)}; backup rollback also failed`);
          }
          throw error;
        }
        return { ok: true, summary: Portability.backupSummary(backup) };
      });
    }

    return { ok: false, reason: "Unknown data operation" };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type?.startsWith("YOLODATA_")) return false;
    Promise.resolve(handle(message))
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
    return true;
  });

  globalThis.YOLODataBackground = Object.freeze({ handle });
})();
