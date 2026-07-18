((root, factory) => {
  if (!root) return;
  if (root.YOLOContentState?.version === root.YOLOConfig?.VERSION) return;

  const Config = root.YOLOConfig || (typeof require === "function" && require("./config.js"));
  const Shared = root.YOLOShared || (typeof require === "function" && require("./shared.js"));
  const Platforms = root.YOLOPlatforms || (typeof require === "function" && require("./platforms.js"));

  if (!Config || !Shared || !Platforms) return;

  const api = factory(Config, Shared, Platforms);

  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOContentState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Config, Shared, Platforms) => {
  "use strict";

  const VERSION = Config.VERSION;
  const APPROVAL_SIGNATURE_TTL_MS = 10 * 60 * 1000;

  const now = () => Date.now();
  const randomMs = (minSec, maxSec) => Math.round(Config.randomBetween(minSec, maxSec) * 1000);

  const state = {
    destroyed: false,
    loaded: false,
    routeInFlight: false,
    pageId: Config.pageId(location.href),
    platform: Platforms.adapterForLocation(),
    settings: { ...Config.DEFAULT_SETTINGS },
    counters: {
      approvalsClicked: 0,
      continuesSent: 0,
      deepNudgesSent: 0,
      refreshesTriggered: 0,
      queuedMessagesSent: 0
    },
    runtime: null,
    lastAction: { message: "Idle", at: now(), level: "info", code: "idle" },
    blockedReason: "",
    blockedCode: "",
    generationActive: false,
    cycleInFlight: false,
    actionInFlight: false,
    scanQueued: false,
    scanWakeTimer: null,
    scanWakeAt: 0,
    pendingManualQueueRetry: false,
    reloadScheduled: false,
    pageLoadedAt: now(),
    hydrated: false,
    hydratedAt: 0,
    hydrationCandidateSince: 0,
    lastDomActivityAt: now(),
    generationHoldUntil: 0,
    lastGenerationPersistAt: 0,
    observer: null,
    scanTimer: null,
    routeTimer: null,
    activitySaveTimer: null,
    lifecycleHandlers: [],
    messageListener: null,
    storageListener: null,
    clients: new Set(),
    ownerId: Shared.makeId("content")
  };

  function freshRuntime() {
    const timestamp = now();
    return {
      sessionStartedAt: timestamp,
      sessionActionCount: 0,
      history: { approval: [], recovery: [], nudge: [], refresh: [], queue: [] },
      approvalSignatures: [],
      lastActionAt: 0,
      lastUserActivityAt: timestamp,
      lastGenerationAt: timestamp,
      lastRefreshAt: 0,
      nextRefreshAt: 0,
      nextQueueAt: 0,
      lastErrorSignature: "",
      lastErrorHandledAt: 0
    };
  }

  function readRuntimeMap() {
    try {
      const storage = typeof sessionStorage !== "undefined" ? sessionStorage : null;
      const raw = storage ? storage.getItem(Config.STORAGE_KEYS.runtime) || "{}" : "{}";
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function normalizeApprovalSignatures(raw, fallbackAt = 0) {
    const timestamp = now();
    return (Array.isArray(raw) ? raw : [])
      .map((entry) => {
        if (typeof entry === "string") return { signature: entry, at: fallbackAt || timestamp };
        if (!entry || typeof entry.signature !== "string") return null;
        return { signature: entry.signature, at: Number(entry.at) || fallbackAt || timestamp };
      })
      .filter((entry) => entry && timestamp - entry.at < APPROVAL_SIGNATURE_TTL_MS)
      .slice(-100);
  }

  function normalizeRuntime(raw) {
    const fallback = freshRuntime();
    const history = raw?.history || {};
    const lastActionAt = Number(raw?.lastActionAt) || 0;
    return {
      ...fallback,
      ...(raw && typeof raw === "object" ? raw : {}),
      sessionActionCount: Math.max(0, Number(raw?.sessionActionCount) || 0),
      history: {
        approval: Config.pruneHistory(history.approval),
        recovery: Config.pruneHistory(history.recovery),
        nudge: Config.pruneHistory(history.nudge),
        refresh: Config.pruneHistory(history.refresh),
        queue: Config.pruneHistory(history.queue)
      },
      approvalSignatures: normalizeApprovalSignatures(raw?.approvalSignatures, lastActionAt),
      nextQueueAt: Math.max(0, Number(raw?.nextQueueAt) || 0)
    };
  }

  function loadRuntime(pageId = state.pageId) {
    return normalizeRuntime(readRuntimeMap()[pageId]);
  }

  function saveRuntime() {
    if (!state.runtime || state.destroyed) return;
    try {
      const storage = typeof sessionStorage !== "undefined" ? sessionStorage : null;
      if (!storage) return;
      const map = readRuntimeMap();
      delete map[state.pageId];
      map[state.pageId] = state.runtime;
      const entries = Object.entries(map).slice(-50);
      storage.setItem(Config.STORAGE_KEYS.runtime, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Session persistence is best-effort; automation can continue in memory.
    }
  }

  function scheduleNextRefresh(force = false) {
    if (!state.runtime) return;
    if (!force && state.runtime.nextRefreshAt > now()) return;
    const minMs = state.settings.refreshIntervalMinMin * 60 * 1000;
    const maxMs = state.settings.refreshIntervalMaxMin * 60 * 1000;
    state.runtime.nextRefreshAt = now() + Math.round(Config.randomBetween(minMs, maxMs));
    saveRuntime();
  }

  function scheduleNextQueue(force = false) {
    if (!state.runtime) return;
    if (!force && state.runtime.nextQueueAt > 0) return;
    if (!force) state.runtime.nextQueueAt = now();
    else state.runtime.nextQueueAt = now() + randomMs(state.settings.queueIntervalMinSec, state.settings.queueIntervalMaxSec);
    saveRuntime();
  }

  function runtimeSummary() {
    const history = state.runtime?.history || {};
    return {
      sessionStartedAt: state.runtime?.sessionStartedAt || 0,
      sessionActionCount: state.runtime?.sessionActionCount || 0,
      approvalCountLastHour: Config.pruneHistory(history.approval).length,
      recoveryCountLastHour: Config.pruneHistory(history.recovery).length,
      nudgeCountLastHour: Config.pruneHistory(history.nudge).length,
      refreshCountLastHour: Config.pruneHistory(history.refresh).length,
      queueCountLastHour: Config.pruneHistory(history.queue).length,
      nextRefreshAt: state.runtime?.nextRefreshAt || 0,
      nextQueueAt: state.runtime?.nextQueueAt || 0,
      blockedReason: state.blockedReason,
      blockedCode: state.blockedCode
    };
  }

  function responseState() {
    return {
      version: Config.VERSION,
      settings: state.settings,
      counters: state.counters,
      lastAction: state.lastAction,
      runtime: runtimeSummary(),
      pageId: state.pageId,
      platform: state.platform?.label || "Unsupported",
      generating: state.generationActive,
      hydrated: state.hydrated,
      lastDomActivityAt: state.lastDomActivityAt,
      lastGenerationAt: state.runtime?.lastGenerationAt || 0
    };
  }

  return Object.freeze({
    version: VERSION,
    VERSION,
    state,
    randomMs,
    freshRuntime,
    normalizeApprovalSignatures,
    loadRuntime,
    saveRuntime,
    scheduleNextRefresh,
    scheduleNextQueue,
    runtimeSummary,
    responseState
  });
});
