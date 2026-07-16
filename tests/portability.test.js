const test = require("node:test");
const assert = require("node:assert/strict");
const Config = require("../config.js");
const Portability = require("../portability.js");

const pageId = "https://chatgpt.com/c/portable";

function sampleBackup() {
  return {
    format: Portability.FORMAT,
    schemaVersion: Portability.SCHEMA_VERSION,
    appVersion: Config.VERSION,
    exportedAt: "2026-07-16T00:00:00.000Z",
    globalSettings: Config.globalDefaultsFromSettings(Config.DEFAULT_SETTINGS),
    pageSettings: {
      [pageId]: { ...Config.DEFAULT_SETTINGS, enabled: true, queueIntervalMinSec: -10 }
    },
    templates: [{ id: "one", name: "One", text: "portable template", builtIn: false }]
  };
}

test("portable backups contain settings and templates but never live automation state", () => {
  const storage = {
    [Config.STORAGE_KEYS.global]: { queueLimitPerHour: 17 },
    [Config.pageSettingsKey(pageId)]: { ...Config.DEFAULT_SETTINGS, enabled: true },
    [Config.STORAGE_KEYS.templates]: [{ id: "one", name: "One", text: "template text" }],
    [Config.STORAGE_KEYS.queues]: { [pageId]: { items: [{ text: "QUEUE-SECRET" }] } },
    [Config.workflowKey(pageId)]: { objective: "WORKFLOW-SECRET", status: "running" },
    [Config.STORAGE_KEYS.counters]: { secret: "COUNTER-SECRET" }
  };
  const backup = Portability.createBackup(storage, { now: Date.parse("2026-07-16T00:00:00Z") });
  const serialized = JSON.stringify(backup);
  assert.equal(backup.pageSettings[pageId].enabled, true);
  assert.equal(backup.templates.length, 1);
  assert.doesNotMatch(serialized, /QUEUE-SECRET|WORKFLOW-SECRET|COUNTER-SECRET/);
  assert.deepEqual(Object.keys(backup).sort(), ["appVersion", "exportedAt", "format", "globalSettings", "pageSettings", "schemaVersion", "templates"]);
});

test("backup validation rejects unsupported versions, invalid pages, and duplicate templates", () => {
  const future = sampleBackup();
  future.schemaVersion = 2;
  assert.throws(() => Portability.normalizeBackup(future), /schema version/);

  const invalidPage = sampleBackup();
  invalidPage.pageSettings = { "https://example.com/c/nope": Config.DEFAULT_SETTINGS };
  assert.throws(() => Portability.normalizeBackup(invalidPage), /non-ChatGPT/);

  const duplicates = sampleBackup();
  duplicates.templates.push({ id: "one", name: "Duplicate", text: "duplicate" });
  assert.throws(() => Portability.normalizeBackup(duplicates), /unique/);
});

test("backup validation normalizes settings and enforces size and collection limits", () => {
  const normalized = Portability.normalizeBackup(sampleBackup());
  assert.equal(normalized.pageSettings[pageId].queueIntervalMinSec, 0);

  const tooManyTemplates = sampleBackup();
  tooManyTemplates.templates = Array.from({ length: Portability.MAX_TEMPLATES + 1 }, (_, index) => ({
    id: `id-${index}`,
    name: `Template ${index}`,
    text: "text"
  }));
  assert.throws(() => Portability.normalizeBackup(tooManyTemplates), /Template limit/);
  assert.throws(() => Portability.normalizeBackup("x".repeat(Portability.MAX_BACKUP_BYTES + 1)), /1 MiB/);

  const tooManyPages = { [Config.STORAGE_KEYS.templates]: [] };
  for (let index = 0; index <= Portability.MAX_PAGE_SETTINGS; index += 1) {
    const id = `https://chatgpt.com/c/export-${index}`;
    tooManyPages[Config.pageSettingsKey(id)] = { enabled: false };
  }
  assert.throws(() => Portability.createBackup(tooManyPages), /Conversation setting limit/);
});

test("import payload targets only portable storage keys", () => {
  const payload = Portability.storagePayload(sampleBackup());
  assert.deepEqual(Object.keys(payload).sort(), [
    Config.STORAGE_KEYS.global,
    Config.STORAGE_KEYS.templates,
    Config.pageSettingsKey(pageId)
  ].sort());
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /yoloQueues|yoloWorkflow|yoloCounters|yoloLastAction/);
});

test("privacy-safe diagnostics redact identifiers and all user-authored text", () => {
  const diagnostics = Portability.buildDiagnostics({
    browser: "Test Browser",
    contentState: {
      version: Config.VERSION,
      platform: "ChatGPT",
      pageId,
      blockedCode: "queue.delivery_unknown",
      blockedReason: "BLOCKED-SECRET",
      lastAction: { code: "queue.failed", message: "ACTION-SECRET" },
      workflow: { objective: "OBJECTIVE-SECRET" },
      settings: { ...Config.DEFAULT_SETTINGS, profile: "safe", enabled: true },
      runtime: { sessionActionCount: 7 }
    },
    queueState: {
      paused: true,
      items: [{ state: "failed", text: "QUEUE-TEXT-SECRET", error: "ERROR-TEXT-SECRET", errorCode: "queue.delivery_unknown" }]
    }
  });
  const serialized = JSON.stringify(diagnostics);
  assert.equal(diagnostics.queue.total, 1);
  assert.equal(diagnostics.queue.stateCounts.failed, 1);
  assert.deepEqual(diagnostics.queue.errorCodes, ["queue.delivery_unknown"]);
  assert.equal(diagnostics.runtime.lastActionCode, "queue.failed");
  assert.doesNotMatch(serialized, /portable|SECRET|objective|pageId|blockedReason/i);
});
