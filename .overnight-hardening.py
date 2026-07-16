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
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:180]!r}")
    write(path, content.replace(old, new))


write("lifecycle.js", r'''((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOLifecycle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const VISIBLE_WORKFLOW_POLL_MS = 750;
  const HIDDEN_ACTIVE_WORKFLOW_POLL_MS = 5_000;
  const HIDDEN_IDLE_WORKFLOW_POLL_MS = 15_000;
  const MIN_HIDDEN_SCAN_MS = 5_000;
  const MIN_HIDDEN_GENERATING_SCAN_MS = 10_000;
  const VISIBLE_MUTATION_DEBOUNCE_MS = 350;
  const HIDDEN_MUTATION_DEBOUNCE_MS = 1_500;
  const HIDDEN_GENERATING_MUTATION_DEBOUNCE_MS = 5_000;
  const HYDRATION_QUIET_MS = 1_500;
  const MARKER_RESPONSE_STABLE_MS = 5_000;
  const MISSING_MARKER_RESPONSE_STABLE_MS = 5 * 60 * 1_000;
  const REFRESH_QUIET_MS = 60_000;

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function scanDelay({ hidden = false, generating = false, configuredSec = 3 } = {}) {
    const configured = Math.max(1_000, finite(configuredSec, 3) * 1_000);
    if (!hidden) return configured;
    return Math.max(configured, generating ? MIN_HIDDEN_GENERATING_SCAN_MS : MIN_HIDDEN_SCAN_MS);
  }

  function routeDelay({ hidden = false } = {}) {
    return hidden ? 3_000 : 750;
  }

  function mutationDelay({ hidden = false, generating = false } = {}) {
    if (!hidden) return VISIBLE_MUTATION_DEBOUNCE_MS;
    return generating ? HIDDEN_GENERATING_MUTATION_DEBOUNCE_MS : HIDDEN_MUTATION_DEBOUNCE_MS;
  }

  function workflowPollDelay({ hidden = false, workflowActive = false, generating = false } = {}) {
    if (!hidden) return VISIBLE_WORKFLOW_POLL_MS;
    return workflowActive || generating ? HIDDEN_ACTIVE_WORKFLOW_POLL_MS : HIDDEN_IDLE_WORKFLOW_POLL_MS;
  }

  function responseStableMs(outcome) {
    return outcome === "missing" ? MISSING_MARKER_RESPONSE_STABLE_MS : MARKER_RESPONSE_STABLE_MS;
  }

  function hydrationCandidate({ documentReadyState = "loading", composerPresent = false, lastDomActivityAt = 0, now = Date.now() } = {}) {
    if (documentReadyState === "loading" || !composerPresent) return false;
    return now - Math.max(0, finite(lastDomActivityAt, 0)) >= HYDRATION_QUIET_MS;
  }

  function canAutomaticRefresh({
    hydrated = false,
    workflowActive = false,
    generating = false,
    composerBusy = false,
    lastDomActivityAt = 0,
    now = Date.now(),
    quietMs = REFRESH_QUIET_MS
  } = {}) {
    if (!hydrated || workflowActive || generating || composerBusy) return false;
    return now - Math.max(0, finite(lastDomActivityAt, 0)) >= Math.max(0, finite(quietMs, REFRESH_QUIET_MS));
  }

  function shouldProtectTab({ enabled = false, workflowStatus = "idle" } = {}) {
    return Boolean(enabled && workflowStatus === "running");
  }

  return Object.freeze({
    VISIBLE_WORKFLOW_POLL_MS,
    HIDDEN_ACTIVE_WORKFLOW_POLL_MS,
    HIDDEN_IDLE_WORKFLOW_POLL_MS,
    HYDRATION_QUIET_MS,
    MARKER_RESPONSE_STABLE_MS,
    MISSING_MARKER_RESPONSE_STABLE_MS,
    REFRESH_QUIET_MS,
    scanDelay,
    routeDelay,
    mutationDelay,
    workflowPollDelay,
    responseStableMs,
    hydrationCandidate,
    canAutomaticRefresh,
    shouldProtectTab
  });
});
''')

write("tab-supervisor.js", r'''(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  const Lifecycle = globalThis.YOLOLifecycle;
  if (!Config || !Lifecycle || !chrome.alarms || !chrome.tabs || !chrome.scripting) return;

  const ALARM_NAME = "yolo-tab-supervisor";
  const INJECTION_COOLDOWN_MS = 5 * 60 * 1_000;
  const MAX_INJECTIONS_PER_SWEEP = 2;
  const SCRIPT_FILES = Object.freeze([
    "config.js",
    "lifecycle.js",
    "platforms.js",
    "commands.js",
    "command-ui.js",
    "content.js",
    "command-runtime.js"
  ]);
  const lastInjectionAt = new Map();

  const tabsQuery = (queryInfo) => new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => resolve(chrome.runtime.lastError ? [] : tabs || []));
  });

  const tabsGet = (tabId) => new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(chrome.runtime.lastError ? null : tab || null));
  });

  const tabsUpdate = (tabId, updateProperties) => new Promise((resolve) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => resolve(chrome.runtime.lastError ? null : tab || null));
  });

  const sendHealth = (tabId) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "YOLOTAB_HEALTH_CHECK" }, (response) => {
      resolve(chrome.runtime.lastError ? null : response || null);
    });
  });

  const injectScripts = (tabId) => new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId }, files: SCRIPT_FILES }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });

  function ensureAlarm() {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      if (!alarm) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
    });
  }

  function canInspect(tab) {
    return Boolean(tab?.id
      && Config.isSupportedUrl(tab.url || tab.pendingUrl || "")
      && !tab.discarded
      && !tab.frozen
      && tab.status !== "loading");
  }

  async function inspect(tab, { allowInjection = true } = {}) {
    if (!canInspect(tab)) return { inspected: false, injected: false };
    let health = await sendHealth(tab.id);
    let injected = false;

    if (!health?.ok && allowInjection) {
      const previous = lastInjectionAt.get(tab.id) || 0;
      if (Date.now() - previous >= INJECTION_COOLDOWN_MS) {
        lastInjectionAt.set(tab.id, Date.now());
        injected = await injectScripts(tab.id);
        if (injected) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          health = await sendHealth(tab.id);
        }
      }
    }

    if (!health?.ok) return { inspected: true, injected };
    const protect = Lifecycle.shouldProtectTab({
      enabled: health.settings?.protectActiveWorkflowTabs,
      workflowStatus: health.workflow?.status
    });
    const desiredAutoDiscardable = !protect;
    if (tab.autoDiscardable !== desiredAutoDiscardable) {
      await tabsUpdate(tab.id, { autoDiscardable: desiredAutoDiscardable });
    }
    return { inspected: true, injected };
  }

  async function sweep() {
    const tabs = await tabsQuery({ url: ["https://chatgpt.com/*", "https://*.chatgpt.com/*"] });
    tabs.sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
    let injections = 0;
    for (const tab of tabs) {
      const result = await inspect(tab, { allowInjection: injections < MAX_INJECTIONS_PER_SWEEP });
      if (result.injected) injections += 1;
    }
    const liveIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of lastInjectionAt.keys()) if (!liveIds.has(tabId)) lastInjectionAt.delete(tabId);
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name === ALARM_NAME) sweep().catch(() => {});
  });
  chrome.runtime.onStartup?.addListener(() => {
    ensureAlarm();
    sweep().catch(() => {});
  });
  chrome.runtime.onInstalled?.addListener(() => {
    ensureAlarm();
    sweep().catch(() => {});
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "complete") return;
    tabsGet(tabId).then((tab) => tab && inspect(tab)).catch(() => {});
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    tabsGet(tabId).then((tab) => tab && inspect(tab)).catch(() => {});
  });
  chrome.tabs.onRemoved.addListener((tabId) => lastInjectionAt.delete(tabId));

  ensureAlarm();
})();
''')

replace_once(
    "manifest.json",
    '''  "permissions": [
    "scripting",
    "storage"
  ],''',
    '''  "permissions": [
    "alarms",
    "scripting",
    "storage"
  ],'''
)
replace_once(
    "manifest.json",
    '''        "config.js",
        "platforms.js",''',
    '''        "config.js",
        "lifecycle.js",
        "platforms.js",'''
)

replace_once(
    "background-wrapper.js",
    '''importScripts("background.js", "portability.js", "data-background.js");''',
    '''importScripts("lifecycle.js", "background.js", "portability.js", "data-background.js", "tab-supervisor.js");'''
)

replace_once(
    "scripts/package.mjs",
    '''  "background-wrapper.js",
  "background.js",''',
    '''  "background-wrapper.js",
  "tab-supervisor.js",
  "background.js",'''
)
replace_once(
    "scripts/package.mjs",
    '''  "portability.js",
  "config.js",''',
    '''  "portability.js",
  "config.js",
  "lifecycle.js",'''
)

replace_once(
    "package.json",
    '''"check": "node --check config.js && node --check coordinator.js''',
    '''"check": "node --check config.js && node --check lifecycle.js && node --check coordinator.js'''
)
replace_once(
    "package.json",
    '''node --check background-wrapper.js && node --check data-background.js''',
    '''node --check background-wrapper.js && node --check tab-supervisor.js && node --check data-background.js'''
)

replace_once(
    "config.js",
    '''    loadGraceSec: 10,
    scanIntervalSec: 3,
    maxActionsPerSession: 100,''',
    '''    loadGraceSec: 10,
    scanIntervalSec: 3,
    protectActiveWorkflowTabs: true,
    maxActionsPerSession: 100,'''
)
replace_once(
    "config.js",
    '''    loadGraceSec: { type: "number", min: 0, max: 600, integer: false },
    scanIntervalSec: { type: "number", min: 1, max: 60, integer: false },
    maxActionsPerSession: { type: "number", min: 0, max: 10000, integer: true },''',
    '''    loadGraceSec: { type: "number", min: 0, max: 600, integer: false },
    scanIntervalSec: { type: "number", min: 1, max: 60, integer: false },
    protectActiveWorkflowTabs: { type: "boolean" },
    maxActionsPerSession: { type: "number", min: 0, max: 10000, integer: true },'''
)

replace_once(
    "options.html",
    '''            <label class="setting-row"><span class="control-copy"><strong>Scan interval</strong><small>How often the automation engine checks page state.</small></span><div class="number-control"><input data-setting="scanIntervalSec" data-kind="number" type="number" min="1" step="1"><em>sec</em></div></label>
            <label class="setting-row"><span class="control-copy"><strong>Session action limit</strong>''',
    '''            <label class="setting-row"><span class="control-copy"><strong>Scan interval</strong><small>Visible-tab baseline. Hidden and generating tabs automatically back off further.</small></span><div class="number-control"><input data-setting="scanIntervalSec" data-kind="number" type="number" min="1" step="1"><em>sec</em></div></label>
            <label class="setting-row"><span class="control-copy"><strong>Protect active workflows</strong><small>Keep running Goal/Loop tabs out of Chrome Memory Saver. Disable this when memory pressure matters more than uninterrupted overnight work.</small></span><input data-setting="protectActiveWorkflowTabs" data-kind="boolean" type="checkbox" role="switch" aria-label="Protect active workflow tabs from automatic discard"></label>
            <label class="setting-row"><span class="control-copy"><strong>Session action limit</strong>'''
)
replace_once(
    "options.html",
    '''data-search-text="safety engine load grace scan interval session action limit composer draft protection"''',
    '''data-search-text="safety engine load grace scan interval session action limit composer draft protection tabs memory saver overnight workflow"'''
)

replace_once(
    "docs/PERMISSIONS.md",
    '''## `storage`

Stores settings, queue state, templates, counters, and bounded workflow state in `chrome.storage.local`.

## `scripting`''',
    '''## `alarms`

Wakes the lightweight background tab supervisor about once per minute. The supervisor restores missing packaged content scripts and updates Chrome's `autoDiscardable` hint for active Goal/Loop tabs. It never reloads, activates, closes, or reads arbitrary tabs.

## `storage`

Stores settings, queue state, templates, counters, and bounded workflow state in `chrome.storage.local`.

## `scripting`'''
)

replace_once(
    "content.js",
    '''  const Config = globalThis.YOLOConfig;
  const Commands = globalThis.YOLOCommands;
  const Platforms = globalThis.YOLOPlatforms;
  if (!Config || !Commands || !Platforms) return;''',
    '''  const Config = globalThis.YOConfig || globalThis.YOLOConfig;
  const Lifecycle = globalThis.YOLOLifecycle;
  const Commands = globalThis.YOLOCommands;
  const Platforms = globalThis.YOLOPlatforms;
  if (!Config || !Lifecycle || !Commands || !Platforms) return;'''
)
replace_once(
    "content.js",
    '''    pageLoadedAt: Date.now(),
    observer: null,
    scanTimer: null,
    routeTimer: null,
    activitySaveTimer: null,''',
    '''    pageLoadedAt: Date.now(),
    hydrated: false,
    hydratedAt: 0,
    hydrationCandidateSince: 0,
    lastDomActivityAt: Date.now(),
    generationHoldUntil: 0,
    observer: null,
    scanTimer: null,
    routeTimer: null,
    activitySaveTimer: null,
    lifecycleHandlers: [],'''
)
replace_once(
    "content.js",
    '''  const currentPageId = () => Config.pageId(location.href);
  const routeIsCurrent = () => currentPageId() === state.pageId;
  const isContextInvalidated''',
    '''  const currentPageId = () => Config.pageId(location.href);
  const routeIsCurrent = () => currentPageId() === state.pageId;
  const workflowHealth = () => window.__YOLO_COMMAND_RUNTIME__?.getHealth?.() || {
    status: "idle",
    active: false,
    awaitingResponse: false,
    pendingItemId: ""
  };
  const isContextInvalidated'''
)
replace_once(
    "content.js",
    '''  function automationReady() {
    if (!state.loaded || state.destroyed || !state.platform || !state.settings.enabled || !routeIsCurrent()) return false;
    if (!Config.isDurablePageId(state.pageId)) return false;
    return now() - state.pageLoadedAt >= state.settings.loadGraceSec * 1000;
  }

  function safeForInput() {
    if (!routeIsCurrent() || !Config.isDurablePageId(state.pageId)) return false;
    if (state.generationActive || Platforms.isGenerating(state.platform)) return false;
    if (composerHasText()) return false;
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
  }''',
    '''  function probeHydration() {
    if (state.hydrated) return true;
    const composerPresent = Boolean(Platforms.findComposer(state.platform));
    const candidate = Lifecycle.hydrationCandidate({
      documentReadyState: document.readyState,
      composerPresent,
      lastDomActivityAt: state.lastDomActivityAt,
      now: now()
    });
    if (!candidate) {
      state.hydrationCandidateSince = 0;
      return false;
    }
    if (!state.hydrationCandidateSince) state.hydrationCandidateSince = now();
    if (now() - state.hydrationCandidateSince < Lifecycle.HYDRATION_QUIET_MS) return false;
    state.hydrated = true;
    state.hydratedAt = now();
    return true;
  }

  function automationReady() {
    if (!state.loaded || state.destroyed || !state.platform || !state.settings.enabled || !routeIsCurrent()) return false;
    if (!Config.isDurablePageId(state.pageId) || !probeHydration()) return false;
    return now() - Math.max(state.pageLoadedAt, state.hydratedAt) >= state.settings.loadGraceSec * 1000;
  }

  function safeForInput() {
    if (!routeIsCurrent() || !Config.isDurablePageId(state.pageId) || !probeHydration()) return false;
    const workflow = workflowHealth();
    if (workflow.awaitingResponse || workflow.pendingItemId) return false;
    if (state.generationActive || Platforms.isGenerating(state.platform) || now() < state.generationHoldUntil) return false;
    if (now() - state.lastDomActivityAt < 1_500) return false;
    if (composerHasText()) return false;
    return true;
  }

  function updateGenerationState() {
    const active = Platforms.isGenerating(state.platform);
    const timestamp = now();
    if (state.runtime) {
      if (active) {
        state.runtime.lastGenerationAt = timestamp;
        state.generationHoldUntil = Math.max(state.generationHoldUntil, timestamp + 60_000);
      }
      if (state.generationActive && !active) {
        state.runtime.lastGenerationAt = timestamp;
        state.generationHoldUntil = Math.max(state.generationHoldUntil, timestamp + 15_000);
      }
      saveRuntime();
    }
    state.generationActive = active;
    return active;
  }'''
)
replace_once(
    "content.js",
    '''    if (automatic && !automationReady()) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent() || !Config.isDurablePageId(state.pageId))) return false;
    if (updateGenerationState() || composerHasText()) return false;
    if (action === "refresh" && !refreshCooldownPassed()) return false;''',
    '''    if (automatic && !automationReady()) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent() || !Config.isDurablePageId(state.pageId))) return false;
    const workflow = workflowHealth();
    const generating = updateGenerationState();
    if (action === "refresh" && automatic && !Lifecycle.canAutomaticRefresh({
      hydrated: state.hydrated,
      workflowActive: workflow.active,
      generating: generating || now() < state.generationHoldUntil,
      composerBusy: composerHasText(),
      lastDomActivityAt: state.lastDomActivityAt,
      now: now()
    })) return false;
    if (generating || composerHasText()) return false;
    if (action === "refresh" && !refreshCooldownPassed()) return false;'''
)
replace_once(
    "content.js",
    '''  async function runCycle() {
    if (state.destroyed || state.cycleInFlight || !state.loaded || state.reloadScheduled) return;
    state.cycleInFlight = true;
    try {
      if (!routeIsCurrent()) {
        await handleRouteChange();
        return;
      }
      if (await handleErrorState()) return;''',
    '''  async function runCycle() {
    if (state.destroyed || state.cycleInFlight || !state.loaded || state.reloadScheduled) return;
    state.cycleInFlight = true;
    try {
      if (!routeIsCurrent()) {
        await handleRouteChange();
        return;
      }
      updateGenerationState();
      if (!probeHydration()) return;
      if (await handleErrorState()) return;'''
)
replace_once(
    "content.js",
    '''  function queueCycle() {
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
  }''',
    '''  function queueCycle(delayMs = null) {
    if (state.destroyed || state.scanQueued || state.reloadScheduled) return;
    state.scanQueued = true;
    const delay = delayMs == null ? Lifecycle.mutationDelay({ hidden: document.hidden, generating: state.generationActive }) : delayMs;
    window.setTimeout(() => {
      state.scanQueued = false;
      runCycle();
    }, Math.max(0, delay));
  }

  function restartScanTimer() {
    window.clearTimeout(state.scanTimer);
    if (state.destroyed || state.reloadScheduled) return;
    const delay = Lifecycle.scanDelay({
      hidden: document.hidden,
      generating: state.generationActive,
      configuredSec: state.settings.scanIntervalSec
    });
    state.scanTimer = window.setTimeout(async () => {
      await runCycle();
      restartScanTimer();
    }, delay);
  }

  function restartRouteTimer() {
    window.clearTimeout(state.routeTimer);
    if (state.destroyed || state.reloadScheduled) return;
    state.routeTimer = window.setTimeout(async () => {
      await handleRouteChange();
      restartRouteTimer();
    }, Lifecycle.routeDelay({ hidden: document.hidden }));
  }'''
)
replace_once(
    "content.js",
    '''      state.pageLoadedAt = now();
      state.loaded = false;
      clearBlocked();
      state.generationActive = false;''',
    '''      state.pageLoadedAt = now();
      state.loaded = false;
      state.hydrated = false;
      state.hydratedAt = 0;
      state.hydrationCandidateSince = 0;
      state.lastDomActivityAt = now();
      state.generationHoldUntil = 0;
      clearBlocked();
      state.generationActive = false;'''
)
replace_once(
    "content.js",
    '''  function installObservers() {
    state.observer = new MutationObserver(queueCycle);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.addEventListener(eventName, markUserActivity, true);
    }

    restartScanTimer();
    state.routeTimer = window.setInterval(handleRouteChange, 500);
  }''',
    '''  function handleDomMutation() {
    state.lastDomActivityAt = now();
    if (state.generationActive) state.generationHoldUntil = Math.max(state.generationHoldUntil, now() + 60_000);
    queueCycle();
  }

  function addLifecycleHandler(target, eventName, handler) {
    target.addEventListener(eventName, handler);
    state.lifecycleHandlers.push({ target, eventName, handler });
  }

  function handleLifecycleWake() {
    if (state.destroyed) return;
    probeHydration();
    restartScanTimer();
    restartRouteTimer();
    queueCycle(0);
  }

  function handleLifecycleSuspend() {
    saveRuntime();
  }

  function installObservers() {
    state.observer = new MutationObserver(handleDomMutation);
    state.observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.addEventListener(eventName, markUserActivity, true);
    }
    addLifecycleHandler(document, "visibilitychange", handleLifecycleWake);
    addLifecycleHandler(window, "pageshow", handleLifecycleWake);
    addLifecycleHandler(window, "pagehide", handleLifecycleSuspend);
    addLifecycleHandler(document, "freeze", handleLifecycleSuspend);
    addLifecycleHandler(document, "resume", handleLifecycleWake);

    restartScanTimer();
    restartRouteTimer();
  }'''
)
replace_once(
    "content.js",
    '''      platform: state.platform?.label || "Unsupported",
      generating: state.generationActive
    };''',
    '''      platform: state.platform?.label || "Unsupported",
      generating: state.generationActive,
      hydrated: state.hydrated,
      lastDomActivityAt: state.lastDomActivityAt,
      lastGenerationAt: state.runtime?.lastGenerationAt || 0
    };'''
)
replace_once(
    "content.js",
    '''      if (message?.type === "YOLO_GET_STATE") {''',
    '''      if (message?.type === "YOLOTAB_HEALTH_CHECK") {
        updateGenerationState();
        probeHydration();
        const workflow = workflowHealth();
        sendResponse({
          ok: true,
          pageId: state.pageId,
          hydrated: state.hydrated,
          generating: state.generationActive,
          visible: !document.hidden,
          lastDomActivityAt: state.lastDomActivityAt,
          workflow,
          settings: { protectActiveWorkflowTabs: state.settings.protectActiveWorkflowTabs }
        });
        return false;
      }

      if (message?.type === "YOLO_GET_STATE") {'''
)
replace_once(
    "content.js",
    '''    window.clearInterval(state.scanTimer);
    window.clearInterval(state.routeTimer);''',
    '''    window.clearTimeout(state.scanTimer);
    window.clearTimeout(state.routeTimer);'''
)
replace_once(
    "content.js",
    '''    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.removeEventListener(eventName, markUserActivity, true);
    }
  }''',
    '''    for (const eventName of ["pointerdown", "keydown", "input", "focusin"]) {
      document.removeEventListener(eventName, markUserActivity, true);
    }
    for (const { target, eventName, handler } of state.lifecycleHandlers) target.removeEventListener(eventName, handler);
    state.lifecycleHandlers = [];
  }'''
)

replace_once(
    "command-runtime.js",
    '''  const Config = globalThis.YOLOConfig;
  const Platforms = globalThis.YOLOPlatforms;''',
    '''  const Config = globalThis.YOLOConfig;
  const Lifecycle = globalThis.YOLOLifecycle;
  const Platforms = globalThis.YOLOPlatforms;'''
)
replace_once(
    "command-runtime.js",
    '''  if (!Config || !Platforms || !Commands || !CommandUI) return;''',
    '''  if (!Config || !Lifecycle || !Platforms || !Commands || !CommandUI) return;'''
)
replace_once(
    "command-runtime.js",
    '''  const POLL_MS = 750;
  const RESPONSE_SETTLE_MS = 1200;
  const RESPONSE_STABLE_MS = 1400;''',
    '''  const POLL_MS = Lifecycle.VISIBLE_WORKFLOW_POLL_MS;
  const RESPONSE_SETTLE_MS = 1200;'''
)
replace_once(
    "command-runtime.js",
    '''    unregisterEngineClient: null,
    mutationLock: { current: Promise.resolve() },''',
    '''    unregisterEngineClient: null,
    lifecycleHandlers: [],
    mutationLock: { current: Promise.resolve() },'''
)
replace_once(
    "command-runtime.js",
    '''  async function handleWorkflow() {
    if (Commands.normalizeWorkflow(state.workflow).status !== "running") return false;''',
    '''  async function handleWorkflow() {
    if (Commands.normalizeWorkflow(state.workflow).status !== "running") return false;'''
)
replace_once(
    "command-runtime.js",
    '''    const apiState = api.getState();

    if (workflow.pendingItemId) return handlePendingWorkflowItem(apiState);''',
    '''    const apiState = api.getState();
    if (!apiState.hydrated) return false;

    if (workflow.pendingItemId) return handlePendingWorkflowItem(apiState);'''
)
replace_once(
    "command-runtime.js",
    '''    if (workflow.responseCandidateFingerprint !== candidateFingerprint) {
      workflow.responseCandidateFingerprint = candidateFingerprint;
      workflow.responseCandidateSince = now();
      workflow.reason = "Waiting for ChatGPT response to settle";
      workflow.updatedAt = now();
      await writeWorkflow(workflow);
      return false;
    }
    if (now() - workflow.responseCandidateSince < RESPONSE_STABLE_MS) return false;
    return processResponse();''',
    '''    if (workflow.responseCandidateFingerprint !== candidateFingerprint) {
      workflow.responseCandidateFingerprint = candidateFingerprint;
      workflow.responseCandidateSince = now();
      workflow.reason = "Waiting for ChatGPT response to settle";
      workflow.updatedAt = now();
      await writeWorkflow(workflow);
      return false;
    }
    const outcome = Commands.evaluateResponse(assistantText);
    const quietSince = Math.max(workflow.responseCandidateSince, apiState.lastDomActivityAt || 0, apiState.lastGenerationAt || 0);
    if (now() - quietSince < Lifecycle.responseStableMs(outcome)) return false;
    return processResponse();'''
)
replace_once(
    "command-runtime.js",
    '''      syncUI();
      state.ui?.reposition?.();
    } finally {''',
    '''      syncUI();
      if (!document.hidden) state.ui?.reposition?.();
    } finally {'''
)
replace_once(
    "command-runtime.js",
    '''  function destroy() {
    if (state.destroyed) return;
    releaseWorkflow();
    state.destroyed = true;
    window.clearInterval(state.pollTimer);
    state.unregisterEngineClient?.();
    state.ui?.destroy?.();
  }

  window.__YOLO_COMMAND_RUNTIME__ = { version: Config.VERSION, destroy };
  mountUI();
  const api = engine();
  state.unregisterEngineClient = api?.registerClient?.(destroy) || null;
  syncRoute().then(tick);
  state.pollTimer = window.setInterval(tick, POLL_MS);''',
    '''  function getHealth() {
    const workflow = Commands.normalizeWorkflow(state.workflow);
    return {
      status: workflow.status,
      active: workflow.status === "running",
      awaitingResponse: workflow.awaitingResponse,
      pendingItemId: workflow.pendingItemId,
      iteration: workflow.iteration,
      lastPromptAt: workflow.lastPromptAt
    };
  }

  function schedulePoll(immediate = false) {
    window.clearTimeout(state.pollTimer);
    if (state.destroyed) return;
    const apiState = engine()?.getState?.() || {};
    const delay = immediate ? 0 : Lifecycle.workflowPollDelay({
      hidden: document.hidden,
      workflowActive: getHealth().active,
      generating: Boolean(apiState.generating)
    });
    state.pollTimer = window.setTimeout(async () => {
      await tick();
      schedulePoll();
    }, delay);
  }

  function addLifecycleHandler(target, eventName, handler) {
    target.addEventListener(eventName, handler);
    state.lifecycleHandlers.push({ target, eventName, handler });
  }

  function wakeRuntime() {
    if (!state.destroyed) schedulePoll(true);
  }

  function destroy() {
    if (state.destroyed) return;
    releaseWorkflow();
    state.destroyed = true;
    window.clearTimeout(state.pollTimer);
    state.unregisterEngineClient?.();
    state.ui?.destroy?.();
    for (const { target, eventName, handler } of state.lifecycleHandlers) target.removeEventListener(eventName, handler);
    state.lifecycleHandlers = [];
  }

  window.__YOLO_COMMAND_RUNTIME__ = { version: Config.VERSION, destroy, getHealth };
  mountUI();
  const api = engine();
  state.unregisterEngineClient = api?.registerClient?.(destroy) || null;
  addLifecycleHandler(document, "visibilitychange", wakeRuntime);
  addLifecycleHandler(window, "pageshow", wakeRuntime);
  addLifecycleHandler(document, "resume", wakeRuntime);
  syncRoute().then(() => schedulePoll(true));'''
)

replace_once(
    "tests/manifest.test.js",
    '''    "config.js",
    "platforms.js",''',
    '''    "config.js",
    "lifecycle.js",
    "platforms.js",'''
)
replace_once(
    "tests/manifest.test.js",
    '''  assert.deepEqual(manifest.permissions, ["scripting", "storage"]);''',
    '''  assert.deepEqual(manifest.permissions, ["alarms", "scripting", "storage"]);'''
)
replace_once(
    "tests/release.test.js",
    '''  assert.deepEqual(manifest.permissions, ["scripting", "storage"]);''',
    '''  assert.deepEqual(manifest.permissions, ["alarms", "scripting", "storage"]);'''
)
replace_once(
    "tests/portability-integration.test.js",
    '''  assert.deepEqual(manifest.permissions, ["scripting", "storage"]);''',
    '''  assert.deepEqual(manifest.permissions, ["alarms", "scripting", "storage"]);'''
)
replace_once(
    "tests/portability-integration.test.js",
    '''  for (const file of ["background-wrapper.js", "portable-store.js", "data-background.js", "portability.js", "options-portability.js"]) {''',
    '''  for (const file of ["background-wrapper.js", "tab-supervisor.js", "lifecycle.js", "portable-store.js", "data-background.js", "portability.js", "options-portability.js"]) {'''
)
replace_once(
    "tests/portability-integration.test.js",
    '''  assert.equal(read("background-wrapper.js").trim(), '"use strict";\n\nimportScripts("background.js", "portability.js", "data-background.js");');''',
    '''  assert.equal(read("background-wrapper.js").trim(), '"use strict";\n\nimportScripts("lifecycle.js", "background.js", "portability.js", "data-background.js", "tab-supervisor.js");');'''
)

write("tests/lifecycle.test.js", r'''const test = require("node:test");
const assert = require("node:assert/strict");
const Lifecycle = require("../lifecycle.js");

test("hidden tabs back off scans and workflow polling", () => {
  assert.equal(Lifecycle.scanDelay({ hidden: false, configuredSec: 3 }), 3000);
  assert.equal(Lifecycle.scanDelay({ hidden: true, generating: false, configuredSec: 3 }), 5000);
  assert.equal(Lifecycle.scanDelay({ hidden: true, generating: true, configuredSec: 3 }), 10000);
  assert.equal(Lifecycle.workflowPollDelay({ hidden: false, workflowActive: true }), 750);
  assert.equal(Lifecycle.workflowPollDelay({ hidden: true, workflowActive: true }), 5000);
  assert.equal(Lifecycle.workflowPollDelay({ hidden: true, workflowActive: false }), 15000);
});

test("hydration waits for a real composer and a quiet DOM", () => {
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "loading", composerPresent: true, lastDomActivityAt: 0, now: 5000 }), false);
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "complete", composerPresent: false, lastDomActivityAt: 0, now: 5000 }), false);
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "complete", composerPresent: true, lastDomActivityAt: 4500, now: 5000 }), false);
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "complete", composerPresent: true, lastDomActivityAt: 3000, now: 5000 }), true);
});

test("missing workflow markers require a long quiet window", () => {
  assert.equal(Lifecycle.responseStableMs("continue"), 5000);
  assert.equal(Lifecycle.responseStableMs("done"), 5000);
  assert.equal(Lifecycle.responseStableMs("missing"), 5 * 60 * 1000);
});

test("scheduled refresh fails closed around work and recent activity", () => {
  const base = { hydrated: true, workflowActive: false, generating: false, composerBusy: false, lastDomActivityAt: 0, now: 120000 };
  assert.equal(Lifecycle.canAutomaticRefresh(base), true);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, workflowActive: true }), false);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, generating: true }), false);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, composerBusy: true }), false);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, lastDomActivityAt: 90000 }), false);
});

test("only explicitly enabled running workflows are protected from discard", () => {
  assert.equal(Lifecycle.shouldProtectTab({ enabled: true, workflowStatus: "running" }), true);
  assert.equal(Lifecycle.shouldProtectTab({ enabled: false, workflowStatus: "running" }), false);
  assert.equal(Lifecycle.shouldProtectTab({ enabled: true, workflowStatus: "completed" }), false);
});
''')

write("tests/overnight-reliability.test.js", r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("the tab supervisor is alarm-driven, staggered, and never force reloads or activates tabs", () => {
  const source = read("tab-supervisor.js");
  assert.match(source, /periodInMinutes: 1/);
  assert.match(source, /MAX_INJECTIONS_PER_SWEEP = 2/);
  assert.match(source, /tab\.discarded/);
  assert.match(source, /tab\.frozen/);
  assert.match(source, /tab\.status !== "loading"/);
  assert.doesNotMatch(source, /tabs\.reload|location\.reload|tabs\.discard|active: true/);
});

test("active workflow protection is explicit and returns idle tabs to Memory Saver", () => {
  const source = read("tab-supervisor.js");
  assert.match(source, /protectActiveWorkflowTabs/);
  assert.match(source, /autoDiscardable: desiredAutoDiscardable/);
  const options = read("options.html");
  assert.match(options, /data-setting="protectActiveWorkflowTabs"/);
  assert.match(options, /Memory Saver/);
});

test("content and command runtimes use adaptive one-shot timers instead of hot intervals", () => {
  const content = read("content.js");
  const runtime = read("command-runtime.js");
  assert.match(content, /Lifecycle\.scanDelay/);
  assert.match(content, /Lifecycle\.mutationDelay/);
  assert.match(content, /Lifecycle\.routeDelay/);
  assert.doesNotMatch(content, /setInterval\(runCycle|setInterval\(handleRouteChange/);
  assert.match(runtime, /Lifecycle\.workflowPollDelay/);
  assert.doesNotMatch(runtime, /setInterval\(tick/);
});

test("long turns cannot be refreshed or interpreted before hydration and quiet completion", () => {
  const content = read("content.js");
  const runtime = read("command-runtime.js");
  assert.match(content, /probeHydration/);
  assert.match(content, /Lifecycle\.canAutomaticRefresh/);
  assert.match(content, /workflowActive: workflow\.active/);
  assert.match(runtime, /if \(!apiState\.hydrated\) return false/);
  assert.match(runtime, /Lifecycle\.responseStableMs\(outcome\)/);
  assert.match(runtime, /apiState\.lastDomActivityAt/);
});

test("background supervision adds only the narrow alarms permission", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.deepEqual(manifest.permissions, ["alarms", "scripting", "storage"]);
  assert.equal(manifest.permissions.includes("tabs"), false);
  assert.equal(manifest.permissions.includes("activeTab"), false);
});
''')

write("docs/OVERNIGHT_RELIABILITY.md", r'''# Overnight and multi-tab reliability

YOLO is designed to survive many long-running ChatGPT conversations without treating every tab as a foreground page.

## Operating model

- Visible tabs use the normal configured scan cadence.
- Hidden tabs back off automation scans, route checks, workflow polling, and mutation-triggered work.
- A page is not considered ready until the document is loaded, the composer exists, and the DOM has been quiet long enough to indicate hydration has settled.
- Goal and Loop responses with a valid terminal marker require a short stability window. Responses without a marker are not declared malformed until five quiet minutes have passed.
- Scheduled idle refresh is blocked whenever a workflow is running, ChatGPT appears to be generating, the composer contains a draft, the page is not hydrated, or the DOM changed within the last minute.
- A one-minute background alarm checks loaded ChatGPT tabs, restores missing packaged content scripts at a bounded rate, and updates the tab discard hint. It never activates or reloads a tab.

## Memory behavior

YOLO does not delete old ChatGPT messages, replace React nodes, inject CSS that merely hides history, or attempt to garbage-collect ChatGPT internals. Those approaches are brittle and do not reliably release the application’s retained memory.

When **Protect active workflows** is enabled, tabs with a running Goal or Loop are marked `autoDiscardable: false`. Once the workflow is no longer running, YOLO restores `autoDiscardable: true` so Chrome Memory Saver can reclaim the tab normally.

Protecting many huge conversations can consume substantial memory. Disable the setting when browser stability is more important than uninterrupted parallel work. Even a protected tab may still be terminated by the browser or operating system under extreme pressure; YOLO’s durable queues and workflows resume from persisted state when the page returns.

## Frozen and discarded tabs

A frozen tab cannot run timers or event handlers. A discarded tab has no loaded page at all. YOLO deliberately does not activate or force-reload these tabs because doing so can interrupt work and cause a reload storm. When the browser resumes or reloads the tab, lifecycle listeners immediately resynchronize the route, settings, queue, and workflow state.
''')
