from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))


write("portable-store.js", r'''((root, factory) => {
  const Config = typeof module === "object" && module.exports ? require("./config.js") : root.YOLOConfig;
  const api = factory(Config);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOPortableStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Config) => {
  "use strict";

  const lock = { current: Promise.resolve() };
  const REVISION_KEY = Config.STORAGE_KEYS.portableRevision;

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

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map((entry) => stable(entry)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function revisionOf(stored) {
    return Math.max(0, Math.floor(Number(stored?.[REVISION_KEY]) || 0));
  }

  function withLock(task) {
    const run = lock.current.catch(() => {}).then(task);
    lock.current = run.catch(() => {});
    return run;
  }

  async function readLocked(reader) {
    return withLock(async () => {
      const stored = await storageGet(null);
      const context = { stored, revision: revisionOf(stored) };
      return typeof reader === "function" ? reader(context) : context;
    });
  }

  function uniqueKeys(values) {
    return [...new Set(values.map((value) => String(value || "")).filter(Boolean))];
  }

  async function mutate(builder) {
    return withLock(async () => {
      const stored = await storageGet(null);
      const revision = revisionOf(stored);
      const plan = await builder({ stored, revision });
      if (!plan) return { ok: false, reason: "Portable mutation plan is missing", code: "data.plan_missing" };
      if (plan.ok === false) return plan;
      if (plan.mutate === false) return { ok: true, ...(plan.result || {}), revision, changed: false };

      const requestedSet = { ...(plan.setItems || {}) };
      const requestedRemove = uniqueKeys(Array.isArray(plan.removeKeys) ? plan.removeKeys : [])
        .filter((key) => key !== REVISION_KEY && !Object.prototype.hasOwnProperty.call(requestedSet, key));
      const changedSet = Object.entries(requestedSet)
        .filter(([key, value]) => stable(stored[key]) !== stable(value));
      const changedRemove = requestedRemove.filter((key) => Object.prototype.hasOwnProperty.call(stored, key));

      if (!changedSet.length && !changedRemove.length) {
        return { ok: true, ...(plan.result || {}), revision, changed: false };
      }

      const nextRevision = revision + 1;
      const setItems = Object.fromEntries(changedSet);
      setItems[REVISION_KEY] = nextRevision;
      const touchedKeys = uniqueKeys([...Object.keys(setItems), ...changedRemove]);
      const previous = Object.fromEntries(
        touchedKeys.filter((key) => Object.prototype.hasOwnProperty.call(stored, key)).map((key) => [key, stored[key]])
      );
      const createdKeys = touchedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(stored, key));

      try {
        await storageSet(setItems);
        if (changedRemove.length) await storageRemove(changedRemove);
      } catch (error) {
        try {
          if (Object.keys(previous).length) await storageSet(previous);
          if (createdKeys.length) await storageRemove(createdKeys);
        } catch {
          throw new Error(`${String(error?.message || error)}; portable rollback also failed`);
        }
        throw error;
      }

      return { ok: true, ...(plan.result || {}), revision: nextRevision, changed: true };
    });
  }

  return Object.freeze({
    REVISION_KEY,
    stable,
    revisionOf,
    read: readLocked,
    mutate
  });
});
''')

write("data-background.js", r'''(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Portability = globalThis.YOLOPortability;
  const Store = globalThis.YOLOPortableStore;
  if (!Config || !Portability || !Store) return;

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
          [Config.STORAGE_KEYS.global]: Config.globalDefaultsFromSettings(settings),
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
      .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
    return true;
  });

  globalThis.YOLODataBackground = Object.freeze({ handle, stable });
})();
''')

replace_once(
    "config.js",
    '''    templates: "yoloTemplatesV1",
    actionGuards: "yoloActionGuardsV1"''',
    '''    templates: "yoloTemplatesV1",
    actionGuards: "yoloActionGuardsV1",
    portableRevision: "yoloPortableRevisionV1"'''
)

replace_once(
    "background.js",
    '''importScripts("config.js", "coordinator.js", "queue.js", "commands.js");

const Config = globalThis.YOLOConfig;
const Coordinator = globalThis.YOLOCoordinator;
const Queue = globalThis.YOLOQueue;
const Commands = globalThis.YOLOCommands;
const queueLock = { current: Promise.resolve() };
const templateLock = { current: Promise.resolve() };''',
    '''importScripts("config.js", "coordinator.js", "portable-store.js", "queue.js", "commands.js");

const Config = globalThis.YOLOConfig;
const Coordinator = globalThis.YOLOCoordinator;
const PortableStore = globalThis.YOLOPortableStore;
const Queue = globalThis.YOLOQueue;
const Commands = globalThis.YOLOCommands;
const queueLock = { current: Promise.resolve() };'''
)

old_templates = '''async function readTemplates() {
  const stored = await storageGet([Config.STORAGE_KEYS.templates]);
  const raw = stored[Config.STORAGE_KEYS.templates];
  if (Array.isArray(raw)) {
    return raw.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  }
  return Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate(template));
}

async function writeTemplates(templates) {
  const normalized = templates.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  await storageSet({ [Config.STORAGE_KEYS.templates]: normalized });
  return normalized;
}

async function handleTemplateMessage(message) {
  return withLock(templateLock, async () => {
    let templates = await readTemplates();
    const now = Date.now();
    if (message.type === "YOLO_TEMPLATES_GET") return { ok: true, templates };
    if (message.type === "YOLO_TEMPLATES_RESET") {
      templates = Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate({ ...template, createdAt: now, updatedAt: now }));
      return { ok: true, templates: await writeTemplates(templates) };
    }
    if (message.type === "YOLO_TEMPLATE_ADD") {
      if (templates.length >= 50) return { ok: false, reason: "Template limit reached" };
      const template = normalizeTemplate({ ...message.template, id: Queue.makeId("template"), createdAt: now, updatedAt: now });
      if (!template) return { ok: false, reason: "Template name and text are required" };
      templates.push(template);
      return { ok: true, templates: await writeTemplates(templates), template };
    }
    if (message.type === "YOLO_TEMPLATE_UPDATE") {
      const index = templates.findIndex((template) => template.id === message.template?.id);
      if (index < 0) return { ok: false, reason: "Template not found" };
      const template = normalizeTemplate({ ...templates[index], ...message.template, builtIn: false, updatedAt: now });
      if (!template) return { ok: false, reason: "Template name and text are required" };
      templates[index] = template;
      return { ok: true, templates: await writeTemplates(templates), template };
    }
    if (message.type === "YOLO_TEMPLATE_REMOVE") {
      const template = templates.find((entry) => entry.id === message.templateId);
      if (!template) return { ok: false, reason: "Template not found" };
      templates = templates.filter((entry) => entry.id !== message.templateId);
      return { ok: true, templates: await writeTemplates(templates) };
    }
    if (message.type === "YOLO_TEMPLATES_REORDER") {
      const order = Array.isArray(message.orderedIds) ? message.orderedIds : [];
      const byId = new Map(templates.map((template) => [template.id, template]));
      const ordered = [];
      for (const id of order) {
        if (!byId.has(id)) continue;
        ordered.push(byId.get(id));
        byId.delete(id);
      }
      for (const template of templates) if (byId.has(template.id)) ordered.push(template);
      return { ok: true, templates: await writeTemplates(ordered) };
    }
    return { ok: false, reason: "Unknown template operation" };
  });
}'''

new_templates = '''function templatesFromStorage(stored) {
  const raw = stored?.[Config.STORAGE_KEYS.templates];
  if (Array.isArray(raw)) return raw.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  return Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate(template));
}

function templateMutationPlan(message, stored) {
  let templates = templatesFromStorage(stored);
  const now = Date.now();
  if (message.type === "YOLO_TEMPLATES_RESET") {
    templates = Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate({ ...template, createdAt: now, updatedAt: now }));
    return { setItems: { [Config.STORAGE_KEYS.templates]: templates }, result: { templates } };
  }
  if (message.type === "YOLO_TEMPLATE_ADD") {
    if (templates.length >= 50) return { ok: false, reason: "Template limit reached" };
    const requestedId = String(message.template?.id || Queue.makeId("template")).trim().slice(0, 180);
    const existing = templates.find((template) => template.id === requestedId);
    if (existing) return { mutate: false, result: { templates, template: existing, deduplicated: true } };
    const template = normalizeTemplate({ ...message.template, id: requestedId, createdAt: now, updatedAt: now });
    if (!template) return { ok: false, reason: "Template name and text are required" };
    templates.push(template);
    return { setItems: { [Config.STORAGE_KEYS.templates]: templates }, result: { templates, template } };
  }
  if (message.type === "YOLO_TEMPLATE_UPDATE") {
    const index = templates.findIndex((template) => template.id === message.template?.id);
    if (index < 0) return { ok: false, reason: "Template not found" };
    const template = normalizeTemplate({ ...templates[index], ...message.template, builtIn: false, updatedAt: now });
    if (!template) return { ok: false, reason: "Template name and text are required" };
    templates[index] = template;
    return { setItems: { [Config.STORAGE_KEYS.templates]: templates }, result: { templates, template } };
  }
  if (message.type === "YOLO_TEMPLATE_REMOVE") {
    if (!templates.some((entry) => entry.id === message.templateId)) return { ok: false, reason: "Template not found" };
    templates = templates.filter((entry) => entry.id !== message.templateId);
    return { setItems: { [Config.STORAGE_KEYS.templates]: templates }, result: { templates } };
  }
  if (message.type === "YOLO_TEMPLATES_REORDER") {
    const order = Array.isArray(message.orderedIds) ? message.orderedIds : [];
    const byId = new Map(templates.map((template) => [template.id, template]));
    const ordered = [];
    for (const id of order) {
      if (!byId.has(id)) continue;
      ordered.push(byId.get(id));
      byId.delete(id);
    }
    for (const template of templates) if (byId.has(template.id)) ordered.push(template);
    return { setItems: { [Config.STORAGE_KEYS.templates]: ordered }, result: { templates: ordered } };
  }
  return { ok: false, reason: "Unknown template operation" };
}

async function handleTemplateMessage(message) {
  if (message.type === "YOLO_TEMPLATES_GET") {
    return PortableStore.read(({ stored, revision }) => ({ ok: true, templates: templatesFromStorage(stored), revision }));
  }
  return PortableStore.mutate(({ stored }) => templateMutationPlan(message, stored));
}'''

replace_once("background.js", old_templates, new_templates)

replace_once(
    "background.js",
    '''chrome.runtime.onInstalled.addListener((details) => {
  withLock(templateLock, async () => writeTemplates(await readTemplates())).catch(() => {});
  if (details?.reason === "install") {''',
    '''chrome.runtime.onInstalled.addListener((details) => {
  PortableStore.mutate(({ stored }) => Array.isArray(stored[Config.STORAGE_KEYS.templates])
    ? { mutate: false, result: { initialized: false } }
    : {
        setItems: {
          [Config.STORAGE_KEYS.templates]: Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate(template))
        },
        result: { initialized: true }
      }).catch(() => {});
  if (details?.reason === "install") {'''
)

replace_once(
    "content.js",
    '''  async function persistSettings(nextSettings) {
    if (!await ensureCurrentRoute()) throw new Error("Conversation navigation is still in progress");
    const normalized = Config.mergeSettings(state.settings, nextSettings);

    state.settings = normalized;
    scheduleNextRefresh(true);
    scheduleNextQueue(true);
    const saved = await storageSet({
      [Config.STORAGE_KEYS.global]: Config.globalDefaultsFromSettings(normalized),
      [Config.pageSettingsKey(state.pageId)]: normalized
    });
    if (!saved) throw new Error("Could not persist conversation settings");
    restartScanTimer();
    return normalized;
  }''',
    '''  async function persistSettings(nextSettings) {
    if (!await ensureCurrentRoute()) throw new Error("Conversation navigation is still in progress");
    const normalized = Config.mergeSettings(state.settings, nextSettings);
    const response = await backgroundSendWithRetry({
      type: "YOLODATA_SETTINGS_SET",
      pageId: state.pageId,
      settings: normalized
    });
    if (!response?.ok) throw new Error(response?.reason || "Could not persist conversation settings");

    state.settings = Config.normalizeSettings(response.settings || normalized);
    scheduleNextRefresh(true);
    scheduleNextQueue(true);
    restartScanTimer();
    return state.settings;
  }'''
)

replace_once(
    "content.js",
    '''      const pageChange = changes[Config.pageSettingsKey(state.pageId)];
      if (pageChange?.newValue) {
        state.settings = Config.normalizeSettings(pageChange.newValue);
        scheduleNextRefresh(true);
        scheduleNextQueue(true);
        restartScanTimer();
        queueCycle();
      }
      const actionChange = changes[Config.lastActionKey(state.pageId)];''',
    '''      const pageKey = Config.pageSettingsKey(state.pageId);
      const settingsChanged = Object.prototype.hasOwnProperty.call(changes, Config.STORAGE_KEYS.global)
        || Object.prototype.hasOwnProperty.call(changes, Config.STORAGE_KEYS.pages)
        || Object.prototype.hasOwnProperty.call(changes, pageKey);
      if (settingsChanged) {
        storageGet([Config.STORAGE_KEYS.global, Config.STORAGE_KEYS.pages, pageKey]).then((stored) => {
          if (state.destroyed) return;
          const globalSettings = stored[Config.STORAGE_KEYS.global] || {};
          const legacyPageSettings = stored[Config.STORAGE_KEYS.pages]?.[state.pageId] || {};
          const pageSettings = stored[pageKey] || legacyPageSettings;
          state.settings = Config.mergeSettings(Config.DEFAULT_SETTINGS, globalSettings, pageSettings);
          scheduleNextRefresh(true);
          scheduleNextQueue(true);
          restartScanTimer();
          queueCycle();
        });
      }
      const actionChange = changes[Config.lastActionKey(state.pageId)];'''
)

replace_once(
    "options.js",
    ''': { type: "YOLO_TEMPLATE_ADD", template: { name, text } });''',
    ''': { type: "YOLO_TEMPLATE_ADD", template: { id: crypto.randomUUID(), name, text } });'''
)

replace_once(
    "package.json",
    '"check": "node --check config.js && node --check coordinator.js && node --check queue.js',
    '"check": "node --check config.js && node --check coordinator.js && node --check portable-store.js && node --check queue.js'
)

replace_once(
    "scripts/package.mjs",
    '''  "config.js",
  "coordinator.js",
  "queue.js",''',
    '''  "config.js",
  "coordinator.js",
  "portable-store.js",
  "queue.js",'''
)
