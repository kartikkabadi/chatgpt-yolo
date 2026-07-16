from pathlib import Path

root = Path.cwd()

def read(path):
    return (root / path).read_text(encoding="utf-8")

def write(path, content):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new))

# Deterministic template defaults: preview and apply must normalize the same file identically.
replace_once(
    "portability.js",
    '''    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: String(value.appVersion || "unknown").slice(0, 40),
      exportedAt: String(value.exportedAt || ""),
      globalSettings: Config.globalDefaultsFromSettings(
        Config.mergeSettings(Config.DEFAULT_SETTINGS, value.globalSettings)
      ),
      pageSettings,
      templates: normalizeTemplateList(value.templates, now)
    };''',
    '''    const exportedAt = String(value.exportedAt || "");
    const exportedTimestamp = Date.parse(exportedAt);
    const templateTimestamp = Number.isFinite(exportedTimestamp) ? exportedTimestamp : 0;
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: String(value.appVersion || "unknown").slice(0, 40),
      exportedAt,
      globalSettings: Config.globalDefaultsFromSettings(
        Config.mergeSettings(Config.DEFAULT_SETTINGS, value.globalSettings)
      ),
      pageSettings,
      templates: normalizeTemplateList(value.templates, templateTimestamp)
    };'''
)

replace_once(
    "portability.js",
    '''  function backupSummary(input) {''',
    '''  function portableStorageSnapshot(storage) {
    const snapshot = {};
    for (const [key, value] of Object.entries(storage || {})) {
      if (key === Config.STORAGE_KEYS.global
        || key === Config.STORAGE_KEYS.templates
        || key === Config.STORAGE_KEYS.pages
        || key.startsWith("yoloPage:")) snapshot[key] = value;
    }
    return snapshot;
  }

  function storagePlan(input, currentStorage = {}) {
    const backup = normalizeBackup(input);
    const payload = storagePayload(backup);
    const keep = new Set(Object.keys(payload));
    const removeKeys = Object.keys(portableStorageSnapshot(currentStorage))
      .filter((key) => (key === Config.STORAGE_KEYS.pages || key.startsWith("yoloPage:")) && !keep.has(key))
      .sort();
    return { backup, payload, removeKeys };
  }

  function effectiveSettings(input, pageId = "") {
    const backup = normalizeBackup(input);
    return Config.mergeSettings(
      Config.DEFAULT_SETTINGS,
      backup.globalSettings,
      pageId ? backup.pageSettings[pageId] : null
    );
  }

  function backupSummary(input) {'''
)

replace_once(
    "portability.js",
    '''    storagePayload,
    backupSummary,
    buildDiagnostics''',
    '''    storagePayload,
    portableStorageSnapshot,
    storagePlan,
    effectiveSettings,
    backupSummary,
    buildDiagnostics'''
)

# Preview/apply tracks the entire portable keyspace, deletes absent overrides, and rolls back atomically.
replace_once(
    "data-background.js",
    '''  async function createPreview(backup) {
    const payload = Portability.storagePayload(backup);
    const keys = Object.keys(payload);
    const current = await storageGet(keys);
    prunePreviews();
    const token = crypto.randomUUID();
    previews.set(token, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      backupFingerprint: stable(backup),
      storageFingerprint: stable(current),
      keys
    });
    return token;
  }''',
    '''  async function createPreview(backup) {
    const current = Portability.portableStorageSnapshot(await storageGet(null));
    prunePreviews();
    const token = crypto.randomUUID();
    previews.set(token, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      backupFingerprint: stable(backup),
      storageFingerprint: stable(current)
    });
    return token;
  }'''
)

replace_once(
    "data-background.js",
    '''        const current = await storageGet(preview.keys);
        if (stable(current) !== preview.storageFingerprint) {
          return { ok: false, reason: "YOLO settings changed after preview; review the backup again", code: "data.storage_conflict" };
        }

        const payload = Portability.storagePayload(backup);
        const previous = current;
        const missing = preview.keys.filter((key) => !Object.prototype.hasOwnProperty.call(previous, key));
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
        return { ok: true, summary: Portability.backupSummary(backup) };''',
    '''        const current = Portability.portableStorageSnapshot(await storageGet(null));
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
        return { ok: true, summary: Portability.backupSummary(backup), removedOverrides: plan.removeKeys.length };'''
)

# Imported settings refresh the active tab in memory only; they never re-persist and overwrite restored globals.
replace_once(
    "content.js",
    '''      if (message?.type === "YOLO_RUN_ACTION") {''',
    '''      if (message?.type === "YOLO_APPLY_IMPORTED_SETTINGS") {
        ensureCurrentRoute()
          .then((ready) => {
            if (!ready) throw new Error("Conversation navigation is still in progress");
            state.settings = Config.normalizeSettings(message.settings || {});
            scheduleNextRefresh(true);
            scheduleNextQueue(true);
            restartScanTimer();
            queueCycle();
            sendResponse({ ok: true, settings: state.settings, state: responseState() });
          })
          .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error), state: responseState() }));
        return true;
      }

      if (message?.type === "YOLO_RUN_ACTION") {'''
)

# The settings page exposes a small coordination API that blocks edits before flushing queued saves.
replace_once(
    "options.js",
    '''  window.addEventListener("pagehide", () => window.clearTimeout(saveTimer));''',
    '''  globalThis.YOLOOptionsController = Object.freeze({
    async beginExternalMutation() {
      setBusy(true);
      await flushScheduledSave();
      return true;
    },
    endExternalMutation() {
      setBusy(false);
    }
  });

  window.addEventListener("pagehide", () => window.clearTimeout(saveTimer));'''
)

replace_once(
    "options-portability.js",
    '''    function setBusy(next) {
      busy = next;
      exportButton.disabled = next;
      importButton.disabled = next;
      diagnosticsButton.disabled = next;
    }''',
    '''    async function setBusy(next) {
      busy = next;
      exportButton.disabled = next;
      importButton.disabled = next;
      diagnosticsButton.disabled = next;
      const controller = win.YOLOOptionsController;
      if (next) await controller?.beginExternalMutation?.();
      else controller?.endExternalMutation?.();
    }'''
)

content = read("options-portability.js")
content = content.replace('      setBusy(true);\n      setStatus("Preparing backup…");', '      await setBusy(true);\n      setStatus("Preparing backup…");')
content = content.replace('      setBusy(true);\n      setStatus("Validating backup…");', '      await setBusy(true);\n      setStatus("Validating backup…");')
content = content.replace('      setBusy(true);\n      setStatus("Preparing privacy-safe diagnostics…");', '      await setBusy(true);\n      setStatus("Preparing privacy-safe diagnostics…");')
content = content.replace('      finally { setBusy(false); }', '      finally { await setBusy(false); }')
content = content.replace('      finally { importInput.value = ""; setBusy(false); }', '      finally { importInput.value = ""; await setBusy(false); }')
write("options-portability.js", content)

replace_once(
    "options-portability.js",
    '''    async function importBackup(file) {
      if (!file || busy) return;
      if (file.size > Portability.MAX_BACKUP_BYTES) return setStatus("Backup file exceeds 1 MiB", "error");
      await setBusy(true);''',
    '''    async function importBackup(file) {
      if (!file || busy) return;
      if (file.size > Portability.MAX_BACKUP_BYTES) return setStatus("Backup file exceeds 1 MiB", "error");
      let applied = false;
      await setBusy(true);'''
)

replace_once(
    "options-portability.js",
    '''        if (!response?.ok) throw new Error(response?.reason || "Could not import YOLO data");

        const currentSettings = normalized.pageSettings[pageId];
        if (currentSettings && sourceTabId) {
          const synced = await contentSend({ type: "YOLO_SET_SETTINGS", settings: currentSettings });
          if (!synced?.ok) {
            setStatus("Backup imported. Refresh the ChatGPT tab to apply its restored settings.", "warning");
            return;
          }
        }''',
    '''        if (!response?.ok) throw new Error(response?.reason || "Could not import YOLO data");
        applied = true;

        if (sourceTabId) {
          const currentState = await contentSend({ type: "YOLO_GET_STATE" });
          const currentPageId = currentState?.pageId || pageId;
          const effectiveSettings = Portability.effectiveSettings(normalized, currentPageId);
          const synced = await contentSend({ type: "YOLO_APPLY_IMPORTED_SETTINGS", settings: effectiveSettings });
          if (!synced?.ok) {
            setStatus("Backup imported. Refreshing this page; refresh ChatGPT if its restored settings do not appear.", "warning");
            win.setTimeout(() => win.location.reload(), 1400);
            return;
          }
        }'''
)

replace_once(
    "options-portability.js",
    '''      finally { importInput.value = ""; await setBusy(false); }''',
    '''      finally {
        importInput.value = "";
        if (!applied) await setBusy(false);
      }'''
)

# Regression coverage for all five review findings.
write("tests/portability.test.js", read("tests/portability.test.js").rstrip() + r'''

test("missing template timestamps normalize deterministically across preview and apply", () => {
  const value = sampleBackup();
  delete value.templates[0].createdAt;
  delete value.templates[0].updatedAt;
  const first = Portability.normalizeBackup(value, { now: 1 });
  const second = Portability.normalizeBackup(value, { now: 999999 });
  assert.deepEqual(first, second);
  assert.equal(first.templates[0].createdAt, Date.parse(value.exportedAt));
});

test("storage plan removes stale page overrides and the legacy page map", () => {
  const stalePage = "https://chatgpt.com/c/stale";
  const current = {
    [Config.STORAGE_KEYS.global]: { queueLimitPerHour: 9 },
    [Config.STORAGE_KEYS.templates]: [],
    [Config.STORAGE_KEYS.pages]: { [stalePage]: { enabled: true } },
    [Config.pageSettingsKey(stalePage)]: { enabled: true },
    [Config.pageSettingsKey(pageId)]: { enabled: false }
  };
  const plan = Portability.storagePlan(sampleBackup(), current);
  assert.ok(plan.removeKeys.includes(Config.STORAGE_KEYS.pages));
  assert.ok(plan.removeKeys.includes(Config.pageSettingsKey(stalePage)));
  assert.ok(!plan.removeKeys.includes(Config.pageSettingsKey(pageId)));
});

test("effective imported settings use globals when the current page has no override", () => {
  const value = sampleBackup();
  value.globalSettings = { ...value.globalSettings, profile: "fast", queueLimitPerHour: 44 };
  value.pageSettings = {};
  const effective = Portability.effectiveSettings(value, "https://chatgpt.com/c/not-backed-up");
  assert.equal(effective.profile, "fast");
  assert.equal(effective.queueLimitPerHour, 44);
});
''')

write("tests/data-background.test.js", read("tests/data-background.test.js").rstrip() + r'''

test("imports delete stale page overrides while preserving live automation state", async () => {
  const { invoke, storage } = loadDataBackground();
  const stalePage = "https://chatgpt.com/c/stale-import";
  storage.yoloPageSettings = { [stalePage]: { enabled: true } };
  storage[`yoloPage:${encodeURIComponent(stalePage)}`] = { enabled: true };
  storage.yoloQueuesV1 = { [stalePage]: { items: [{ text: "KEEP-QUEUE" }] } };
  const value = backup();
  const previewToken = await preview(invoke, value);
  const response = await invoke({ type: "YOLODATA_IMPORT_APPLY", backup: JSON.stringify(value), previewToken });
  assert.equal(response.ok, true);
  assert.equal(storage.yoloPageSettings, undefined);
  assert.equal(storage[`yoloPage:${encodeURIComponent(stalePage)}`], undefined);
  assert.equal(storage.yoloQueuesV1[stalePage].items[0].text, "KEEP-QUEUE");
});
''')

options_tests = read("tests/options-portability.test.js")
options_tests = options_tests.replace('assert.match(source, /YOLO_SET_SETTINGS/);', 'assert.match(source, /YOLO_APPLY_IMPORTED_SETTINGS/);')
options_tests = options_tests.rstrip() + r'''

test("imports lock and flush settings then synchronize without persisting", () => {
  const portability = read("options-portability.js");
  const options = read("options.js");
  const content = read("content.js");
  assert.match(portability, /beginExternalMutation/);
  assert.match(portability, /if \(!applied\) await setBusy\(false\)/);
  assert.match(portability, /YOLO_APPLY_IMPORTED_SETTINGS/);
  assert.doesNotMatch(portability, /type: "YOLO_SET_SETTINGS"/);
  assert.match(options, /setBusy\(true\);[\s\S]*await flushScheduledSave\(\)/);
  const start = content.indexOf('message?.type === "YOLO_APPLY_IMPORTED_SETTINGS"');
  const end = content.indexOf('message?.type === "YOLO_RUN_ACTION"', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(content.slice(start, end), /persistSettings|storageSet/);
});
'''
write("tests/options-portability.test.js", options_tests)

print("Clean portability rebuild fixes applied")
