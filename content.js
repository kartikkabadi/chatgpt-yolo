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
    refresh: "refreshesTriggered",
    queue: "queuedMessagesSent"
  });

  const LIMIT_FIELD_BY_ACTION = Object.freeze({
    approval: "approvalLimitPerHour",
    recovery: "errorLimitPerHour",
    nudge: "deepNudgeLimitPerHour",
    refresh: "refreshLimitPerHour",
    queue: "queueLimitPerHour"
  });

  const APPROVAL_SIGNATURE_TTL_MS = 10 * 60 * 1000;
  const FAILED_RECOVERY_RETRY_MS = 15 * 1000;

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
    lastAction: { message: "Idle", at: Date.now(), level: "info", code: "idle" },
    blockedReason: "",
    blockedCode: "",
    generationActive: false,
    cycleInFlight: false,
    actionInFlight: false,
    scanQueued: false,
    reloadScheduled: false,
    pageLoadedAt: Date.now(),
    observer: null,
    scanTimer: null,
    routeTimer: null,
    activitySaveTimer: null,
    messageListener: null,
    storageListener: null,
    ownerId: `content_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  };

  const now = () => Date.now();
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const randomMs = (minSec, maxSec) => Math.round(Config.randomBetween(minSec, maxSec) * 1000);
  const currentPageId = () => Config.pageId(location.href);
  const routeIsCurrent = () => currentPageId() === state.pageId;
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

  const backgroundSend = (message) => new Promise((resolve) => {
    if (state.destroyed) return resolve(null);
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime?.lastError;
        if (error) disableStaleContext(error);
        resolve(error ? null : response || null);
      });
    } catch (error) {
      disableStaleContext(error);
      resolve(null);
    }
  });

  async function backgroundSendWithRetry(message, attempts = 3) {
    for (let index = 0; index < attempts; index += 1) {
      const response = await backgroundSend(message);
      if (response?.ok) return response;
      if (index < attempts - 1) await sleep(150 * (index + 1));
    }
    return null;
  }

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
      const parsed = JSON.parse(sessionStorage.getItem(Config.STORAGE_KEYS.runtime) || "{}");
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
      const map = readRuntimeMap();
      delete map[state.pageId];
      map[state.pageId] = state.runtime;
      const entries = Object.entries(map).slice(-50);
      sessionStorage.setItem(Config.STORAGE_KEYS.runtime, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Session persistence is best-effort; automation can continue in memory.
    }
  }

  async function appendEvent(code, message, level = "info") {
    if (!state.pageId || state.destroyed) return;
    await backgroundSend({
      type: "YOLO_EVENT_APPEND",
      pageId: state.pageId,
      event: { code, message, level, at: now() }
    });
  }

  async function setLastAction(message, level = "info", code = "status", logEvent = false) {
    state.lastAction = { message, at: now(), level, code };
    const value = { ...state.lastAction, url: location.href, pageId: state.pageId };
    await storageSet({
      [Config.lastActionKey(state.pageId)]: value,
      [Config.STORAGE_KEYS.lastAction]: value
    });
    if (logEvent) await appendEvent(code, message, level);
  }

  async function setBlocked(code, message, { log = false } = {}) {
    const changed = state.blockedCode !== code || state.blockedReason !== message;
    state.blockedCode = code;
    state.blockedReason = message;
    if (log && changed) await appendEvent(code, message, "warning");
  }

  function clearBlocked(prefix = "") {
    if (!prefix || state.blockedCode.startsWith(prefix)) {
      state.blockedCode = "";
      state.blockedReason = "";
    }
  }

  async function incrementCounter(key) {
    if (!key) return;
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

  function scheduleNextQueue(force = false) {
    if (!state.runtime) return;
    if (!force && state.runtime.nextQueueAt > 0) return;
    if (!force) state.runtime.nextQueueAt = now();
    else state.runtime.nextQueueAt = now() + randomMs(state.settings.queueIntervalMinSec, state.settings.queueIntervalMaxSec);
    saveRuntime();
  }

  async function loadSettings() {
    const pageKey = Config.pageSettingsKey(state.pageId);
    const actionKey = Config.lastActionKey(state.pageId);
    const stored = await storageGet([
      Config.STORAGE_KEYS.global,
      Config.STORAGE_KEYS.pages,
      Config.STORAGE_KEYS.counters,
      Config.STORAGE_KEYS.lastAction,
      pageKey,
      actionKey
    ]);

    const globalSettings = stored[Config.STORAGE_KEYS.global] || {};
    const legacyPageSettings = stored[Config.STORAGE_KEYS.pages]?.[state.pageId] || {};
    const pageSettings = stored[pageKey] || legacyPageSettings;
    state.settings = Config.mergeSettings(Config.DEFAULT_SETTINGS, globalSettings, pageSettings);
    state.counters = { ...state.counters, ...(stored[Config.STORAGE_KEYS.counters] || {}) };

    const storedLastAction = stored[actionKey] || stored[Config.STORAGE_KEYS.lastAction];
    if (storedLastAction?.pageId === state.pageId && storedLastAction?.message) state.lastAction = storedLastAction;
    else state.lastAction = { message: "Idle", at: now(), level: "info", code: "idle" };

    state.runtime = loadRuntime();
    scheduleNextRefresh();
    scheduleNextQueue();
    state.loaded = true;
  }

  async function ensureCurrentRoute() {
    if (!routeIsCurrent()) await handleRouteChange();
    for (let attempt = 0; attempt < 40 && state.routeInFlight; attempt += 1) await sleep(25);
    return routeIsCurrent() && !state.routeInFlight && state.loaded;
  }

  async function persistSettings(nextSettings) {
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
    if (!status.allowed) {
      state.blockedCode = status.code;
      state.blockedReason = status.reason;
    }
    return status;
  }

  async function recordAction(action, counterKey = COUNTER_BY_ACTION[action]) {
    const timestamp = now();
    state.runtime.history[action] = Config.pruneHistory([...(state.runtime.history[action] || []), timestamp], timestamp);
    state.runtime.sessionActionCount += 1;
    state.runtime.lastActionAt = timestamp;
    clearBlocked();
    saveRuntime();
    await incrementCounter(counterKey);
  }

  function composerHasText() {
    const composer = Platforms.findComposer(state.platform);
    return Boolean(Platforms.composerText(composer).trim());
  }

  function automationReady() {
    if (!state.loaded || state.destroyed || !state.platform || !state.settings.enabled || !routeIsCurrent()) return false;
    return now() - state.pageLoadedAt >= state.settings.loadGraceSec * 1000;
  }

  function safeForInput() {
    if (!routeIsCurrent()) return false;
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

  async function writeAndSubmit(prompt, actionPageId) {
    let composer = Platforms.findComposer(state.platform);
    if (!composer) return { ok: false, code: "composer.missing", reason: "Message composer was not found" };
    if (state.settings.pauseOnComposerText && Platforms.composerText(composer).trim()) {
      return { ok: false, code: "composer.busy", reason: "Message composer contains a draft" };
    }

    Platforms.setComposerValue(composer, prompt);
    await sleep(120);
    if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) {
      return { ok: false, code: "route.changed", reason: "Conversation changed before the message was submitted" };
    }
    composer = Platforms.findComposer(state.platform) || composer;
    if (!Platforms.submitComposer(state.platform, composer)) {
      return { ok: false, code: "composer.submit_failed", reason: "Message could not be submitted" };
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) {
        return { ok: false, code: "route.changed", reason: "Conversation changed before delivery could be confirmed" };
      }
      if (Platforms.submissionObserved(state.platform)) return { ok: true };
      await sleep(100);
    }
    return { ok: false, code: "composer.unconfirmed", reason: "The chat did not confirm that the message was submitted" };
  }

  async function sendPrompt({ action, prompt, label, reason, delayMinSec = 0, delayMaxSec = 0, automatic = true }) {
    if (state.actionInFlight || !state.platform) return false;
    const actionPageId = state.pageId;
    if (automatic && !automationReady()) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent())) return false;
    if (!safeForInput()) return false;
    if ((action === "recovery" || action === "nudge") && !inputActionCooldownPassed(action)) return false;

    const limit = checkActionLimit(action);
    if (!limit.allowed) {
      await setLastAction(`${label} blocked: ${limit.reason}`, "warning", limit.code, true);
      return false;
    }

    state.actionInFlight = true;
    try {
      const delayMs = automatic ? randomMs(delayMinSec, delayMaxSec) : 150;
      if (delayMs > 0) await sleep(delayMs);
      if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) return false;
      updateGenerationState();
      if (!safeForInput()) return false;

      const submitted = await writeAndSubmit(prompt, actionPageId);
      if (!submitted.ok) {
        await setBlocked(submitted.code, submitted.reason);
        return false;
      }
      await recordAction(action);
      await setLastAction(`Sent ${label} (${reason})`, "success", `action.${action}`, true);
      return true;
    } catch (error) {
      await setLastAction(`${label} failed: ${String(error?.message || error)}`, "error", `action.${action}.failed`, true);
      return false;
    } finally {
      state.actionInFlight = false;
    }
  }

  async function sendContinue(reason, automatic = true) {
    return sendPrompt({ action: "recovery", prompt: "Continue", label: "Continue", reason, automatic });
  }

  async function sendDeepNudge(reason, automatic = true) {
    return sendPrompt({ action: "nudge", prompt: state.settings.deepNudgePrompt, label: "deep nudge", reason, automatic });
  }

  function refreshCooldownPassed() {
    const cooldownMs = state.settings.refreshCooldownMin * 60 * 1000;
    return now() - (state.runtime.lastRefreshAt || 0) >= cooldownMs;
  }

  async function refreshPage(reason, automatic = true, action = "refresh") {
    if (state.actionInFlight || !state.platform || state.reloadScheduled) return false;
    const actionPageId = state.pageId;
    if (automatic && !automationReady()) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent())) return false;
    if (updateGenerationState()) return false;
    if (state.settings.pauseOnComposerText && composerHasText()) return false;
    if (action === "refresh" && !refreshCooldownPassed()) return false;

    const limit = checkActionLimit(action);
    if (!limit.allowed) {
      await setLastAction(`Refresh blocked: ${limit.reason}`, "warning", limit.code, true);
      return false;
    }

    state.actionInFlight = true;
    try {
      if (state.pageId !== actionPageId || currentPageId() !== actionPageId) return false;
      state.runtime.lastRefreshAt = now();
      scheduleNextRefresh(true);
      await recordAction(action, "refreshesTriggered");
      await setLastAction(`Refreshing (${reason})`, "success", `action.${action}.refresh`, true);
      state.reloadScheduled = true;
      window.setTimeout(() => {
        if (currentPageId() === actionPageId) location.reload();
        else {
          state.reloadScheduled = false;
          state.actionInFlight = false;
          queueCycle();
        }
      }, automatic ? 500 : 150);
      return true;
    } finally {
      if (!state.reloadScheduled) state.actionInFlight = false;
    }
  }

  function errorSignature(element) {
    const text = Platforms.normalizedText(element).replace(/\s+/g, " ").trim().slice(0, 320);
    return `${state.platform?.id || "unknown"}:${text}`;
  }

  async function handleErrorState() {
    if (!automationReady() || !state.settings.errorRecoveryEnabled || state.actionInFlight) return false;
    const error = Platforms.findErrorState(state.platform);
    if (!error) return false;

    const signature = errorSignature(error);
    const cooldownMs = state.settings.errorCooldownSec * 1000;
    if (signature === state.runtime.lastErrorSignature && now() - state.runtime.lastErrorHandledAt < cooldownMs) return false;

    const limit = checkActionLimit("recovery");
    if (!limit.allowed) {
      await setLastAction(`Recovery blocked: ${limit.reason}`, "warning", limit.code, true);
      return false;
    }

    const errorPageId = state.pageId;
    state.runtime.lastErrorSignature = signature;
    state.runtime.lastErrorHandledAt = now();
    saveRuntime();
    await setLastAction("Detected error; attempting recovery", "warning", "recovery.detected", true);

    const delayMs = randomMs(state.settings.errorDelayMinSec, state.settings.errorDelayMaxSec);
    if (delayMs > 0) await sleep(delayMs);
    if (state.destroyed || state.pageId !== errorPageId || currentPageId() !== errorPageId) return false;

    const strategy = state.settings.errorRecoveryStrategy;
    let handled = false;
    if (strategy === "continue-only") handled = await sendContinue("error recovery");
    else if (strategy === "refresh-only") handled = await refreshPage("error recovery", true, "recovery");
    else if (strategy === "refresh-first") handled = (await refreshPage("error recovery", true, "recovery")) || await sendContinue("error recovery fallback");
    else handled = (await sendContinue("error recovery")) || await refreshPage("error recovery fallback", true, "recovery");

    if (!handled && state.runtime) {
      state.runtime.lastErrorHandledAt = now() - Math.max(0, cooldownMs - FAILED_RECOVERY_RETRY_MS);
      saveRuntime();
    }
    return handled;
  }

  function pruneApprovalSignatures() {
    state.runtime.approvalSignatures = normalizeApprovalSignatures(state.runtime.approvalSignatures, state.runtime.lastActionAt);
  }

  function recentlyApproved(signature) {
    pruneApprovalSignatures();
    return state.runtime.approvalSignatures.some((entry) => entry.signature === signature);
  }

  async function handleApprovalCards() {
    if (!automationReady() || !state.settings.approvalsEnabled || state.actionInFlight || !state.platform?.supportsApprovals) return false;
    if (updateGenerationState()) return false;

    const cooldownMs = state.settings.approvalCooldownSec * 1000;
    const lastApprovalAt = state.runtime.history.approval.at(-1) || 0;
    if (now() - lastApprovalAt < cooldownMs) return false;

    const limit = checkActionLimit("approval");
    if (!limit.allowed) return false;

    const approvalPageId = state.pageId;
    const candidates = Platforms.findApprovalCards(state.platform, state.settings.approvalPolicy);
    for (const candidate of candidates) {
      if (recentlyApproved(candidate.signature)) continue;

      state.actionInFlight = true;
      try {
        await setLastAction(`Approval found: ${Platforms.buttonText(candidate.button) || "affirmative action"}`, "info", "approval.detected");
        await sleep(randomMs(state.settings.approvalDelayMinSec, state.settings.approvalDelayMaxSec));
        if (state.destroyed || state.pageId !== approvalPageId || currentPageId() !== approvalPageId) return false;
        updateGenerationState();
        if (state.generationActive) return false;

        const refreshedCandidate = Platforms.findApprovalCards(state.platform, state.settings.approvalPolicy)
          .find((entry) => entry.signature === candidate.signature);
        if (!refreshedCandidate || recentlyApproved(refreshedCandidate.signature)) return false;
        if (!refreshedCandidate.button.isConnected || !Platforms.visible(refreshedCandidate.button) || Platforms.isDisabled(refreshedCandidate.button)) return false;

        refreshedCandidate.button.click();
        state.runtime.approvalSignatures = [
          ...state.runtime.approvalSignatures,
          { signature: refreshedCandidate.signature, at: now() }
        ].slice(-100);
        await recordAction("approval");
        await setLastAction(`Clicked approval: ${Platforms.buttonText(refreshedCandidate.button) || "affirmative action"}`, "success", `approval.${refreshedCandidate.risk}`, true);
        return true;
      } finally {
        state.actionInFlight = false;
      }
    }
    return false;
  }

  async function releaseQueueClaim(pageId, item, reason) {
    return backgroundSendWithRetry({
      type: "YOLO_QUEUE_RELEASE",
      pageId,
      itemId: item.id,
      claimToken: item.claimToken,
      reason
    });
  }

  async function failQueueClaim(pageId, item, error, options) {
    return backgroundSendWithRetry({
      type: "YOLO_QUEUE_FAIL",
      pageId,
      itemId: item.id,
      claimToken: item.claimToken,
      error,
      maxRetries: options.maxRetries,
      backoffSec: options.backoffSec,
      pauseOnFailure: options.pauseOnFailure
    });
  }

  async function handleQueue(automatic = true) {
    if (state.actionInFlight || !state.platform) return false;
    if (automatic && (!automationReady() || !state.settings.queueAutoRunEnabled)) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent())) return false;
    if (updateGenerationState()) {
      if (!automatic) await setBlocked("queue.generating", "The chat is still generating");
      return false;
    }
    if (!safeForInput()) {
      if (!automatic) await setBlocked("queue.composer_busy", "The composer contains a draft");
      return false;
    }
    if (!Platforms.findComposer(state.platform)) {
      if (!automatic) await setBlocked("queue.composer_missing", "The message composer is not available yet");
      return false;
    }
    if (automatic && now() < (state.runtime.nextQueueAt || 0)) return false;

    if (automatic) {
      const idleBaseline = Math.max(state.pageLoadedAt, state.runtime.lastUserActivityAt, state.runtime.lastGenerationAt);
      if (now() - idleBaseline < state.settings.queueIdleSec * 1000) return false;
    }

    const limit = checkActionLimit("queue");
    if (!limit.allowed) {
      await setLastAction(`Queue blocked: ${limit.reason}`, "warning", limit.code, true);
      return false;
    }

    const queuePageId = state.pageId;
    const queueFailureOptions = {
      maxRetries: state.settings.queueMaxRetries,
      backoffSec: state.settings.queueRetryBackoffSec,
      pauseOnFailure: state.settings.queuePauseOnFailure
    };
    const claim = await backgroundSend({
      type: "YOLO_QUEUE_CLAIM",
      pageId: queuePageId,
      ownerId: state.ownerId
    });
    if (!claim?.ok || !claim.item) {
      if (claim?.code === "queue.paused") await setBlocked("queue.paused", "Queue is paused");
      else if (state.blockedCode.startsWith("queue.")) clearBlocked("queue.");
      return false;
    }

    const item = claim.item;
    state.actionInFlight = true;
    try {
      if (state.destroyed || state.pageId !== queuePageId || currentPageId() !== queuePageId) {
        await releaseQueueClaim(queuePageId, item, "Conversation changed before the queued message could send");
        return false;
      }
      updateGenerationState();
      if (!safeForInput()) {
        await releaseQueueClaim(queuePageId, item, "Chat became busy before the queued message could send");
        return false;
      }

      await setLastAction("Sending queued message", "info", "queue.sending");
      const submitted = await writeAndSubmit(item.text, queuePageId);
      if (!submitted.ok) {
        await failQueueClaim(queuePageId, item, submitted.reason, queueFailureOptions);
        await setLastAction(`Queue send failed: ${submitted.reason}`, "error", submitted.code, true);
        return false;
      }

      const completed = await backgroundSendWithRetry({
        type: "YOLO_QUEUE_COMPLETE",
        pageId: queuePageId,
        itemId: item.id,
        claimToken: item.claimToken
      });
      if (!completed?.ok) {
        await setLastAction("Message sent, but queue completion could not be confirmed", "warning", "queue.completion_unconfirmed", true);
        return true;
      }

      await recordAction("queue");
      scheduleNextQueue(true);
      await setLastAction("Sent queued message", "success", "queue.sent", true);
      return true;
    } catch (error) {
      await failQueueClaim(queuePageId, item, String(error?.message || error), queueFailureOptions);
      await setLastAction(`Queue send failed: ${String(error?.message || error)}`, "error", "queue.failed", true);
      return false;
    } finally {
      state.actionInFlight = false;
    }
  }

  async function handleDeepNudge() {
    if (!automationReady() || !state.settings.deepNudgesEnabled || state.actionInFlight) return false;
    if (updateGenerationState() || !safeForInput()) return false;

    const lastNudgeAt = state.runtime.history.nudge.at(-1) || 0;
    if (now() - lastNudgeAt < state.settings.deepNudgeCooldownSec * 1000) return false;

    const idleBaseline = Math.max(state.pageLoadedAt, state.runtime.lastUserActivityAt, state.runtime.lastGenerationAt, state.runtime.lastActionAt);
    if (now() - idleBaseline < state.settings.deepNudgeIdleSec * 1000) return false;
    return sendDeepNudge("idle");
  }

  async function handlePeriodicRefresh() {
    if (!automationReady() || !state.settings.autoRefreshEnabled || state.actionInFlight) return false;
    scheduleNextRefresh();
    if (now() < state.runtime.nextRefreshAt) return false;
    if (updateGenerationState() || !safeForInput()) return false;

    const idleBaseline = Math.max(state.pageLoadedAt, state.runtime.lastUserActivityAt, state.runtime.lastGenerationAt, state.runtime.lastActionAt);
    if (now() - idleBaseline < state.settings.refreshIdleMin * 60 * 1000) return false;
    return refreshPage("scheduled idle refresh");
  }

  async function runCycle() {
    if (state.destroyed || state.cycleInFlight || !state.loaded || state.reloadScheduled) return;
    state.cycleInFlight = true;
    try {
      if (!routeIsCurrent()) {
        await handleRouteChange();
        return;
      }
      if (await handleErrorState()) return;
      if (await handleApprovalCards()) return;
      if (await handleQueue(true)) return;
      if (await handleDeepNudge()) return;
      await handlePeriodicRefresh();
    } catch (error) {
      if (!disableStaleContext(error)) await setLastAction(`Automation error: ${String(error?.message || error)}`, "error", "engine.error", true);
    } finally {
      state.cycleInFlight = false;
    }
  }

  function queueCycle() {
    if (state.destroyed || state.scanQueued || state.reloadScheduled) return;
    state.scanQueued = true;
    window.setTimeout(() => {
      state.scanQueued = false;
      runCycle();
    }, 300);
  }

  function restartScanTimer() {
    window.clearInterval(state.scanTimer);
    if (state.destroyed || state.reloadScheduled) return;
    state.scanTimer = window.setInterval(runCycle, state.settings.scanIntervalSec * 1000);
  }

  async function handleRouteChange() {
    const nextPageId = currentPageId();
    if (nextPageId === state.pageId || state.routeInFlight || state.reloadScheduled) return;

    state.routeInFlight = true;
    try {
      saveRuntime();
      state.pageId = nextPageId;
      state.platform = Platforms.adapterForLocation();
      state.pageLoadedAt = now();
      state.loaded = false;
      clearBlocked();
      state.generationActive = false;
      await loadSettings();
      restartScanTimer();
      await setLastAction("Loaded settings for this conversation", "info", "route.loaded");
      queueCycle();
    } finally {
      state.routeInFlight = false;
    }
  }

  function markUserActivity(event) {
    if (!state.runtime || event?.isTrusted === false) return;
    state.runtime.lastUserActivityAt = now();
    window.clearTimeout(state.activitySaveTimer);
    state.activitySaveTimer = window.setTimeout(saveRuntime, 500);
  }


  function installStorageListener() {
    state.storageListener = (changes, areaName) => {
      if (state.destroyed || areaName !== "local") return;
      const pageChange = changes[Config.pageSettingsKey(state.pageId)];
      if (pageChange?.newValue) {
        state.settings = Config.normalizeSettings(pageChange.newValue);
        scheduleNextRefresh(true);
        scheduleNextQueue(true);
        restartScanTimer();
        queueCycle();
      }
      const actionChange = changes[Config.lastActionKey(state.pageId)];
      if (actionChange?.newValue?.message) state.lastAction = actionChange.newValue;
    };
    chrome.storage.onChanged.addListener(state.storageListener);
  }

  function installObservers() {
    state.observer = new MutationObserver(queueCycle);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.addEventListener(eventName, markUserActivity, true);
    }

    restartScanTimer();
    state.routeTimer = window.setInterval(handleRouteChange, 500);
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
      generating: state.generationActive
    };
  }

  async function runManualAction(action) {
    if (!await ensureCurrentRoute()) return false;
    if (action === "nudge") return sendDeepNudge("manual", false);
    if (action === "continue") return sendContinue("manual", false);
    if (action === "refresh") return refreshPage("manual", false);
    if (action === "queue-next") return handleQueue(false);
    if (action === "scan") {
      await runCycle();
      return true;
    }
    return false;
  }

  async function resetRuntime() {
    if (!await ensureCurrentRoute()) throw new Error("Conversation navigation is still in progress");
    state.runtime = freshRuntime();
    scheduleNextRefresh(true);
    scheduleNextQueue(false);
    saveRuntime();
    clearBlocked();
    await setLastAction("Reset session limits and action history", "info", "runtime.reset", true);
  }

  function installMessages() {
    state.messageListener = (message, _sender, sendResponse) => {
      if (state.destroyed) return false;

      if (message?.type === "YOLO_GET_STATE") {
        ensureCurrentRoute()
          .then((ready) => {
            if (ready) updateGenerationState();
            sendResponse(ready ? responseState() : null);
          })
          .catch(() => sendResponse(null));
        return true;
      }

      if (message?.type === "YOLO_SET_SETTINGS" || message?.type === "YOLO_SET_TAB_SETTINGS") {
        persistSettings(message.settings || {})
          .then((settings) => {
            sendResponse({ ok: true, settings, state: responseState() });
            queueCycle();
          })
          .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error), state: responseState() }));
        return true;
      }

      if (message?.type === "YOLO_RUN_ACTION") {
        runManualAction(message.action)
          .then((ok) => sendResponse({ ok, state: responseState() }))
          .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error), state: responseState() }));
        return true;
      }

      if (message?.type === "YOLO_RESET_RUNTIME") {
        resetRuntime()
          .then(() => sendResponse({ ok: true, state: responseState() }))
          .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error), state: responseState() }));
        return true;
      }

      return false;
    };
    chrome.runtime.onMessage.addListener(state.messageListener);
  }

  function destroy() {
    state.destroyed = true;
    state.observer?.disconnect();
    window.clearInterval(state.scanTimer);
    window.clearInterval(state.routeTimer);
    window.clearTimeout(state.activitySaveTimer);
    if (state.messageListener) chrome.runtime.onMessage.removeListener(state.messageListener);
    if (state.storageListener) chrome.storage.onChanged.removeListener(state.storageListener);
    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.removeEventListener(eventName, markUserActivity, true);
    }
  }

  window.__YOLO_EXTENSION__ = { version: Config.VERSION, destroy };

  installMessages();
  loadSettings().then(() => {
    if (state.destroyed) return;
    installStorageListener();
    installObservers();
    runCycle();
  }).catch((error) => {
    if (!disableStaleContext(error)) setLastAction(`Startup failed: ${String(error?.message || error)}`, "error", "startup.failed", true);
  });
})();
