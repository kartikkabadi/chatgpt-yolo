(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Shared = globalThis.YOLOShared;
  const Portability = globalThis.YOLOPortability;
  const Store = globalThis.YOLOPortableStore;
  if (!Config || !Shared || !Portability || !Store) return;

  const previews = new Map();
  const PREVIEW_TTL_MS = 5 * 60 * 1000;
  const MAX_PREVIEWS = 8;

  function stable(value) {
    return Store.stable(value);
  }

  function prunePreviews(now = Date.now()) {
    for (const [token, preview] of previews) if (preview.expiresAt <= now) previews.delete(token);
    while (previews.size >= MAX_PREVIEWS) previews.delete(previews.keys().next().value);
  }

  function senderMatchesPageId(sender, pageId) {
    if (!sender?.tab?.url || !Config.isSupportedUrl(sender.tab.url)) return false;
    return Config.pageId(sender.tab.url) === pageId;
  }

  function createPreview(backup, stored, revision) {
    const current = Portability.portableStorageSnapshot(stored);
    prunePreviews();
    const token = crypto.randomUUID();
    previews.set(token, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      backupFingerprint: stable(backup),
      storageFingerprint: stable(current),
      revision
    });
    return token;
  }

  async function handle(message, sender = {}) {
    if (message.type === "YOLODATA_EXPORT") {
      return Store.read(({ stored, revision }) => {
        const backup = Portability.createBackup(stored);
        return { ok: true, backup, summary: Portability.backupSummary(backup), revision };
      });
    }

    if (message.type === "YOLODATA_IMPORT_PREVIEW") {
      const backup = Portability.normalizeBackup(message.backup);
      return Store.read(({ stored, revision }) => ({
        ok: true,
        previewToken: createPreview(backup, stored, revision),
        summary: Portability.backupSummary(backup),
        revision
      }));
    }

    if (message.type === "YOLODATA_SETTINGS_SET") {
      const pageId = String(message.pageId || "");
      if (!Config.isDurablePageId(pageId)) {
        return { ok: false, reason: "A saved ChatGPT conversation is required", code: "data.page_invalid" };
      }
      if (!senderMatchesPageId(sender, pageId)) {
        return { ok: false, reason: "Conversation identifier does not match the sending tab", code: "data.page_mismatch" };
      }
      const settings = Config.normalizeSettings(message.settings || {});
      return Store.mutate(() => ({
        setItems: {
          [Config.pageSettingsKey(pageId)]: settings
        },
        result: { settings }
      }));
    }

    if (message.type === "YOLODATA_IMPORT_APPLY") {
      return Store.mutate(({ stored, revision }) => {
        prunePreviews();
        const token = String(message.previewToken || "");
        const preview = previews.get(token);
        previews.delete(token);
        if (!preview) return { ok: false, reason: "Import preview expired; choose the backup file again", code: "data.preview_expired" };

        const backup = Portability.normalizeBackup(message.backup);
        if (stable(backup) !== preview.backupFingerprint) {
          return { ok: false, reason: "Backup changed after preview; choose the file again", code: "data.backup_changed" };
        }
        const current = Portability.portableStorageSnapshot(stored);
        if (revision !== preview.revision || stable(current) !== preview.storageFingerprint) {
          return { ok: false, reason: "YOLO settings changed after preview; review the backup again", code: "data.storage_conflict" };
        }

        const plan = Portability.storagePlan(backup, current);
        return {
          setItems: plan.payload,
          removeKeys: plan.removeKeys,
          result: {
            summary: Portability.backupSummary(backup),
            removedOverrides: plan.removeKeys.length
          }
        };
      });
    }

    return { ok: false, reason: "Unknown data operation", code: "data.unknown" };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type?.startsWith("YOLODATA_")) return false;
    Promise.resolve(handle(message, sender))
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, reason: Shared.errorMessage(error) }));
    return true;
  });

  globalThis.YOLODataBackground = Object.freeze({ handle, stable });
})();