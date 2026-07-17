from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative, old, new):
    path = ROOT / relative
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{relative}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new, 1))


# lifecycle.js: add pure, testable readiness classification and generation-hold logic.
replace_once(
    "lifecycle.js",
    '''  const HYDRATION_QUIET_MS = 1_500;
  const MARKER_RESPONSE_STABLE_MS = 15_000;''',
    '''  const HYDRATION_QUIET_MS = 1_500;
  const INPUT_SETTLE_MS = 1_500;
  const POST_GENERATION_HOLD_MS = 15_000;
  const MARKER_RESPONSE_STABLE_MS = 15_000;'''
)

replace_once(
    "lifecycle.js",
    '''  function canAutomaticRefresh({''',
    '''  function inputSafety({
    routeCurrent = false,
    durablePage = false,
    composerPresent = false,
    hydrated = false,
    hydrationRetryAfterMs = 0,
    workflowAwaitingResponse = false,
    generating = false,
    generationHoldUntil = 0,
    lastDomActivityAt = 0,
    composerBusy = false,
    now = Date.now(),
    settleMs = INPUT_SETTLE_MS
  } = {}) {
    const timestamp = finite(now, Date.now());
    const blocked = (code, reason, retryAfterMs = 0) => ({
      safe: false,
      code,
      reason,
      retryAfterMs: Math.max(0, finite(retryAfterMs, 0))
    });

    if (!routeCurrent) {
      return blocked("route.not_current", "Conversation navigation is in progress");
    }
    if (!durablePage) {
      return blocked("route.invalid", "Open a saved ChatGPT conversation before sending queued prompts");
    }
    if (!composerPresent) {
      return blocked("queue.composer_missing", "The message composer is not available yet");
    }
    if (!hydrated) {
      return blocked("hydration.pending", "Page elements are still loading", hydrationRetryAfterMs);
    }
    if (workflowAwaitingResponse) {
      return blocked("workflow.waiting", "Workflow is waiting for ChatGPT to respond");
    }
    if (generating) {
      return blocked("queue.generating", "The chat is still generating");
    }

    const holdRemaining = Math.max(0, finite(generationHoldUntil, 0) - timestamp);
    if (holdRemaining > 0) {
      return blocked(
        "queue.generating_cooldown",
        `Waiting for post-generation cooldown (${Math.ceil(holdRemaining / 1000)}s remaining)`,
        holdRemaining
      );
    }

    const settleRemaining = Math.max(
      0,
      Math.max(0, finite(lastDomActivityAt, 0))
        + Math.max(0, finite(settleMs, INPUT_SETTLE_MS))
        - timestamp
    );
    if (settleRemaining > 0) {
      return blocked("queue.dom_cooldown", "Waiting for page layout to settle", settleRemaining);
    }
    if (composerBusy) {
      return blocked("queue.composer_busy", "The composer contains a draft");
    }
    return { safe: true, code: "", reason: "", retryAfterMs: 0 };
  }

  function nextGenerationHoldUntil({
    wasGenerating = false,
    generating = false,
    currentHoldUntil = 0,
    now = Date.now(),
    holdMs = POST_GENERATION_HOLD_MS
  } = {}) {
    const timestamp = finite(now, Date.now());
    const current = Math.max(0, finite(currentHoldUntil, 0));
    if (wasGenerating && !generating) {
      return Math.max(current, timestamp + Math.max(0, finite(holdMs, POST_GENERATION_HOLD_MS)));
    }
    return current;
  }

  function canAutomaticRefresh({'''
)

replace_once(
    "lifecycle.js",
    '''    HYDRATION_QUIET_MS,
    MARKER_RESPONSE_STABLE_MS,''',
    '''    HYDRATION_QUIET_MS,
    INPUT_SETTLE_MS,
    POST_GENERATION_HOLD_MS,
    MARKER_RESPONSE_STABLE_MS,'''
)

replace_once(
    "lifecycle.js",
    '''    hydrationCandidate,
    canAutomaticRefresh,''',
    '''    hydrationCandidate,
    inputSafety,
    nextGenerationHoldUntil,
    canAutomaticRefresh,'''
)

# content.js: classify blockers precisely, retry manual sends after timed blockers,
# schedule the earliest requested wake, and stop extending a 60s hold while generating.
replace_once(
    "content.js",
    '''    scanQueued: false,
    reloadScheduled: false,''',
    '''    scanQueued: false,
    scanWakeTimer: null,
    scanWakeAt: 0,
    pendingManualQueueRetry: false,
    reloadScheduled: false,'''
)

replace_once(
    "content.js",
    '''  function composerHasText() {
    const composer = Platforms.findComposer(state.platform);
    return Boolean(Platforms.composerText(composer).trim());
  }

  function probeHydration() {''',
    '''  function composerHasText(composer = Platforms.findComposer(state.platform)) {
    return Boolean(Platforms.composerText(composer).trim());
  }

  function probeHydration() {'''
)

replace_once(
    "content.js",
    '''  function safeForInput() {
    if (!routeIsCurrent() || !Config.isDurablePageId(state.pageId) || !probeHydration()) return false;
    const workflow = workflowHealth();
    if (workflow.awaitingResponse) return false;
    if (state.generationActive || Platforms.isGenerating(state.platform) || now() < state.generationHoldUntil) return false;
    if (now() - state.lastDomActivityAt < 1_500) return false;
    if (composerHasText()) return false;
    return true;
  }

  function updateGenerationState() {
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
  }''',
    '''  function hydrationRetryAfterMs(timestamp = now()) {
    if (state.hydrated || document.readyState === "loading") return 0;
    const anchor = state.hydrationCandidateSince || state.lastDomActivityAt;
    return Math.max(0, anchor + Lifecycle.HYDRATION_QUIET_MS - timestamp);
  }

  function checkSafeForInput() {
    const timestamp = now();
    const routeCurrent = routeIsCurrent();
    const durablePage = Config.isDurablePageId(state.pageId);
    const composer = routeCurrent && durablePage ? Platforms.findComposer(state.platform) : null;
    const hydrated = Boolean(composer) && probeHydration();
    const workflow = workflowHealth();
    return Lifecycle.inputSafety({
      routeCurrent,
      durablePage,
      composerPresent: Boolean(composer),
      hydrated,
      hydrationRetryAfterMs: hydrationRetryAfterMs(timestamp),
      workflowAwaitingResponse: Boolean(workflow.awaitingResponse),
      generating: state.generationActive || Platforms.isGenerating(state.platform),
      generationHoldUntil: state.generationHoldUntil,
      lastDomActivityAt: state.lastDomActivityAt,
      composerBusy: Boolean(composer && Platforms.composerText(composer).trim()),
      now: timestamp
    });
  }

  function safeForInput() {
    return checkSafeForInput().safe;
  }

  function scheduleInputRetry(safety, automatic) {
    const retryAfterMs = Math.max(0, Number(safety?.retryAfterMs) || 0);
    if (retryAfterMs <= 0) return;
    if (!automatic) state.pendingManualQueueRetry = true;
    queueCycle(retryAfterMs + 25);
  }

  function updateGenerationState() {
    const active = Platforms.isGenerating(state.platform);
    const timestamp = now();
    const wasGenerating = state.generationActive;
    const transitioned = wasGenerating !== active;
    state.generationHoldUntil = Lifecycle.nextGenerationHoldUntil({
      wasGenerating,
      generating: active,
      currentHoldUntil: state.generationHoldUntil,
      now: timestamp
    });
    if (state.runtime) {
      if (active || (wasGenerating && !active)) state.runtime.lastGenerationAt = timestamp;
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
    '''  async function handleQueue(automatic = true) {
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
    if (automatic && now() < (state.runtime.nextQueueAt || 0)) return false;''',
    '''  async function handleQueue(automatic = true) {
    if (state.actionInFlight || !state.platform) return false;
    if (automatic && (!automationReady() || !state.settings.queueAutoRunEnabled)) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent())) return false;
    if (!automatic) state.pendingManualQueueRetry = false;

    updateGenerationState();
    const safety = checkSafeForInput();
    if (!safety.safe) {
      if (!automatic) await setBlocked(safety.code, safety.reason);
      scheduleInputRetry(safety, automatic);
      return false;
    }
    if (!automatic) clearBlocked();
    if (automatic && now() < (state.runtime.nextQueueAt || 0)) return false;'''
)

replace_once(
    "content.js",
    '''      updateGenerationState();
      if (!safeForInput()) {
        await releaseQueueClaim(queuePageId, item, "Chat became busy before the queued message could send");
        return false;
      }''',
    '''      updateGenerationState();
      const sendSafety = checkSafeForInput();
      if (!sendSafety.safe) {
        await releaseQueueClaim(queuePageId, item, `Queue paused before send: ${sendSafety.reason}`);
        if (!automatic) await setBlocked(sendSafety.code, sendSafety.reason);
        scheduleInputRetry(sendSafety, automatic);
        return false;
      }'''
)

replace_once(
    "content.js",
    '''      if (await handleApprovalCards()) return;
      if (await handleQueue(true)) return;''',
    '''      if (await handleApprovalCards()) return;
      if (state.pendingManualQueueRetry && await handleQueue(false)) return;
      if (await handleQueue(true)) return;'''
)

replace_once(
    "content.js",
    '''  function queueCycle(delayMs = null) {
    if (state.destroyed || state.scanQueued || state.reloadScheduled) return;
    state.scanQueued = true;
    const delay = delayMs == null ? Lifecycle.mutationDelay({ hidden: document.hidden, generating: state.generationActive }) : delayMs;
    window.setTimeout(() => {
      state.scanQueued = false;
      runCycle();
    }, Math.max(0, delay));
  }''',
    '''  function queueCycle(delayMs = null) {
    if (state.destroyed || state.reloadScheduled) return;
    const requested = delayMs == null
      ? Lifecycle.mutationDelay({ hidden: document.hidden, generating: state.generationActive })
      : delayMs;
    const delay = Math.max(0, Number.isFinite(Number(requested)) ? Number(requested) : 0);
    const wakeAt = now() + delay;
    if (state.scanQueued && state.scanWakeAt <= wakeAt) return;

    window.clearTimeout(state.scanWakeTimer);
    state.scanQueued = true;
    state.scanWakeAt = wakeAt;
    state.scanWakeTimer = window.setTimeout(() => {
      state.scanQueued = false;
      state.scanWakeTimer = null;
      state.scanWakeAt = 0;
      if (state.cycleInFlight) {
        queueCycle(50);
        return;
      }
      runCycle();
    }, Math.max(0, wakeAt - now()));
  }'''
)

replace_once(
    "content.js",
    '''      state.generationHoldUntil = 0;
      state.lastGenerationPersistAt = 0;
      clearBlocked();''',
    '''      state.generationHoldUntil = 0;
      state.lastGenerationPersistAt = 0;
      state.pendingManualQueueRetry = false;
      clearBlocked();'''
)

replace_once(
    "content.js",
    '''  function handleDomMutation() {
    state.lastDomActivityAt = now();
    if (state.generationActive) state.generationHoldUntil = Math.max(state.generationHoldUntil, now() + 60_000);
    queueCycle();
  }''',
    '''  function handleDomMutation() {
    state.lastDomActivityAt = now();
    queueCycle();
  }'''
)

replace_once(
    "content.js",
    '''    window.clearTimeout(state.scanTimer);
    window.clearTimeout(state.routeTimer);''',
    '''    window.clearTimeout(state.scanTimer);
    window.clearTimeout(state.scanWakeTimer);
    window.clearTimeout(state.routeTimer);'''
)

# Behavioral tests for blocker classification, exact retry delays, and the real 15s post-generation hold.
lifecycle_tests = ROOT / "tests/lifecycle.test.js"
text = lifecycle_tests.read_text()
addition = r'''

test("input safety reports the actual blocker instead of a generic draft error", () => {
  const base = {
    routeCurrent: true,
    durablePage: true,
    composerPresent: true,
    hydrated: true,
    workflowAwaitingResponse: false,
    generating: false,
    generationHoldUntil: 0,
    lastDomActivityAt: 0,
    composerBusy: false,
    now: 10_000
  };

  assert.equal(Lifecycle.inputSafety({ ...base, routeCurrent: false }).code, "route.not_current");
  assert.equal(Lifecycle.inputSafety({ ...base, durablePage: false }).code, "route.invalid");
  assert.equal(Lifecycle.inputSafety({ ...base, composerPresent: false }).code, "queue.composer_missing");
  assert.deepEqual(
    Lifecycle.inputSafety({ ...base, hydrated: false, hydrationRetryAfterMs: 700 }),
    {
      safe: false,
      code: "hydration.pending",
      reason: "Page elements are still loading",
      retryAfterMs: 700
    }
  );
  assert.equal(Lifecycle.inputSafety({ ...base, workflowAwaitingResponse: true }).code, "workflow.waiting");
  assert.equal(Lifecycle.inputSafety({ ...base, generating: true }).code, "queue.generating");
  assert.equal(Lifecycle.inputSafety({ ...base, composerBusy: true }).code, "queue.composer_busy");
  assert.deepEqual(Lifecycle.inputSafety(base), {
    safe: true,
    code: "",
    reason: "",
    retryAfterMs: 0
  });
});

test("input safety returns exact retry delays for timed blockers", () => {
  const base = {
    routeCurrent: true,
    durablePage: true,
    composerPresent: true,
    hydrated: true,
    workflowAwaitingResponse: false,
    generating: false,
    composerBusy: false,
    now: 10_000
  };

  const generation = Lifecycle.inputSafety({
    ...base,
    generationHoldUntil: 12_500,
    lastDomActivityAt: 0
  });
  assert.equal(generation.code, "queue.generating_cooldown");
  assert.equal(generation.retryAfterMs, 2_500);
  assert.match(generation.reason, /3s remaining/);

  const dom = Lifecycle.inputSafety({
    ...base,
    generationHoldUntil: 0,
    lastDomActivityAt: 9_500
  });
  assert.equal(dom.code, "queue.dom_cooldown");
  assert.equal(dom.retryAfterMs, 1_000);
});

test("post-generation hold starts on the active-to-idle transition only", () => {
  assert.equal(
    Lifecycle.nextGenerationHoldUntil({
      wasGenerating: false,
      generating: true,
      currentHoldUntil: 0,
      now: 10_000
    }),
    0
  );
  assert.equal(
    Lifecycle.nextGenerationHoldUntil({
      wasGenerating: true,
      generating: false,
      currentHoldUntil: 0,
      now: 10_000
    }),
    25_000
  );
});
'''
if "input safety reports the actual blocker" in text:
    raise RuntimeError("tests/lifecycle.test.js: readiness tests already present")
lifecycle_tests.write_text(text + addition)

content_test = ROOT / "tests/content-queue-safety.test.js"
if content_test.exists():
    raise RuntimeError("tests/content-queue-safety.test.js already exists")
content_test.write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

test("queue handling uses granular readiness reasons and timed wakeups", () => {
  assert.match(source, /function checkSafeForInput\(\)/);
  assert.match(source, /Lifecycle\.inputSafety\(/);
  assert.match(source, /scheduleInputRetry\(safety, automatic\)/);
  assert.match(source, /pendingManualQueueRetry && await handleQueue\(false\)/);
  assert.doesNotMatch(
    source,
    /if \(!safeForInput\(\)\) \{\s*if \(!automatic\) await setBlocked\("queue\.composer_busy"/
  );
});

test("generation activity does not create a rolling sixty-second input hold", () => {
  assert.match(source, /Lifecycle\.nextGenerationHoldUntil\(/);
  assert.doesNotMatch(source, /generationHoldUntil\s*=.*60_000/);
  assert.doesNotMatch(source, /generationActive\).*generationHoldUntil.*60_000/);
});

test("queue wake scheduling keeps the earliest requested wake", () => {
  assert.match(source, /state\.scanQueued && state\.scanWakeAt <= wakeAt/);
  assert.match(source, /window\.clearTimeout\(state\.scanWakeTimer\)/);
});
''')

# Remove the temporary patch mechanism from the final branch commit.
(ROOT / "scripts/apply-queue-readiness-fix.py").unlink(missing_ok=True)
(ROOT / ".github/workflows/apply-queue-readiness-fix.yml").unlink(missing_ok=True)
