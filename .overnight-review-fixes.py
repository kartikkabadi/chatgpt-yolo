from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:180]!r}")
    write(path, content.replace(old, new))


# Version the lifecycle change so reinjection replaces already-open v1.0.0 tabs.
for path in ["config.js", "manifest.json", "package.json"]:
    replace_once(path, '1.0.0', '1.1.0')
replace_once(
    "tests/manifest.test.js",
    '''  assert.equal(manifest.version, "1.0.0");''',
    '''  assert.equal(manifest.version, "1.1.0");'''
)
replace_once(
    "CHANGELOG.md",
    '''## 1.0.0 - release candidate''',
    '''## 1.1.0 - overnight reliability

- Added adaptive visible/hidden/generating tab scheduling for large multi-tab ChatGPT sessions.
- Added hydration and long-turn quiet-state guards before automation, response interpretation, or refresh.
- Added an alarm-driven tab supervisor with bounded packaged-script restoration and optional active-workflow discard protection.
- Added lifecycle recovery for page visibility, freeze/resume, extension updates, and same-route React rehydration.
- Reduced extension CPU and storage churn across long-running hidden conversations.

## 1.0.0 - release candidate'''
)

# Hidden Chrome timers can be throttled to roughly once per minute. Keep one owner stable across that gap.
replace_once(
    "background.js",
    '''const WORKFLOW_LEASE_MS = 15 * 1000;
const WORKFLOW_RENEW_WINDOW_MS = 5 * 1000;''',
    '''const WORKFLOW_LEASE_MS = 2 * 60 * 1000;
const WORKFLOW_RENEW_WINDOW_MS = 30 * 1000;'''
)

# Long-turn response policy: valid terminal markers settle conservatively; missing markers wait beyond 100-minute turns.
replace_once(
    "lifecycle.js",
    '''  const MARKER_RESPONSE_STABLE_MS = 5_000;
  const MISSING_MARKER_RESPONSE_STABLE_MS = 5 * 60 * 1_000;''',
    '''  const MARKER_RESPONSE_STABLE_MS = 15_000;
  const MISSING_MARKER_RESPONSE_STABLE_MS = 3 * 60 * 60 * 1_000;'''
)
replace_once(
    "tests/lifecycle.test.js",
    '''  assert.equal(Lifecycle.responseStableMs("continue"), 5000);
  assert.equal(Lifecycle.responseStableMs("done"), 5000);
  assert.equal(Lifecycle.responseStableMs("missing"), 5 * 60 * 1000);''',
    '''  assert.equal(Lifecycle.responseStableMs("continue"), 15000);
  assert.equal(Lifecycle.responseStableMs("done"), 15000);
  assert.equal(Lifecycle.responseStableMs("missing"), 3 * 60 * 60 * 1000);'''
)
replace_once(
    "docs/OVERNIGHT_RELIABILITY.md",
    '''- Goal and Loop responses with a valid terminal marker require a short stability window. Responses without a marker are not declared malformed until five quiet minutes have passed.''',
    '''- Goal and Loop responses with a valid terminal marker require fifteen quiet seconds. Responses without a marker are not declared malformed until three quiet hours have passed, so long reasoning/tool turns are not mistaken for finished answers.'''
)

# The workflow's own pending queue item must be allowed to send. Awaiting-response state still blocks unrelated input.
replace_once(
    "content.js",
    '''    if (workflow.awaitingResponse || workflow.pendingItemId) return false;''',
    '''    if (workflow.awaitingResponse) return false;'''
)

# Hydration is a live condition, not a permanent bit: same-route React reloads can remove the composer.
replace_once(
    "content.js",
    '''  function probeHydration() {
    if (state.hydrated) return true;
    const composerPresent = Boolean(Platforms.findComposer(state.platform));
    const candidate = Lifecycle.hydrationCandidate({''',
    '''  function probeHydration() {
    const composerPresent = Boolean(Platforms.findComposer(state.platform));
    if (document.readyState === "loading" || !composerPresent) {
      state.hydrated = false;
      state.hydratedAt = 0;
      state.hydrationCandidateSince = 0;
      return false;
    }
    if (state.hydrated) return true;
    const candidate = Lifecycle.hydrationCandidate({'''
)

# Avoid sessionStorage writes on every scan for multi-hour generation.
replace_once(
    "content.js",
    '''    generationHoldUntil: 0,
    observer: null,''',
    '''    generationHoldUntil: 0,
    lastGenerationPersistAt: 0,
    observer: null,'''
)
replace_once(
    "content.js",
    '''  function updateGenerationState() {
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
  }''',
    '''  function updateGenerationState() {
    const active = Platforms.isGenerating(state.platform);
    const timestamp = now();
    const transitioned = state.generationActive !== active;
    if (state.runtime) {
      if (active) {
        state.runtime.lastGenerationAt = timestamp;
        state.generationHoldUntil = Math.max(state.generationHoldUntil, timestamp + 60_000);
      }
      if (state.generationActive && !active) {
        state.runtime.lastGenerationAt = timestamp;
        state.generationHoldUntil = Math.max(state.generationHoldUntil, timestamp + 15_000);
      }
      if (transitioned || (active && timestamp - state.lastGenerationPersistAt >= 30_000)) {
        state.lastGenerationPersistAt = timestamp;
        saveRuntime();
      }
    }
    state.generationActive = active;
    return active;
  }'''
)
replace_once(
    "content.js",
    '''      state.generationHoldUntil = 0;
      clearBlocked();''',
    '''      state.generationHoldUntil = 0;
      state.lastGenerationPersistAt = 0;
      clearBlocked();'''
)

# Recursive timers must restart even when an unexpected exception escapes a callback.
replace_once(
    "content.js",
    '''    state.scanTimer = window.setTimeout(async () => {
      await runCycle();
      restartScanTimer();
    }, delay);''',
    '''    state.scanTimer = window.setTimeout(async () => {
      try {
        await runCycle();
      } finally {
        restartScanTimer();
      }
    }, delay);'''
)
replace_once(
    "content.js",
    '''    state.routeTimer = window.setTimeout(async () => {
      await handleRouteChange();
      restartRouteTimer();
    }, Lifecycle.routeDelay({ hidden: document.hidden }));''',
    '''    state.routeTimer = window.setTimeout(async () => {
      try {
        await handleRouteChange();
      } catch (error) {
        if (!disableStaleContext(error)) await setLastAction(`Route synchronization failed: ${String(error?.message || error)}`, "error", "route.sync_failed", true);
      } finally {
        restartRouteTimer();
      }
    }, Lifecycle.routeDelay({ hidden: document.hidden }));'''
)
replace_once(
    "command-runtime.js",
    '''    state.pollTimer = window.setTimeout(async () => {
      await tick();
      schedulePoll();
    }, delay);''',
    '''    state.pollTimer = window.setTimeout(async () => {
      try {
        await tick();
      } catch (error) {
        await record(`Workflow poll failed: ${String(error?.message || error)}`, "error", "command.workflow.poll_failed").catch(() => {});
      } finally {
        schedulePoll();
      }
    }, delay);'''
)

# Command runtime already repositions while visible and on scroll/resize; remove the extra per-tab one-second loop.
replace_once(
    "command-ui.js",
    '''    const positionTimer = window.setInterval(position, 1000);
    renderList();''',
    '''    renderList();'''
)
replace_once(
    "command-ui.js",
    '''      window.removeEventListener("scroll", position, true);
      window.clearInterval(positionTimer);
      host.remove();''',
    '''      window.removeEventListener("scroll", position, true);
      host.remove();'''
)

# Determine discard protection from durable storage, not a command runtime that may still be hydrating.
replace_once(
    "tab-supervisor.js",
    '''  const tabsGet = (tabId) => new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(chrome.runtime.lastError ? null : tab || null));
  });''',
    '''  const tabsGet = (tabId) => new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => resolve(chrome.runtime.lastError ? null : tab || null));
  });

  const storageGet = (keys) => new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => resolve(chrome.runtime.lastError ? {} : items || {}));
  });'''
)
replace_once(
    "tab-supervisor.js",
    '''  async function inspect(tab, { allowInjection = true } = {}) {
    if (!canInspect(tab)) return { inspected: false, injected: false };
    let health = await sendHealth(tab.id);
    let injected = false;''',
    '''  async function readProtection(tab) {
    const pageId = Config.pageId(tab.url || tab.pendingUrl || "");
    if (!Config.isDurablePageId(pageId)) return false;
    const pageKey = Config.pageSettingsKey(pageId);
    const workflowKey = Config.workflowKey(pageId);
    const stored = await storageGet([Config.STORAGE_KEYS.global, Config.STORAGE_KEYS.pages, pageKey, workflowKey]);
    const settings = Config.mergeSettings(
      Config.DEFAULT_SETTINGS,
      stored[Config.STORAGE_KEYS.global] || {},
      stored[pageKey] || stored[Config.STORAGE_KEYS.pages]?.[pageId] || {}
    );
    return Lifecycle.shouldProtectTab({
      enabled: settings.protectActiveWorkflowTabs,
      workflowStatus: stored[workflowKey]?.status
    });
  }

  async function inspect(tab, { allowInjection = true } = {}) {
    if (!canInspect(tab)) return { inspected: false, injected: false };
    const protect = await readProtection(tab);
    const desiredAutoDiscardable = !protect;
    if (tab.autoDiscardable !== desiredAutoDiscardable) {
      await tabsUpdate(tab.id, { autoDiscardable: desiredAutoDiscardable });
    }

    let health = await sendHealth(tab.id);
    let injected = false;'''
)
replace_once(
    "tab-supervisor.js",
    '''    if (!health?.ok) return { inspected: true, injected };
    const protect = Lifecycle.shouldProtectTab({
      enabled: health.settings?.protectActiveWorkflowTabs,
      workflowStatus: health.workflow?.status
    });
    const desiredAutoDiscardable = !protect;
    if (tab.autoDiscardable !== desiredAutoDiscardable) {
      await tabsUpdate(tab.id, { autoDiscardable: desiredAutoDiscardable });
    }
    return { inspected: true, injected };''',
    '''    return { inspected: true, injected, healthy: Boolean(health?.ok) };'''
)

# Documentation must be explicit about the long-turn timeout and versioned reinjection.
replace_once(
    "docs/OVERNIGHT_RELIABILITY.md",
    '''- A one-minute background alarm checks loaded ChatGPT tabs, restores missing packaged content scripts at a bounded rate, and updates the tab discard hint. It never activates or reloads a tab.''',
    '''- A one-minute background alarm checks loaded ChatGPT tabs, restores missing versioned packaged content scripts at a bounded rate, and updates the tab discard hint from durable settings/workflow state. It never activates or reloads a tab.'''
)

# Behavioral and source-contract regressions for the review findings.
write("tests/overnight-reliability.test.js", read("tests/overnight-reliability.test.js").rstrip() + r'''

test("workflow ownership survives hidden-tab timer throttling", () => {
  const background = read("background.js");
  assert.match(background, /WORKFLOW_LEASE_MS = 2 \* 60 \* 1000/);
  assert.match(background, /WORKFLOW_RENEW_WINDOW_MS = 30 \* 1000/);
});

test("the workflow queue can send its own pending prompt while awaiting responses still block input", () => {
  const content = read("content.js");
  const safeStart = content.indexOf("function safeForInput");
  const safeEnd = content.indexOf("function updateGenerationState", safeStart);
  const block = content.slice(safeStart, safeEnd);
  assert.match(block, /workflow\.awaitingResponse/);
  assert.doesNotMatch(block, /workflow\.pendingItemId/);
});

test("same-route hydration loss fails closed and long generation persistence is throttled", () => {
  const content = read("content.js");
  assert.match(content, /document\.readyState === "loading" \|\| !composerPresent/);
  assert.match(content, /state\.hydrated = false/);
  assert.match(content, /timestamp - state\.lastGenerationPersistAt >= 30_000/);
});

test("adaptive loops self-heal and the command UI has no independent position interval", () => {
  const content = read("content.js");
  const runtime = read("command-runtime.js");
  const ui = read("command-ui.js");
  assert.match(content, /finally \{\s*restartScanTimer\(\)/);
  assert.match(content, /finally \{\s*restartRouteTimer\(\)/);
  assert.match(runtime, /finally \{\s*schedulePoll\(\)/);
  assert.doesNotMatch(ui, /setInterval\(position/);
});

test("tab discard protection is derived from durable settings and workflow state", () => {
  const supervisor = read("tab-supervisor.js");
  assert.match(supervisor, /async function readProtection/);
  assert.match(supervisor, /Config\.workflowKey\(pageId\)/);
  assert.match(supervisor, /Config\.mergeSettings/);
  assert.doesNotMatch(supervisor, /health\.workflow\?\.status/);
});

test("the lifecycle release increments the content-script version", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.equal(manifest.version, "1.1.0");
  assert.equal(pkg.version, "1.1.0");
  assert.match(read("config.js"), /const VERSION = "1\.1\.0"/);
});
''')
