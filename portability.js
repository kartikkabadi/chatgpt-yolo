((root, factory) => {
  const Config = typeof module === "object" && module.exports ? require("./config.js") : root.YOLOConfig;
  const api = factory(Config);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOPortability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Config) => {
  "use strict";

  const FORMAT = "chatgpt-yolo-backup";
  const SCHEMA_VERSION = 1;
  const MAX_BACKUP_BYTES = 1024 * 1024;
  const MAX_PAGE_SETTINGS = 100;
  const MAX_TEMPLATES = 50;

  function plainObject(value) {
    return Boolean(value)
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.prototype.toString.call(value) === "[object Object]";
  }

  function failUnless(condition, message) {
    if (!condition) throw new Error(message);
  }

  function byteLength(value) {
    const text = String(value || "");
    if (typeof TextEncoder === "function") return new TextEncoder().encode(text).byteLength;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return text.length;
  }

  function canonicalPageId(value) {
    const pageId = String(value || "").trim();
    failUnless(pageId.length > 0 && pageId.length <= 1000, "Invalid conversation identifier");
    failUnless(Config.isSupportedUrl(pageId), "Backup contains a non-ChatGPT conversation identifier");
    failUnless(Config.pageId(pageId) === pageId, "Backup conversation identifiers must be canonical");
    return pageId;
  }

  function normalizeTemplate(raw, index = 0, timestamp = Date.now()) {
    failUnless(plainObject(raw), `Template ${index + 1} must be an object`);
    const name = String(raw.name || "").trim();
    const text = String(raw.text || "").trim();
    const id = String(raw.id || `imported-template-${index + 1}`).trim();
    failUnless(name.length > 0 && name.length <= 80, `Template ${index + 1} has an invalid name`);
    failUnless(text.length > 0 && text.length <= 8000, `Template ${index + 1} has invalid text`);
    failUnless(id.length > 0 && id.length <= 180, `Template ${index + 1} has an invalid id`);
    return {
      id,
      name,
      text,
      builtIn: Boolean(raw.builtIn),
      createdAt: Math.max(0, Number(raw.createdAt) || timestamp),
      updatedAt: Math.max(0, Number(raw.updatedAt) || timestamp)
    };
  }

  function portablePageSettings(storage) {
    const entries = new Map();
    const legacy = plainObject(storage?.[Config.STORAGE_KEYS.pages]) ? storage[Config.STORAGE_KEYS.pages] : {};
    for (const [rawPageId, settings] of Object.entries(legacy)) {
      try {
        entries.set(canonicalPageId(rawPageId), Config.normalizeSettings(settings));
      } catch {}
    }
    for (const [key, settings] of Object.entries(storage || {})) {
      if (!key.startsWith("yoloPage:")) continue;
      try {
        const pageId = canonicalPageId(decodeURIComponent(key.slice(9)));
        if (Config.pageSettingsKey(pageId) === key) entries.set(pageId, Config.normalizeSettings(settings));
      } catch {}
    }
    const sorted = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
    failUnless(sorted.length <= MAX_PAGE_SETTINGS, `Conversation setting limit of ${MAX_PAGE_SETTINGS} exceeded`);
    return Object.fromEntries(sorted);
  }

  function normalizeTemplateList(source, timestamp) {
    failUnless(Array.isArray(source), "Backup templates are missing or invalid");
    failUnless(source.length <= MAX_TEMPLATES, `Template limit of ${MAX_TEMPLATES} exceeded`);
    const templates = source.map((template, index) => normalizeTemplate(template, index, timestamp));
    const ids = new Set();
    for (const template of templates) {
      failUnless(!ids.has(template.id), "Template ids must be unique");
      ids.add(template.id);
    }
    return templates;
  }

  function createBackup(storage, { now = Date.now() } = {}) {
    failUnless(plainObject(storage), "Extension storage must be an object");
    const source = Array.isArray(storage[Config.STORAGE_KEYS.templates])
      ? storage[Config.STORAGE_KEYS.templates]
      : Config.DEFAULT_TEMPLATES;
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: Config.VERSION,
      exportedAt: new Date(now).toISOString(),
      globalSettings: Config.globalDefaultsFromSettings(
        Config.mergeSettings(Config.DEFAULT_SETTINGS, storage[Config.STORAGE_KEYS.global])
      ),
      pageSettings: portablePageSettings(storage),
      templates: normalizeTemplateList(source, now)
    };
  }

  function normalizeBackup(input, { now = Date.now() } = {}) {
    let value = input;
    if (typeof input === "string") {
      failUnless(byteLength(input) <= MAX_BACKUP_BYTES, "Backup file exceeds 1 MiB");
      try { value = JSON.parse(input); }
      catch { throw new Error("Backup is not valid JSON"); }
    }
    failUnless(plainObject(value), "Backup must be a JSON object");
    failUnless(value.format === FORMAT, "Unsupported backup format");
    failUnless(Number(value.schemaVersion) === SCHEMA_VERSION, "Unsupported backup schema version");
    failUnless(plainObject(value.globalSettings), "Backup global settings are missing or invalid");
    failUnless(plainObject(value.pageSettings), "Backup conversation settings are missing or invalid");

    const pageEntries = Object.entries(value.pageSettings);
    failUnless(pageEntries.length <= MAX_PAGE_SETTINGS, `Conversation setting limit of ${MAX_PAGE_SETTINGS} exceeded`);
    const pageSettings = {};
    for (const [rawPageId, settings] of pageEntries) {
      const pageId = canonicalPageId(rawPageId);
      failUnless(plainObject(settings), `Settings for ${pageId} must be an object`);
      pageSettings[pageId] = Config.normalizeSettings(settings);
    }

    const exportedAt = String(value.exportedAt || "");
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
    };
  }

  function storagePayload(input) {
    const backup = normalizeBackup(input);
    const payload = {
      [Config.STORAGE_KEYS.global]: backup.globalSettings,
      [Config.STORAGE_KEYS.templates]: backup.templates
    };
    for (const [pageId, settings] of Object.entries(backup.pageSettings)) {
      payload[Config.pageSettingsKey(pageId)] = settings;
    }
    return payload;
  }

  function portableStorageSnapshot(storage) {
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

  function backupSummary(input) {
    const backup = normalizeBackup(input);
    return {
      appVersion: backup.appVersion,
      conversations: Object.keys(backup.pageSettings).length,
      templates: backup.templates.length
    };
  }

  function buildDiagnostics({ contentState = {}, queueState = {}, browser = "" } = {}) {
    const settings = Config.normalizeSettings(contentState.settings || Config.DEFAULT_SETTINGS);
    const runtime = plainObject(contentState.runtime) ? contentState.runtime : {};
    const items = Array.isArray(queueState.items) ? queueState.items : [];
    const stateCounts = {};
    const errorCodes = new Set();
    for (const item of items) {
      const state = String(item?.state || "unknown").slice(0, 40);
      stateCounts[state] = (stateCounts[state] || 0) + 1;
      if (item?.errorCode) errorCodes.add(String(item.errorCode).slice(0, 100));
    }
    return {
      format: "chatgpt-yolo-diagnostics",
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      appVersion: String(contentState.version || Config.VERSION).slice(0, 40),
      browser: String(browser || "unknown").slice(0, 240),
      platform: String(contentState.platform || "ChatGPT").slice(0, 60),
      automation: {
        enabled: Boolean(settings.enabled),
        profile: settings.profile,
        approvalPolicy: settings.approvalPolicy,
        queueAutoRunEnabled: Boolean(settings.queueAutoRunEnabled),
        approvalsEnabled: Boolean(settings.approvalsEnabled),
        errorRecoveryEnabled: Boolean(settings.errorRecoveryEnabled),
        deepNudgesEnabled: Boolean(settings.deepNudgesEnabled),
        autoRefreshEnabled: Boolean(settings.autoRefreshEnabled),
        pauseOnComposerText: Boolean(settings.pauseOnComposerText)
      },
      runtime: {
        generating: Boolean(contentState.generating),
        loaded: Boolean(contentState.pageId && contentState.settings),
        hydrated: Boolean(contentState.hydrated),
        sessionActionCount: Math.max(0, Number(runtime.sessionActionCount) || 0),
        blockedCode: String(runtime.blockedCode || contentState.blockedCode || "").slice(0, 100),
        lastActionCode: String(contentState.lastAction?.code || "").slice(0, 100)
      },
      queue: {
        paused: Boolean(queueState.paused),
        total: items.length,
        stateCounts,
        errorCodes: [...errorCodes].sort()
      }
    };
  }

  return Object.freeze({
    FORMAT,
    SCHEMA_VERSION,
    MAX_BACKUP_BYTES,
    MAX_PAGE_SETTINGS,
    MAX_TEMPLATES,
    createBackup,
    normalizeBackup,
    storagePayload,
    portableStorageSnapshot,
    storagePlan,
    effectiveSettings,
    backupSummary,
    buildDiagnostics
  });
});
