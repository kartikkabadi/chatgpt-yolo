(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Platforms = globalThis.YOLOPlatforms;
  if (!Config || !Platforms) return;

  if (window.__YOLO_EXTENSION__?.version === Config.VERSION) return;
  window.__YOLO_EXTENSION__?.destroy?.();

  const COUNTER_BY_ACTION = Object.freeze({
    approval: "approvalsClicked",
    recovery: "continuesSent",
    nudge: "deepNudgesSent",
    refresh: "refreshesTriggered"
  });

  const LIMIT_FIELD_BY_ACTION = Object.freeze({
    approval: "approvalLimitPerHour",
    recovery: "errorLimitPerHour",
    nudge: "deepNudgeLimitPerHour",
    refresh: "refreshLimitPerHour"
  });

  const state = {
    destroyed: false,
    loaded: false,
    pageId: Config.pageId(location.href),
    platform: Platforms.adapterForLocation(),
    settings: { ...Config.DEFAULT_SETTINGS },
    counters: {
      approvalsClicked: 0,
      continuesSent: 0,
      deepNudgesSent: 0,
      refreshesTriggered: 0
    },
    runtime: null,
    lastAction: { message: "Idle", at: Date.now(), level: "info" },
    blockedReason: "",
    generationActive: false,
    cycleInFlight: false,
    actionInFlight: false,
    scanQueued: false,
    pageLoadedAt: Date.now(),
    observer: null,
    scanTimer: null,
    routeTimer: null,
    activitySaveTimer: null
  };

  const now = () => Date.now();
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const randomMs = (minSec, maxSec) => Math.round(Config.randomBetween(minSec, maxSec) * 1000);
  const isContextInvalidated = (error) => /context invalidated|extension context/i.test(String(error?.message || error || ""));

  function disableStaleContext(error) {
    if (!isContextInvalidated(error)) return false;
    destroy();
    return true;
  }

  const storageGet = (keys) => new Promise((resolve) => {
    if (state.destroyed) return resolve({});
    try {
      chrome.storage.local.get(keys, (items) => {
        const error = chrome.runtime?.lastError;
        if (error) disableStaleContext(error);
        resolve(error ? {} : items || {});
      });
    } catch (error) {
      disableStaleContext(error);
      resolve({});
    }
  });

  const storageSet = (items) => new Promise((resolve) => {
    if (state.destroyed) return resolve(false);
    try {
      chrome.storage.local.set(items, () => {
        const error = chrome.runtime?.lastError;
        if (error) disableStaleContext(error);
        resolve(!error);
      });
    } catch (error) {
      disableStaleContext(error);
      resolve(false);
    }
  });

  function freshRuntime() {
    const timestamp = now();
    return {
      sessionStartedAt: timestamp,
      sessionActionCount: 0,
      history: { approval: [], recovery: [], nudge: [], refresh: [] },
      approvalSignatures: [],
      lastActionAt: 0,
      lastUserActivityAt: timestamp,
      lastGenerationAt: timestamp,
      lastRefreshAt: 0,
      nextRefreshAt: 0,
      lastErrorSignature: "",
      lastErrorHandledAt: 0
    };
  }

  function readRuntimeMap() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(Config.STORAGE_KEYS.runtime) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function normalizeRuntime(raw) {
    const fallback = freshRuntime();
    const history = raw?.history || {};
    return {
      ...fallback,
      ...(raw && typeof raw === "object" ? raw : {}),
      history: {
        approval: Config.pruneHistory(history.approval),
        recovery: Config.pruneHistory(history.recovery),
        nudge: Config.pruneHistory(history.nudge),
        refresh: Config.pruneHistory(history.refresh)
      },
      approvalSignatures: Array.isArray(raw?.approvalSignatures) ? raw.approvalSignatures.slice(-100) : []
    };
  }

  function loadRuntime(pageId = state.pageId) {
    const map = readRuntimeMap();
    return normalizeRuntime(map[pageId]);
  }

  function saveRuntime() {
    if (!state.runtime || state.destroyed) return;
    try {
      const map = readRuntimeMap();
      map[state.pageId] = state.runtime;
      const entries = Object.entries(map).slice(-50);
      sessionStorage.setItem(Config.STORAGE_KEYS.runtime, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Session persistence is best-effort; automation can continue in memory.
    }
  }

  async function setLastAction(message, level = "info") {
    state.lastAction = { message, at: now(), level };
    await storageSet({
      [Config.STORAGE_KEYS.lastAction]: {
        ...state.lastAction,
        url: location.href,
        pageId: state.pageId
      }
    });
  }

  async function incrementCounter(key) {
    const stored = await storageGet([Config.STORAGE_KEYS.counters]);
    const counters = { ...(stored[Config.STORAGE_KEYS.counters] || {}) };
    counters[key] = (Number(counters[key]) || 0) + 1;
    counters.updatedAt = now();
    state.counters = { ...state.counters, ...counters };
    await storageSet({ [Config.STORAGE_KEYS.counters]: counters });
  }

  function scheduleNextRefresh(force = false) {
    if (!state.runtime) return;
    if (!force && state.runtime.nextRefreshAt > now()) return;
    const minMs = state.settings.refreshIntervalMinMin * 60 * 1000;
    const maxMs = state.settings.refreshIntervalMaxMin * 60 * 1000;
    state.runtime.nextRefreshAt = now() + Math.round(Config.randomBetween(minMs, maxMs));
    saveRuntime();
  }

  async function loadSettings() {
    const stored = await storageGet([
      Config.STORAGE_KEYS.global,
      Config.STORAGE_KEYS.pages,
      Config.STORAGE_KEYS.counters,
      Config.STORAGE_KEYS.lastAction
    ]);

    const globalSettings = stored[Config.STORAGE_KEYS.global] || {};
    const pageSettings = stored[Config.STORAGE_KEYS.pages]?.[state.pageId] || {};
    state.settings = Config.mergeSettings(Config.DEFAULT_SETTINGS, globalSettings, pageSettings);
    state.counters = { ...state.counters, ...(stored[Config.STORAGE_KEYS.counters] || {}) };
    const storedLastAction = stored[Config.STORAGE_KEYS.lastAction];
    if (typeof storedLastAction === "string") state.lastAction = { message: storedLastAction, at: now(), level: "info" };
    else if (storedLastAction?.message) state.lastAction = storedLastAction;
    else if (storedLastAction?.action) state.lastAction = { message: storedLastAction.action, at: storedLastAction.at || now(), level: "info" };
    state.runtime = loadRuntime();
    scheduleNextRefresh();
    state.loaded = true;
  }

  async function persistSettings(nextSettings) {
    const normalized = Config.mergeSettings(state.settings, nextSettings);
    const stored = await storageGet([Config.STORAGE_KEYS.pages]);
    const pages = { ...(stored[Config.STORAGE_KEYS.pages] || {}) };
    pages[state.pageId] = normalized;

    state.settings = normalized;
    scheduleNextRefresh(true);
    await storageSet({
      [Config.STORAGE_KEYS.global]: Config.globalDefaultsFromSettings(normalized),
      [Config.STORAGE_KEYS.pages]: pages
    });
    restartScanTimer();
    return normalized;
  }

  function actionLimit(action) {
    return Number(state.settings[LIMIT_FIELD_BY_ACTION[action]]) || 0;
  }

  function checkActionLimit(action) {
    const status = Config.limitStatus(
      state.runtime?.history?.[action],
      actionLimit(action),
      state.runtime?.sessionActionCount || 0,
      state.settings.maxActionsPerSession,
      now()
    );
    if (state.runtime) state.runtime.history[action] = status.recent;
    state.blockedReason = status.allowed ? "" : status.reason;
    return status;
  }

  async function recordAction(action) {
    const timestamp = now();
    state.runtime.history[action] = Config.pruneHistory([...(state.runtime.history[action] || []), timestamp], timestamp);
    state.runtime.sessionActionCount += 1;
    state.runtime.lastActionAt = timestamp;
    saveRuntime();
    await incrementCounter(COUNTER_BY_ACTION[action]);
  }

  function composerHasText() {
    const composer = Platforms.findComposer(state.platform);
    return Boolean(Platforms.composerText(composer).trim());
  }

  function automationReady() {
    if (!state.loaded || state.destroyed || !state.platform || !state.settings.enabled) return false;
    return now() - state.pageLoadedAt >= state.settings.loadGraceSec * 1000;
  }

  function safeForAutomaticInput() {
    if (state.generationActive || Platforms.isGenerating(state.platform)) return false;
    if (state.settings.pauseOnComposerText && composerHasText()) return false;
    return true;
  }

  function updateGenerationState() {
    const active = Platforms.isGenerating(state.platform);
    const timestamp = now();
    if (state.runtime) {
      if (active) state.runtime.lastGenerationAt = timestamp;
      if (state.generationActive && !active) state.runtime.lastGenerationAt = timestamp;
      saveRuntime();
    }
    state.generationActive = active;
    return active;
  }

  function inputActionCooldownPassed(action) {
    const lastAt = state.runtime?.history?.[action]?.at(-1) || 0;
    const cooldownSec = action === "recovery" ? state.settings.errorCooldownSec : state.settings.deepNudgeCooldownSec;
    return now() - lastAt >= cooldownSec * 1000;
  }

  async function sendPrompt({ action, prompt, label, reason, delayMinSec = 0, delayMaxSec = 0, automatic = true }) {
    if (state.actionInFlight || !state.platform) return false;
    if (automatic && !automationReady()) return false;
    if (!automatic && !state.loaded) return false;
    if (!safeForAutomaticInput()) return false;

    if ((action === "recovery" || action === "nudge") && !inputActionCooldownPassed(action)) return false;

    const limit = checkActionLimit(action);
    if (!limit.allowed) {
      await setLastAction(`${label} blocked: ${limit.reason}`, "warning");
      return false;
    }

    let composer = Platforms.findComposer(state.platform);
    if (!composer || Platforms.composerText(composer).trim()) return false;

    state.actionInFlight = true;
    try {
      const delayMs = automatic ? randomMs(delayMinSec, delayMaxSec) : 150;
      if (delayMs > 0) await sleep(delayMs);
      if (state.destroyed || Config.pageId(location.href) !== state.pageId) return false;
      updateGenerationState();
      if (!safeForAutomaticInput()) return false;

      composer = Platforms.findComposer(state.platform);
      if (!composer || Platforms.composerText(composer).trim()) return false;

      Platforms.setComposerValue(composer, prompt);
      await sleep(120);
      if (!Platforms.submitComposer(state.platform, composer)) return false;

      await recordAction(action);
      await setLastAction(`Sent ${label} (${reason})`);
      return true;
    } catch (error) {
      await setLastAction(`${label} failed: ${String(error?.message || error)}`, "error");
      return false;
    } finally {
      state.actionInFlight = false;
    }
  }

  async function sendContinue(reason, automatic = true) {
    return sendPrompt({
      action: "recovery",
      prompt: "Continue",
      label: "Continue",
      reason,
      delayMinSec: state.settings.errorDelayMinSec,
      delayMaxSec: state.settings.errorDelayMaxSec,
      automatic
    });
  }

  async function sendDeepNudge(reason, automatic = true) {
    return sendPrompt({
      action: "nudge",
      prompt: state.settings.deepNudgePrompt,
      label: "deep nudge",
      reason,
      automatic
    });
  }

  function refreshCooldownPassed() {
    const cooldownMs = state.settings.refreshCooldownMin * 60 * 1000;
    return now() - (state.runtime.lastRefreshAt || 0) >= cooldownMs;
  }

  async function refreshPage(reason, automatic = true) {
    if (state.actionInFlight || !state.platform) return false;
    if (automatic && !automationReady()) return false;
    if (updateGenerationState()) return false;
    if (state.settings.pauseOnComposerText && composerHasText()) return false;
    if (!refreshCooldownPassed()) return false;

    const limit = checkActionLimit("refresh");
    if (!limit.allowed) {
      await setLastAction(`Refresh blocked: ${limit.reason}`, "warning");
      return false;
    }

    state.actionInFlight = true;
    try {
      state.runtime.lastRefreshAt = now();
      scheduleNextRefresh(true);
      await recordAction("refresh");
      await setLastAction(`Refreshing (${reason})`);
      window.setTimeout(() => location.reload(), automatic ? 500 : 150);
      return true;
    } finally {
      state.actionInFlight = false;
    }
  }

  function errorSignature(element) {
    const rect = element.getBoundingClientRect();
    return `${Math.round(rect.top)}:${Math.round(rect.left)}:${Platforms.normalizedText(element).slice(0, 240)}`;
  }

  async function handleErrorState() {
    if (!automationReady() || !state.settings.errorRecoveryEnabled || state.actionInFlight) return false;
    const error = Platforms.findErrorState(state.platform);
    if (!error) return false;

    const signature = errorSignature(error);
    const cooldownMs = state.settings.errorCooldownSec * 1000;
    if (signature === state.runtime.lastErrorSignature && now() - state.runtime.lastErrorHandledAt < cooldownMs) return false;

    state.runtime.lastErrorSignature = signature;
    state.runtime.lastErrorHandledAt = now();
    saveRuntime();
    await setLastAction("Detected error; attempting recovery");

    const strategy = state.settings.errorRecoveryStrategy;
    if (strategy === "continue-only") return sendContinue("error recovery");
    if (strategy === "refresh-only") return refreshPage("error recovery");
    if (strategy === "refresh-first") return (await refreshPage("error recovery")) || sendContinue("error recovery fallback");
    return (await sendContinue("error recovery")) || refreshPage("error recovery fallback");
  }

  async function handleApprovalCards() {
    if (!automationReady() || !state.settings.approvalsEnabled || state.actionInFlight || !state.platform?.supportsApprovals) return false;
    if (updateGenerationState()) return false;

    const cooldownMs = state.settings.approvalCooldownSec * 1000;
    const lastApprovalAt = state.runtime.history.approval.at(-1) || 0;
    if (now() - lastApprovalAt < cooldownMs) return false;

    const limit = checkActionLimit("approval");
    if (!limit.allowed) return false;

    const candidates = Platforms.findApprovalCards(state.platform, state.settings.approvalPolicy);
    for (const candidate of candidates) {
      if (state.runtime.approvalSignatures.includes(candidate.signature)) continue;

      state.actionInFlight = true;
      try {
        await setLastAction(`Approval found: ${Platforms.buttonText(candidate.button) || "affirmative action"}`);
        await sleep(randomMs(state.settings.approvalDelayMinSec, state.settings.approvalDelayMaxSec));
        updateGenerationState();

        if (!candidate.button.isConnected || !Platforms.visible(candidate.button) || Platforms.isDisabled(candidate.button) || state.generationActive) return false;
        candidate.button.click();
        state.runtime.approvalSignatures = [...state.runtime.approvalSignatures, candidate.signature].slice(-100);
        await recordAction("approval");
        await setLastAction(`Clicked approval: ${Platforms.buttonText(candidate.button) || "affirmative action"}`);
        return true;
      } finally {
        state.actionInFlight = false;
      }
    }
    return false;
  }

  async function handleDeepNudge() {
    if (!automationReady() || !state.settings.deepNudgesEnabled || state.actionInFlight) return false;
    if (updateGenerationState() || !safeForAutomaticInput()) return false;

    const lastNudgeAt = state.runtime.history.nudge.at(-1) || 0;
    if (now() - lastNudgeAt < state.settings.deepNudgeCooldownSec * 1000) return false;

    const idleBaseline = Math.max(
      state.pageLoadedAt,
      state.runtime.lastUserActivityAt,
      state.runtime.lastGenerationAt,
      state.runtime.lastActionAt
    );
    if (now() - idleBaseline < state.settings.deepNudgeIdleSec * 1000) return false;
    return sendDeepNudge("idle");
  }

  async function handlePeriodicRefresh() {
    if (!automationReady() || !state.settings.autoRefreshEnabled || state.actionInFlight) return false;
    scheduleNextRefresh();
    if (now() < state.runtime.nextRefreshAt) return false;
    if (updateGenerationState() || !safeForAutomaticInput()) return false;

    const idleBaseline = Math.max(
      state.pageLoadedAt,
      state.runtime.lastUserActivityAt,
      state.runtime.lastGenerationAt,
      state.runtime.lastActionAt
    );
    if (now() - idleBaseline < state.settings.refreshIdleMin * 60 * 1000) return false;
    return refreshPage("scheduled idle refresh");
  }

  async function runCycle() {
    if (state.destroyed || state.cycleInFlight || !state.loaded) return;
    state.cycleInFlight = true;
    try {
      if (await handleErrorState()) return;
      if (await handleApprovalCards()) return;
      if (await handleDeepNudge()) return;
      await handlePeriodicRefresh();
    } catch (error) {
      if (!disableStaleContext(error)) await setLastAction(`Automation error: ${String(error?.message || error)}`, "error");
    } finally {
      state.cycleInFlight = false;
    }
  }

  function queueCycle() {
    if (state.destroyed || state.scanQueued) return;
    state.scanQueued = true;
    window.setTimeout(() => {
      state.scanQueued = false;
      runCycle();
    }, 500);
  }

  function restartScanTimer() {
    window.clearInterval(state.scanTimer);
    if (state.destroyed) return;
    state.scanTimer = window.setInterval(runCycle, state.settings.scanIntervalSec * 1000);
  }

  async function handleRouteChange() {
    const nextPageId = Config.pageId(location.href);
    if (nextPageId === state.pageId) return;

    state.pageId = nextPageId;
    state.platform = Platforms.adapterForLocation();
    state.pageLoadedAt = now();
    state.loaded = false;
    await loadSettings();
    restartScanTimer();
    await setLastAction("Loaded settings for this conversation");
    queueCycle();
  }

  function markUserActivity() {
    if (!state.runtime) return;
    state.runtime.lastUserActivityAt = now();
    window.clearTimeout(state.activitySaveTimer);
    state.activitySaveTimer = window.setTimeout(saveRuntime, 500);
  }

  function installObservers() {
    state.observer = new MutationObserver(queueCycle);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.addEventListener(eventName, markUserActivity, true);
    }

    restartScanTimer();
    state.routeTimer = window.setInterval(handleRouteChange, 1000);
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
      nextRefreshAt: state.runtime?.nextRefreshAt || 0,
      blockedReason: state.blockedReason
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
      generating: state.generationActive
    };
  }

  async function runManualAction(action) {
    if (action === "nudge") return sendDeepNudge("manual", false);
    if (action === "continue") return sendContinue("manual", false);
    if (action === "refresh") return refreshPage("manual", false);
    if (action === "scan") {
      await runCycle();
      return true;
    }
    return false;
  }

  async function resetRuntime() {
    state.runtime = freshRuntime();
    scheduleNextRefresh(true);
    saveRuntime();
    state.blockedReason = "";
    await setLastAction("Reset session limits and action history");
  }

  function installMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (state.destroyed) return false;

      if (message?.type === "YOLO_GET_STATE") {
        updateGenerationState();
        sendResponse(responseState());
        return true;
      }

      if (message?.type === "YOLO_SET_SETTINGS" || message?.type === "YOLO_SET_TAB_SETTINGS") {
        persistSettings(message.settings || {}).then((settings) => {
          sendResponse({ ok: true, settings, state: responseState() });
          queueCycle();
        });
        return true;
      }

      if (message?.type === "YOLO_RUN_ACTION") {
        runManualAction(message.action).then((ok) => sendResponse({ ok, state: responseState() }));
        return true;
      }

      if (message?.type === "YOLO_RESET_RUNTIME") {
        resetRuntime().then(() => sendResponse({ ok: true, state: responseState() }));
        return true;
      }

      return false;
    });
  }

  function destroy() {
    state.destroyed = true;
    state.observer?.disconnect();
    window.clearInterval(state.scanTimer);
    window.clearInterval(state.routeTimer);
    window.clearTimeout(state.activitySaveTimer);
    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.removeEventListener(eventName, markUserActivity, true);
    }
  }

  window.__YOLO_EXTENSION__ = { version: Config.VERSION, destroy };

  installMessages();
  loadSettings().then(() => {
    if (state.destroyed) return;
    installObservers();
    runCycle();
  }).catch((error) => {
    if (!disableStaleContext(error)) setLastAction(`Startup failed: ${String(error?.message || error)}`, "error");
  });
})();
