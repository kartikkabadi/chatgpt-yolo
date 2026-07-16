from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new))


def replace_regex_once(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one regex match in {path}, found {count}: {pattern[:100]!r}")
    write(path, updated)


# ---------------------------------------------------------------------------
# Background ownership: bind tab-backed queue messages to their actual tab URL
# and serialize install-time template initialization with all template writes.
# ---------------------------------------------------------------------------
replace_once(
    "background.js",
    '''function validPageId(pageId) {
  return typeof pageId === "string" && pageId.length > 0 && pageId.length <= 1000;
}

function normalizeTemplate''',
    '''function validPageId(pageId) {
  return typeof pageId === "string" && pageId.length > 0 && pageId.length <= 1000;
}

function senderMatchesPageId(sender, pageId) {
  if (!sender?.tab?.url) return true;
  if (!Config.isSupportedUrl(sender.tab.url)) return false;
  return Config.pageId(sender.tab.url) === pageId;
}

function normalizeTemplate''',
)
replace_once(
    "background.js",
    '''async function handleQueueMessage(message) {
  const pageId = message.pageId;
  if (!validPageId(pageId)) return { ok: false, reason: "Invalid conversation identifier" };
''',
    '''async function handleQueueMessage(message, sender) {
  const pageId = message.pageId;
  if (!validPageId(pageId)) return { ok: false, reason: "Invalid conversation identifier", code: "queue.page_invalid" };
  if (!senderMatchesPageId(sender, pageId)) {
    return { ok: false, reason: "Conversation identifier does not match the sending tab", code: "queue.page_mismatch" };
  }
''',
)
replace_once(
    "background.js",
    '''chrome.runtime.onInstalled.addListener(() => {
  readTemplates().then(writeTemplates).catch(() => {});
});''',
    '''chrome.runtime.onInstalled.addListener(() => {
  withLock(templateLock, async () => writeTemplates(await readTemplates())).catch(() => {});
});''',
)
replace_once(
    "background.js",
    '''chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type?.startsWith("YOLO_")) return false;
  const task = message.type.includes("TEMPLATE")
    ? handleTemplateMessage(message)
    : handleQueueMessage(message);''',
    '''chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type?.startsWith("YOLO_")) return false;
  const task = message.type.includes("TEMPLATE")
    ? handleTemplateMessage(message)
    : handleQueueMessage(message, sender);''',
)

# ---------------------------------------------------------------------------
# Queue invariants: explicit ambiguity only; unresolved delivery-unknown items
# force a failure pause until explicitly retried or removed.
# ---------------------------------------------------------------------------
replace_regex_once(
    "queue.js",
    r'''  function normalizeState\(raw, at = Date\.now\(\)\) \{.*?\n  \}\n\n  function appendEvent''',
    '''  function normalizeState(raw, at = Date.now()) {
    const fallback = freshState(at);
    const source = raw && typeof raw === "object" ? raw : {};
    const items = normalizeItems(source.items, at);
    const deliveryUnknown = items.some((item) => item.state === "failed" && item.errorCode === "queue.delivery_unknown");
    const paused = deliveryUnknown || Boolean(source.paused);
    const pauseReason = deliveryUnknown
      ? "failure"
      : (paused && ["manual", "failure"].includes(source.pauseReason) ? source.pauseReason : (paused ? "manual" : ""));
    return {
      version: 1,
      paused,
      pauseReason,
      items,
      events: (Array.isArray(source.events) ? source.events : [])
        .map((event) => normalizeEvent(event, at))
        .filter(Boolean)
        .sort((a, b) => a.at - b.at)
        .slice(-MAX_EVENTS),
      lastSentAt: Math.max(0, finite(source.lastSentAt, fallback.lastSentAt)),
      updatedAt: finite(source.updatedAt, at)
    };
  }

  function appendEvent''',
)
replace_regex_once(
    "queue.js",
    r'''  function setPaused\(rawState, paused, at = Date\.now\(\)\) \{.*?\n  \}\n\n  function clearItems''',
    '''  function setPaused(rawState, paused, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const deliveryUnknown = state.items.some((item) => item.state === "failed" && item.errorCode === "queue.delivery_unknown");
    if (!paused && deliveryUnknown) {
      state = appendEvent(state, {
        code: "queue.delivery_unknown",
        message: "Resolve or explicitly retry the delivery-unknown message before resuming",
        level: "error"
      }, at);
      return {
        state,
        ok: false,
        reason: "A message has unknown delivery status and requires explicit retry or removal",
        code: "queue.delivery_unknown"
      };
    }
    state.paused = Boolean(paused);
    state.pauseReason = state.paused ? "manual" : "";
    state.updatedAt = at;
    state = appendEvent(state, {
      code: state.paused ? "queue.paused" : "queue.resumed",
      message: state.paused ? "Queue paused" : "Queue resumed",
      level: state.paused ? "warning" : "success"
    }, at);
    return { state, ok: true };
  }

  function clearItems''',
)
replace_once(
    "queue.js",
    '''    if (state.pauseReason === "failure") {
      state.paused = false;
      state.pauseReason = "";
    }
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.retry", message: "Failed message returned to the queue", level: "info" }, at);''',
    '''    if (state.pauseReason === "failure" && !state.items.some((entry) => entry.state === "failed")) {
      state.paused = false;
      state.pauseReason = "";
    }
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.retry", message: "Failed message returned to the queue", level: "info" }, at);''',
)
replace_regex_once(
    "queue.js",
    r'''    const ambiguousDelivery = Boolean\(options\.deliveryAmbiguous\)\n      \|\| \["composer\.unconfirmed", "route\.changed", "queue\.exception"\]\.includes\(cleanText\(options\.errorCode, 120\)\);''',
    '''    const ambiguousDelivery = Boolean(options.deliveryAmbiguous);''',
)

# ---------------------------------------------------------------------------
# DOM delivery: a missing composer is not confirmation, and ambiguity is tracked
# by whether submission was actually attempted rather than generic error codes.
# ---------------------------------------------------------------------------
replace_once(
    "platforms.js",
    '''    const composer = findComposer(adapter, documentLike);
    return !composer || composerText(composer).trim() === "";''',
    '''    const composer = findComposer(adapter, documentLike);
    return Boolean(composer) && composerText(composer).trim() === "";''',
)
replace_regex_once(
    "content.js",
    r'''  async function writeAndSubmit\(prompt, actionPageId\) \{.*?\n  \}\n\n  async function sendPrompt''',
    '''  async function writeAndSubmit(prompt, actionPageId) {
    let submissionAttempted = false;
    try {
      let composer = Platforms.findComposer(state.platform);
      if (!composer) {
        return { ok: false, code: "composer.missing", reason: "Message composer was not found", deliveryAmbiguous: false };
      }
      if (state.settings.pauseOnComposerText && Platforms.composerText(composer).trim()) {
        return { ok: false, code: "composer.busy", reason: "Message composer contains a draft", deliveryAmbiguous: false };
      }

      Platforms.setComposerValue(composer, prompt);
      await sleep(120);
      if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) {
        return { ok: false, code: "route.changed", reason: "Conversation changed before the message was submitted", deliveryAmbiguous: false };
      }
      composer = Platforms.findComposer(state.platform) || composer;
      submissionAttempted = true;
      if (!Platforms.submitComposer(state.platform, composer)) {
        return { ok: false, code: "composer.submit_failed", reason: "Message could not be submitted", deliveryAmbiguous: true };
      }

      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) {
          return { ok: false, code: "route.changed", reason: "Conversation changed before delivery could be confirmed", deliveryAmbiguous: true };
        }
        if (Platforms.submissionObserved(state.platform)) return { ok: true, deliveryAmbiguous: true };
        await sleep(100);
      }
      return {
        ok: false,
        code: "composer.unconfirmed",
        reason: "The chat did not confirm that the message was submitted",
        deliveryAmbiguous: true
      };
    } catch (error) {
      return {
        ok: false,
        code: "queue.exception",
        reason: String(error?.message || error),
        deliveryAmbiguous: submissionAttempted
      };
    }
  }

  async function sendPrompt''',
)
replace_regex_once(
    "content.js",
    r'''  async function failQueueClaim\(pageId, item, error, options, errorCode = "queue\.send_failed"\) \{.*?\n  \}\n\n  async function handleQueue''',
    '''  async function failQueueClaim(pageId, item, error, options, errorCode = "queue.send_failed", deliveryAmbiguous = false) {
    return backgroundSendWithRetry({
      type: "YOLO_QUEUE_FAIL",
      pageId,
      itemId: item.id,
      claimToken: item.claimToken,
      error,
      errorCode,
      maxRetries: options.maxRetries,
      backoffSec: options.backoffSec,
      pauseOnFailure: options.pauseOnFailure,
      deliveryAmbiguous
    });
  }

  async function handleQueue''',
)
replace_once(
    "content.js",
    '''    const item = claim.item;
    state.actionInFlight = true;
    try {''',
    '''    const item = claim.item;
    let deliveryAmbiguous = false;
    state.actionInFlight = true;
    try {''',
)
replace_once(
    "content.js",
    '''      const submitted = await writeAndSubmit(item.text, queuePageId);
      if (!submitted.ok) {
        await failQueueClaim(queuePageId, item, submitted.reason, queueFailureOptions, submitted.code);
        await setLastAction(`Queue send failed: ${submitted.reason}`, "error", submitted.code, true);
        return false;
      }

      const completed = await backgroundSendWithRetry({''',
    '''      const submitted = await writeAndSubmit(item.text, queuePageId);
      deliveryAmbiguous = Boolean(submitted.deliveryAmbiguous);
      if (!submitted.ok) {
        await failQueueClaim(queuePageId, item, submitted.reason, queueFailureOptions, submitted.code, deliveryAmbiguous);
        await setLastAction(`Queue send failed: ${submitted.reason}`, "error", submitted.code, true);
        return false;
      }
      deliveryAmbiguous = true;

      const completed = await backgroundSendWithRetry({''',
)
replace_once(
    "content.js",
    '''    } catch (error) {
      await failQueueClaim(queuePageId, item, String(error?.message || error), queueFailureOptions, "queue.exception");''',
    '''    } catch (error) {
      await failQueueClaim(queuePageId, item, String(error?.message || error), queueFailureOptions, "queue.exception", deliveryAmbiguous);''',
)

# ---------------------------------------------------------------------------
# Popup integrity and accessibility.
# ---------------------------------------------------------------------------
replace_once(
    "popup.html",
    '<input id="enabled" type="checkbox" role="switch">',
    '<input id="enabled" type="checkbox" role="switch" aria-label="Run automation for this conversation">',
)
replace_regex_once(
    "popup.js",
    r'''  async function refreshAll\(\{ includeTemplates = false, force = false \} = \{\}\) \{.*?\n  \}\n\n  async function saveCoreSettings''',
    '''  async function refreshAll({ includeTemplates = false, force = false } = {}) {
    if (!activeTab?.id || (busy && !force)) return false;
    const nextContent = await sendContentWithInject({ type: "YOLO_GET_STATE" });
    if (!nextContent?.pageId) return false;
    const tasks = [sendBackground({ type: "YOLO_QUEUE_GET", pageId: nextContent.pageId })];
    if (includeTemplates) tasks.push(sendBackground({ type: "YOLO_TEMPLATES_GET" }));
    const [queueResponse, templateResponse] = await Promise.all(tasks);
    if (!queueResponse?.ok) return false;
    contentState = nextContent;
    queueState = queueResponse.state;
    if (templateResponse?.ok) templates = templateResponse.templates;
    renderContentState();
    renderQueue();
    if (includeTemplates) renderTemplates();
    return true;
  }

  async function saveCoreSettings''',
)
replace_regex_once(
    "popup.js",
    r'''  async function init\(\) \{.*?\n  \}\n\n  els\.enabled''',
    '''  async function init() {
    setBusy(true);
    els.version.textContent = `v${Config.VERSION}`;
    activeTab = await queryActiveTab();
    if (!Config.isSupportedUrl(activeTab?.url)) {
      els.status.textContent = "Unavailable";
      els.scope.textContent = "Open ChatGPT to use YOLO.";
      return;
    }
    if (!await refreshAll({ includeTemplates: true, force: true })) {
      els.status.textContent = "Unavailable";
      els.scope.textContent = "Could not start YOLO in this tab.";
      return;
    }
    pollTimer = window.setInterval(() => refreshAll(), 1800);
    setBusy(false);
  }

  els.enabled''',
)
replace_once(
    "popup.js",
    '''    els.message.value = Config.renderTemplate(template.text, { platform: contentState?.platform });''',
    '''    els.message.value = Config.renderTemplate(template.text, {
      platform: contentState?.platform,
      conversation: contentState?.pageId
    });''',
)
replace_once(
    "popup.js",
    '''      addOrUpdate({ send: event.shiftKey });''',
    '''      addOrUpdate({ send: event.shiftKey && !editingId });''',
)

# ---------------------------------------------------------------------------
# Options page: live regions and template management without an active tab.
# ---------------------------------------------------------------------------
replace_once("options.html", '<span id="saveStatus">Loading…</span>', '<span id="saveStatus" role="status">Loading…</span>')
replace_once("options.html", '<p id="templateStatus"></p>', '<p id="templateStatus" role="status"></p>')
replace_regex_once(
    "options.js",
    r'''  function setBusy\(nextBusy\) \{.*?\n  \}\n\n  function valueFromControl''',
    '''  function setBusy(nextBusy) {
    busy = nextBusy;
    for (const control of controls) control.disabled = nextBusy || !contentState;
    for (const button of document.querySelectorAll("button")) button.disabled = nextBusy;
    els.resetDefaults.disabled = nextBusy || !contentState;
    els.resetRuntime.disabled = nextBusy || !contentState;
  }

  function valueFromControl''',
)
replace_regex_once(
    "options.js",
    r'''  async function init\(\) \{.*?\n  \}\n\n  for \(const control of controls\)''',
    '''  async function init() {
    setBusy(true);
    contentState = await resolveSourceTab();
    if (!contentState) {
      els.scope.textContent = "Open a ChatGPT conversation to configure automation. Templates remain available below.";
      els.saveStatus.textContent = "No conversation selected";
    } else {
      settings = contentState.settings;
      renderControls(settings);
      els.scope.textContent = `${contentState.platform} · ${contentState.pageId}`;
      els.saveStatus.textContent = "Saved";
    }

    const templateResponse = await sendBackground({ type: "YOLO_TEMPLATES_GET" });
    if (templateResponse?.ok) templates = templateResponse.templates;
    renderTemplates();

    const section = params.get("section");
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
    setBusy(false);
  }

  for (const control of controls)''',
)

# ---------------------------------------------------------------------------
# Regression coverage.
# ---------------------------------------------------------------------------
replace_once(
    "tests/background.test.js",
    '''  const invoke = (message) => new Promise((resolve) => {
    const async = listener(message, {}, resolve);''',
    '''  const invoke = (message, sender = {}) => new Promise((resolve) => {
    const async = listener(message, sender, resolve);''',
)
replace_once(
    "tests/background.test.js",
    '''    pauseOnFailure: false
  });''',
    '''    pauseOnFailure: false,
    deliveryAmbiguous: true
  });''',
)
background_append = r'''

test("tab-backed queue messages must match the sender conversation", async () => {
  const { invoke } = loadBackground();
  const pageId = "https://chatgpt.com/c/sender-bound";
  await invoke({ type: "YOLO_QUEUE_ADD", pageId, item: { text: "bound" } });

  const matching = await invoke(
    { type: "YOLO_QUEUE_GET", pageId },
    { tab: { url: "https://chatgpt.com/c/sender-bound?temporary-chat=true" } }
  );
  assert.equal(matching.ok, true);

  const mismatched = await invoke(
    { type: "YOLO_QUEUE_GET", pageId },
    { tab: { url: "https://chatgpt.com/c/other" } }
  );
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.code, "queue.page_mismatch");
});

test("install-time template initialization uses the template lock", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  assert.match(source, /onInstalled[\s\S]*withLock\(templateLock/);
});
'''
write("tests/background.test.js", read("tests/background.test.js").rstrip() + background_append)

replace_once(
    "tests/queue.test.js",
    '''      error: `ambiguous outcome: ${errorCode}`,
      errorCode
    });''',
    '''      error: `ambiguous outcome: ${errorCode}`,
      errorCode,
      deliveryAmbiguous: true
    });''',
)
replace_once(
    "tests/queue.test.js",
    '''    error: "composer not found before submit",
    errorCode: "composer.missing"
  });''',
    '''    error: "composer not found before submit",
    errorCode: "composer.missing",
    deliveryAmbiguous: false
  });''',
)
queue_append = r'''

test("delivery-unknown failures remain a hard block until explicitly resolved", () => {
  const raw = {
    paused: false,
    items: [
      { id: "unknown", text: "possibly sent", state: "failed", errorCode: "queue.delivery_unknown" },
      { id: "later", text: "must wait", state: "pending" }
    ]
  };
  const normalized = Queue.normalizeState(raw, 2000);
  assert.equal(normalized.paused, true);
  assert.equal(normalized.pauseReason, "failure");

  const resumed = Queue.setPaused(normalized, false, 2100);
  assert.equal(resumed.ok, false);
  assert.equal(resumed.code, "queue.delivery_unknown");
  assert.equal(resumed.state.paused, true);
  assert.equal(Queue.claimNext(resumed.state, "owner", { at: 2200 }).code, "queue.paused");

  const retried = Queue.retryItem(resumed.state, "unknown", 2300);
  assert.equal(retried.state.items[0].state, "pending");
  assert.equal(retried.state.paused, false);
});

test("retrying one failed item does not clear a failure pause while another failure remains", () => {
  const raw = {
    paused: true,
    pauseReason: "failure",
    items: [
      { id: "one", text: "one", state: "failed", errorCode: "queue.send_failed" },
      { id: "two", text: "two", state: "failed", errorCode: "queue.send_failed" }
    ]
  };
  const retried = Queue.retryItem(raw, "one", 3000);
  assert.equal(retried.state.items[0].state, "pending");
  assert.equal(retried.state.paused, true);
  assert.equal(retried.state.pauseReason, "failure");
});
'''
write("tests/queue.test.js", read("tests/queue.test.js").rstrip() + queue_append)

platform_append = r'''

test("a missing composer is not treated as delivery confirmation", () => {
  const adapter = { composerSelectors: ["composer"], generationSelectors: ["stop"] };
  const documentLike = { querySelectorAll() { return []; } };
  assert.equal(Platforms.submissionObserved(adapter, documentLike), false);
});
'''
write("tests/platforms.test.js", read("tests/platforms.test.js").rstrip() + platform_append)

replace_once(
    "tests/options.test.js",
    '''  let queried = false;
  const elements = new Map();''',
    '''  let queried = false;
  let templatesRequested = false;
  const elements = new Map();''',
)
replace_once(
    "tests/options.test.js",
    '''      runtime: { lastError: null, sendMessage() {} },''',
    '''      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          if (message?.type === "YOLO_TEMPLATES_GET") templatesRequested = true;
          callback?.({ ok: true, templates: [] });
        }
      },''',
)
replace_once(
    "tests/options.test.js",
    '''  assert.equal(queried, true);
  assert.match(getElement("#scope").textContent, /Open a ChatGPT conversation/);''',
    '''  assert.equal(queried, true);
  assert.equal(templatesRequested, true);
  assert.match(getElement("#scope").textContent, /Open a ChatGPT conversation/);''',
)

ui_append = r'''

test("popup commits content and queue state atomically", () => {
  const source = read("popup.js");
  const queueGuard = source.indexOf("if (!queueResponse?.ok) return false;");
  const contentCommit = source.indexOf("contentState = nextContent;");
  const queueCommit = source.indexOf("queueState = queueResponse.state;");
  assert.ok(queueGuard >= 0 && contentCommit > queueGuard && queueCommit > contentCommit);
});

test("popup initialization and editing shortcuts fail closed", () => {
  const source = read("popup.js");
  const init = source.slice(source.indexOf("async function init()"), source.indexOf("els.enabled.addEventListener"));
  assert.match(init, /setBusy\(true\)/);
  assert.match(init, /includeTemplates: true, force: true/);
  assert.match(init, /setBusy\(false\)/);
  assert.match(source, /send: event\.shiftKey && !editingId/);
});

test("template rendering receives the current conversation", () => {
  const source = read("popup.js");
  assert.match(source, /conversation: contentState\?\.pageId/);
});

test("primary controls and dynamic option statuses are accessibly named", () => {
  assert.match(read("popup.html"), /id="enabled"[^>]*aria-label="Run automation for this conversation"/);
  const options = read("options.html");
  assert.match(options, /id="saveStatus"[^>]*role="status"/);
  assert.match(options, /id="templateStatus"[^>]*role="status"/);
});

test("queue failures forward explicit delivery ambiguity", () => {
  const source = read("content.js");
  assert.match(source, /deliveryAmbiguous: submissionAttempted/);
  assert.match(source, /submitted\.code, deliveryAmbiguous/);
  assert.match(source, /"queue\.exception", deliveryAmbiguous/);
});
'''
write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + ui_append)

print("Final production hardening patch applied")
