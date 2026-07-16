(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Portability = globalThis.YOLOPortability;
  if (!Config || !Portability) return;

  const lock = { current: Promise.resolve() };
  const previews = new Map();
  const PREVIEW_TTL_MS = 5 * 60 * 1000;
  const MAX_PREVIEWS = 8;

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

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map((entry) => stable(entry)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function prunePreviews(now = Date.now()) {
    for (const [token, preview] of previews) if (preview.expiresAt <= now) previews.delete(token);
    while (previews.size >= MAX_PREVIEWS) previews.delete(previews.keys().next().value);
  }

  async function createPreview(backup) {
    const current = Portability.portableStorageSnapshot(await storageGet(null));
    prunePreviews();
    const token = crypto.randomUUID();
    previews.set(token, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      backupFingerprint: stable(backup),
      storageFingerprint: stable(current)
    });
    return token;
  }

  async function handle(message) {
    if (message.type === "YOLODATA_EXPORT") {
      const backup = Portability.createBackup(await storageGet(null));
      return { ok: true, backup, summary: Portability.backupSummary(backup) };
    }

    if (message.type === "YOLODATA_IMPORT_PREVIEW") {
      const backup = Portability.normalizeBackup(message.backup);
      const previewToken = await createPreview(backup);
      return { ok: true, previewToken, summary: Portability.backupSummary(backup) };
    }

    if (message.type === "YOLODATA_IMPORT_APPLY") {
      return withLock(async () => {
        prunePreviews();
        const token = String(message.previewToken || "");
        const preview = previews.get(token);
        previews.delete(token);
        if (!preview) return { ok: false, reason: "Import preview expired; choose the backup file again", code: "data.preview_expired" };

        const backup = Portability.normalizeBackup(message.backup);
        if (stable(backup) !== preview.backupFingerprint) {
          return { ok: false, reason: "Backup changed after preview; choose the file again", code: "data.backup_changed" };
        }
        const current = Portability.portableStorageSnapshot(await storageGet(null));
        if (stable(current) !== preview.storageFingerprint) {
          return { ok: false, reason: "YOLO settings changed after preview; review the backup again", code: "data.storage_conflict" };
        }

        const plan = Portability.storagePlan(backup, current);
        const previous = current;
        const createdKeys = Object.keys(plan.payload).filter((key) => !Object.prototype.hasOwnProperty.call(previous, key));
        try {
          await storageSet(plan.payload);
          if (plan.removeKeys.length) await storageRemove(plan.removeKeys);
        } catch (error) {
          try {
            if (Object.keys(previous).length) await storageSet(previous);
            if (createdKeys.length) await storageRemove(createdKeys);
          } catch {
            throw new Error(`${String(error?.message || error)}; backup rollback also failed`);
          }
          throw error;
        }
        return { ok: true, summary: Portability.backupSummary(backup), removedOverrides: plan.removeKeys.length };
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

  globalThis.YOLODataBackground = Object.freeze({ handle, stable });
})();
