((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const VERSION = "0.5.0";
  const HOUR_MS = 60 * 60 * 1000;
  const STORAGE_KEYS = Object.freeze({
    global: "yoloGlobal",
    pages: "yoloPageSettings",
    counters: "yoloCounters",
    lastAction: "yoloLastAction",
    runtime: "yoloRuntimeV1"
  });

  const DEEP_NUDGE_PROMPT = [
    "Review where you stopped and keep going deeper.",
    "Do not repeat the last answer.",
    "Critically inspect your assumptions, look for gaps or edge cases, and continue the work toward my original goal with concrete next steps."
  ].join(" ");

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,

    approvalsEnabled: true,
    approvalPolicy: "safe",
    approvalDelayMinSec: 2,
    approvalDelayMaxSec: 6,
    approvalCooldownSec: 12,
    approvalLimitPerHour: 12,

    errorRecoveryEnabled: true,
    errorRecoveryStrategy: "continue-first",
    errorDelayMinSec: 3,
    errorDelayMaxSec: 8,
    errorCooldownSec: 90,
    errorLimitPerHour: 6,

    deepNudgesEnabled: false,
    deepNudgeIdleSec: 120,
    deepNudgeCooldownSec: 300,
    deepNudgeLimitPerHour: 6,
    deepNudgePrompt: DEEP_NUDGE_PROMPT,

    autoRefreshEnabled: false,
    refreshIdleMin: 5,
    refreshIntervalMinMin: 10,
    refreshIntervalMaxMin: 20,
    refreshCooldownMin: 5,
    refreshLimitPerHour: 2,

    loadGraceSec: 15,
    scanIntervalSec: 5,
    maxActionsPerSession: 30,
    pauseOnComposerText: true
  });

  const SCHEMA = Object.freeze({
    enabled: { type: "boolean" },

    approvalsEnabled: { type: "boolean" },
    approvalPolicy: { type: "enum", values: ["safe", "writes", "all"] },
    approvalDelayMinSec: { type: "number", min: 0, max: 120, integer: false },
    approvalDelayMaxSec: { type: "number", min: 0, max: 120, integer: false },
    approvalCooldownSec: { type: "number", min: 0, max: 3600, integer: false },
    approvalLimitPerHour: { type: "number", min: 0, max: 1000, integer: true },

    errorRecoveryEnabled: { type: "boolean" },
    errorRecoveryStrategy: { type: "enum", values: ["continue-first", "refresh-first", "continue-only", "refresh-only"] },
    errorDelayMinSec: { type: "number", min: 0, max: 300, integer: false },
    errorDelayMaxSec: { type: "number", min: 0, max: 300, integer: false },
    errorCooldownSec: { type: "number", min: 0, max: 7200, integer: false },
    errorLimitPerHour: { type: "number", min: 0, max: 1000, integer: true },

    deepNudgesEnabled: { type: "boolean" },
    deepNudgeIdleSec: { type: "number", min: 5, max: 86400, integer: false },
    deepNudgeCooldownSec: { type: "number", min: 5, max: 86400, integer: false },
    deepNudgeLimitPerHour: { type: "number", min: 0, max: 1000, integer: true },
    deepNudgePrompt: { type: "string", maxLength: 4000 },

    autoRefreshEnabled: { type: "boolean" },
    refreshIdleMin: { type: "number", min: 0, max: 1440, integer: false },
    refreshIntervalMinMin: { type: "number", min: 0.25, max: 1440, integer: false },
    refreshIntervalMaxMin: { type: "number", min: 0.25, max: 1440, integer: false },
    refreshCooldownMin: { type: "number", min: 0, max: 1440, integer: false },
    refreshLimitPerHour: { type: "number", min: 0, max: 1000, integer: true },

    loadGraceSec: { type: "number", min: 0, max: 600, integer: false },
    scanIntervalSec: { type: "number", min: 1, max: 60, integer: false },
    maxActionsPerSession: { type: "number", min: 0, max: 10000, integer: true },
    pauseOnComposerText: { type: "boolean" }
  });

  const coerceBoolean = (value, fallback) => {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
    return fallback;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function normalizeField(key, value) {
    const rule = SCHEMA[key];
    const fallback = DEFAULT_SETTINGS[key];
    if (!rule) return fallback;

    if (rule.type === "boolean") return coerceBoolean(value, fallback);
    if (rule.type === "enum") return rule.values.includes(value) ? value : fallback;
    if (rule.type === "string") {
      const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
      if (!text) return fallback;
      return text.slice(0, rule.maxLength);
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const bounded = clamp(parsed, rule.min, rule.max);
    return rule.integer ? Math.round(bounded) : Math.round(bounded * 100) / 100;
  }

  function migrateLegacySettings(input = {}) {
    const migrated = { ...input };
    const aliases = {
      approvals: "approvalsEnabled",
      errorContinue: "errorRecoveryEnabled",
      deepNudges: "deepNudgesEnabled",
      autoRefresh: "autoRefreshEnabled"
    };
    for (const [legacyKey, currentKey] of Object.entries(aliases)) {
      if (Object.prototype.hasOwnProperty.call(input, legacyKey) && !Object.prototype.hasOwnProperty.call(input, currentKey)) {
        migrated[currentKey] = input[legacyKey];
      }
    }
    return migrated;
  }

  function normalizeSettings(input = {}) {
    const migrated = migrateLegacySettings(input);
    const normalized = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      normalized[key] = normalizeField(key, migrated[key] ?? DEFAULT_SETTINGS[key]);
    }

    normalized.approvalDelayMaxSec = Math.max(normalized.approvalDelayMinSec, normalized.approvalDelayMaxSec);
    normalized.errorDelayMaxSec = Math.max(normalized.errorDelayMinSec, normalized.errorDelayMaxSec);
    normalized.refreshIntervalMaxMin = Math.max(normalized.refreshIntervalMinMin, normalized.refreshIntervalMaxMin);
    return normalized;
  }

  function mergeSettings(...sources) {
    return normalizeSettings(Object.assign({}, ...sources.filter(Boolean).map(migrateLegacySettings)));
  }

  function globalDefaultsFromSettings(settings) {
    const normalized = normalizeSettings(settings);
    const { enabled: _enabled, ...globalDefaults } = normalized;
    return globalDefaults;
  }

  function pageId(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      parsed.search = "";
      const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
      return `${parsed.origin}${pathname}`;
    } catch {
      return String(url || "").split("#")[0].split("?")[0];
    }
  }

  function isSupportedUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "grok.com" || host.endsWith(".grok.com");
    } catch {
      return false;
    }
  }

  function randomBetween(min, max, random = Math.random) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return low + random() * (high - low);
  }

  function pruneHistory(history, at = Date.now()) {
    const cutoff = at - HOUR_MS;
    return (Array.isArray(history) ? history : []).filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff && timestamp <= at);
  }

  function limitStatus(history, perHourLimit, sessionActionCount, sessionLimit, at = Date.now()) {
    const recent = pruneHistory(history, at);
    if (sessionLimit > 0 && sessionActionCount >= sessionLimit) {
      return { allowed: false, reason: "Session action limit reached", recent, nextAllowedAt: null };
    }
    if (perHourLimit > 0 && recent.length >= perHourLimit) {
      return {
        allowed: false,
        reason: "Hourly action limit reached",
        recent,
        nextAllowedAt: recent[0] + HOUR_MS
      };
    }
    return { allowed: true, reason: "", recent, nextAllowedAt: null };
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "now";
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
  }

  return Object.freeze({
    VERSION,
    HOUR_MS,
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    SCHEMA,
    DEEP_NUDGE_PROMPT,
    migrateLegacySettings,
    normalizeSettings,
    mergeSettings,
    globalDefaultsFromSettings,
    pageId,
    isSupportedUrl,
    randomBetween,
    pruneHistory,
    limitStatus,
    formatDuration
  });
});
