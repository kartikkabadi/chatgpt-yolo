from __future__ import annotations

import json
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
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))


# Version and content-script entry points.
manifest_path = ROOT / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["version"] = "0.7.0"
manifest["description"] = "Codex-inspired command workflows, reliable queues, and automation controls for ChatGPT."
manifest["content_scripts"][0]["js"] = [
    "config.js",
    "platforms.js",
    "commands.js",
    "command-ui.js",
    "content.js",
    "command-runtime.js",
]
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "0.7.0"
package["description"] = "Codex-inspired command workflows and reliable Chromium automation for ChatGPT."
package["scripts"]["check"] = "node --check config.js && node --check queue.js && node --check commands.js && node --check background.js && node --check platforms.js && node --check command-ui.js && node --check content.js && node --check command-runtime.js && node --check popup.js && node --check options.js"
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

# Config: version and independent per-conversation workflow storage key.
replace_once("config.js", 'const VERSION = "0.6.0";', 'const VERSION = "0.7.0";')
replace_once(
    "config.js",
    '''  function lastActionKey(id) {
    return `yoloLastAction:${encodeURIComponent(String(id || ""))}`;
  }

  function pageId(url) {''',
    '''  function lastActionKey(id) {
    return `yoloLastAction:${encodeURIComponent(String(id || ""))}`;
  }

  function workflowKey(id) {
    return `yoloWorkflow:${encodeURIComponent(String(id || ""))}`;
  }

  function pageId(url) {''',
)
replace_once(
    "config.js",
    '''    pageSettingsKey,
    lastActionKey,
    pageId,''',
    '''    pageSettingsKey,
    lastActionKey,
    workflowKey,
    pageId,''',
)

# Queue metadata identifies command/workflow-owned prompts without exposing text in logs.
replace_once(
    "queue.js",
    '''      text,
      templateId: cleanText(raw.templateId, 180),
      state,''',
    '''      text,
      templateId: cleanText(raw.templateId, 180),
      source: cleanText(raw.source, 120),
      sourceId: cleanText(raw.sourceId, 180),
      state,''',
)
replace_once(
    "queue.js",
    '''      text,
      templateId: input?.templateId || "",
      state: "pending",''',
    '''      text,
      templateId: input?.templateId || "",
      source: input?.source || "",
      sourceId: input?.sourceId || "",
      state: "pending",''',
)

# ChatGPT adapter exposes the latest assistant response for bounded workflow control markers.
replace_once(
    "platforms.js",
    '''      errorSelectors: [
        "[role='alert']",
        "[data-testid*='error' i]",
        ".text-red-500",
        ".text-red-600",
        ".border-red-500",
        ".border-red-600"
      ]''',
    '''      errorSelectors: [
        "[role='alert']",
        "[data-testid*='error' i]",
        ".text-red-500",
        ".text-red-600",
        ".border-red-500",
        ".border-red-600"
      ],
      assistantSelectors: [
        "[data-message-author-role='assistant']",
        "article[data-testid^='conversation-turn'] [data-message-author-role='assistant']",
        "main article [data-message-author-role='assistant']"
      ]''',
)
replace_once(
    "platforms.js",
    '''  function isTextControl(element) {''',
    '''  function latestAssistantText(adapter, documentLike = document) {
    if (!adapter) return "";
    const selectors = Array.isArray(adapter.assistantSelectors) ? adapter.assistantSelectors : [];
    const candidates = uniqueElements(selectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return normalizedText(candidates.at(-1));
  }

  function isTextControl(element) {''',
)
replace_once(
    "platforms.js",
    '''    findErrorState,
    composerText,''',
    '''    findErrorState,
    latestAssistantText,
    composerText,''',
)

# Background-owned workflow state, serialized and sender-bound like queues.
replace_once("background.js", 'importScripts("config.js", "queue.js");', 'importScripts("config.js", "queue.js", "commands.js");')
replace_once(
    "background.js",
    '''const Queue = globalThis.YOLOQueue;
const queueLock = { current: Promise.resolve() };
const templateLock = { current: Promise.resolve() };''',
    '''const Queue = globalThis.YOLOQueue;
const Commands = globalThis.YOLOCommands;
const queueLock = { current: Promise.resolve() };
const templateLock = { current: Promise.resolve() };
const workflowLock = { current: Promise.resolve() };''',
)
replace_once(
    "background.js",
    '''async function handleQueueMessage(message, sender) {''',
    '''async function handleWorkflowMessage(message, sender) {
  const pageId = message.pageId;
  if (!validPageId(pageId)) return { ok: false, reason: "Invalid conversation identifier", code: "workflow.page_invalid" };
  if (!senderMatchesPageId(sender, pageId)) {
    return { ok: false, reason: "Conversation identifier does not match the sending tab", code: "workflow.page_mismatch" };
  }

  return withLock(workflowLock, async () => {
    const key = Config.workflowKey(pageId);
    if (message.type === "YOLO_WORKFLOW_GET") {
      const stored = await storageGet([key]);
      return { ok: true, workflow: Commands.normalizeWorkflow(stored[key]) };
    }
    if (message.type === "YOLO_WORKFLOW_SET") {
      const workflow = Commands.normalizeWorkflow(message.workflow);
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };
    }
    if (message.type === "YOLO_WORKFLOW_CLEAR") {
      const workflow = Commands.freshWorkflow();
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };
    }
    return { ok: false, reason: "Unknown workflow operation" };
  });
}

async function handleQueueMessage(message, sender) {''',
)
replace_once(
    "background.js",
    '''  const task = message.type.includes("TEMPLATE")
    ? handleTemplateMessage(message)
    : handleQueueMessage(message, sender);''',
    '''  const task = message.type.includes("TEMPLATE")
    ? handleTemplateMessage(message)
    : message.type.includes("WORKFLOW")
      ? handleWorkflowMessage(message, sender)
      : handleQueueMessage(message, sender);''',
)

# Expose a narrow, lifecycle-safe API to the command runtime.
replace_once(
    "content.js",
    '''    storageListener: null,
    ownerId:''',
    '''    storageListener: null,
    clients: new Set(),
    ownerId:''',
)
replace_once(
    "content.js",
    '''  function installMessages() {''',
    '''  function registerClient(destroyClient) {
    if (typeof destroyClient !== "function" || state.destroyed) return () => {};
    state.clients.add(destroyClient);
    return () => state.clients.delete(destroyClient);
  }

  const commandApi = Object.freeze({
    getState: responseState,
    ensureReady: ensureCurrentRoute,
    runAction: runManualAction,
    recordStatus: setLastAction,
    registerClient
  });

  function installMessages() {''',
)
replace_once(
    "content.js",
    '''    if (state.messageListener) chrome.runtime.onMessage.removeListener(state.messageListener);
    if (state.storageListener) chrome.storage.onChanged.removeListener(state.storageListener);''',
    '''    if (state.messageListener) chrome.runtime.onMessage.removeListener(state.messageListener);
    if (state.storageListener) chrome.storage.onChanged.removeListener(state.storageListener);
    for (const destroyClient of state.clients) {
      try { destroyClient(); } catch { /* Client cleanup is best-effort. */ }
    }
    state.clients.clear();''',
)
replace_once(
    "content.js",
    '''  window.__YOLO_EXTENSION__ = { version: Config.VERSION, destroy };''',
    '''  window.__YOLO_EXTENSION__ = { version: Config.VERSION, destroy, commandApi };''',
)

# Tests: load commands in the background VM and pin workflow ownership semantics.
replace_once(
    "tests/background.test.js",
    '''  for (const file of ["config.js", "queue.js", "background.js"]) {''',
    '''  for (const file of ["config.js", "queue.js", "commands.js", "background.js"]) {''',
)
background_append = r'''

test("background persists sender-bound command workflow state", async () => {
  const { invoke } = loadBackground();
  const pageId = "https://chatgpt.com/c/workflow";
  const sender = { tab: { url: `${pageId}?temporary-chat=true` } };
  const started = await invoke({
    type: "YOLO_WORKFLOW_SET",
    pageId,
    workflow: { kind: "goal", objective: "Ship it", status: "running", maxIterations: 5 }
  }, sender);
  assert.equal(started.ok, true);
  assert.equal(started.workflow.kind, "goal");

  const loaded = await invoke({ type: "YOLO_WORKFLOW_GET", pageId }, sender);
  assert.equal(loaded.workflow.objective, "Ship it");
  assert.equal(loaded.workflow.maxIterations, 5);

  const mismatch = await invoke(
    { type: "YOLO_WORKFLOW_GET", pageId },
    { tab: { url: "https://chatgpt.com/c/other" } }
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "workflow.page_mismatch");

  const cleared = await invoke({ type: "YOLO_WORKFLOW_CLEAR", pageId }, sender);
  assert.equal(cleared.workflow.status, "idle");
});
'''
if "background persists sender-bound command workflow state" not in read("tests/background.test.js"):
    write("tests/background.test.js", read("tests/background.test.js").rstrip() + background_append)

replace_once(
    "tests/manifest.test.js",
    '''  assert.deepEqual(manifest.content_scripts[0].js, ["config.js", "platforms.js", "content.js"]);''',
    '''  assert.deepEqual(manifest.content_scripts[0].js, [
    "config.js",
    "platforms.js",
    "commands.js",
    "command-ui.js",
    "content.js",
    "command-runtime.js"
  ]);''',
)

platform_append = r'''

test("reads the latest ChatGPT assistant response for workflow markers", () => {
  const first = { textContent: "first response" };
  const second = { textContent: "latest response\n[YOLO:CONTINUE]" };
  const documentLike = {
    querySelectorAll(selector) {
      return selector === "assistant" ? [first, second] : [];
    }
  };
  const adapter = { assistantSelectors: ["assistant"] };
  assert.match(Platforms.latestAssistantText(adapter, documentLike), /latest response/);
  assert.match(Platforms.latestAssistantText(adapter, documentLike), /YOLO:CONTINUE/);
});
'''
if "reads the latest ChatGPT assistant response" not in read("tests/platforms.test.js"):
    write("tests/platforms.test.js", read("tests/platforms.test.js").rstrip() + platform_append)

ui_append = r'''

test("ChatGPT content scripts include the composer-native command system", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("commands.js") < scripts.indexOf("command-ui.js"));
  assert.ok(scripts.indexOf("command-ui.js") < scripts.indexOf("content.js"));
  assert.ok(scripts.indexOf("content.js") < scripts.indexOf("command-runtime.js"));
});

test("command palette supports slash and Codex-style command shortcuts", () => {
  const source = read("command-ui.js");
  assert.match(source, /event\.key === "\/"/);
  assert.match(source, /event\.shiftKey && event\.key\.toLowerCase\(\) === "p"/);
  assert.match(source, /Commands\.parseInvocation/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
});

test("command workflows reuse the reliable queue and fail closed", () => {
  const runtime = read("command-runtime.js");
  assert.match(runtime, /type: "YOLO_QUEUE_ADD"/);
  assert.match(runtime, /runAction\("queue-next"\)/);
  assert.match(runtime, /Goal response omitted the required control marker/);
  assert.match(runtime, /Reached the \$\{workflow\.maxIterations\}-iteration safety cap/);
});

test("content exposes only a narrow lifecycle-safe command API", () => {
  const source = read("content.js");
  assert.match(source, /const commandApi = Object\.freeze/);
  assert.match(source, /registerClient/);
  assert.match(source, /runAction: runManualAction/);
  assert.match(source, /state\.clients\.clear\(\)/);
});
'''
if "composer-native command system" not in read("tests/ui.test.js"):
    write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + ui_append)

# README: document scope, controls, and safety behavior without mixing the later UI redesign.
readme = read("README.md")
section = '''
## Codex-inspired commands

YOLO adds a composer-native command palette to ChatGPT. Press `/` in an empty ChatGPT composer or use `Cmd/Ctrl + Shift + P` (or `Cmd/Ctrl + K`) to open it, then type to filter and use the arrow keys plus Enter to select.

Commands include:

- `/goal <objective>` — start a persistent marker-driven goal with visible pause, resume, edit, and clear controls.
- `/loop [iterations] <objective>` — run bounded iterative work; the default cap is 12 and the hard cap is 50.
- `/plan <objective>` — shape an execution plan before implementation.
- `/review [scope]` — run an adversarial evidence-based review.
- `/fix [scope]` — repair defects and validate the result.
- `/compact` — create a durable context handoff.
- `/continue` — continue deeply without repeating prior work.
- `/status` and `/queue` — inspect the active workflow, queue, generation state, profile, limits, and last action.
- `/pause`, `/resume`, `/clear`, `/settings`, and `/help` — control the workflow and extension.

Goal mode requires ChatGPT to end each response with `[YOLO:CONTINUE]`, `[YOLO:DONE]`, or `[YOLO:BLOCKED]`. A missing goal marker pauses the workflow instead of guessing. Loop mode treats a missing marker as continue but always stops at its iteration cap. Every generated command prompt enters the same background-owned queue and delivery lifecycle as manually queued messages.

'''
if "## Codex-inspired commands" not in readme:
    marker = "## Primary interface\n"
    if marker not in readme:
        raise RuntimeError("README primary-interface insertion point missing")
    readme = readme.replace(marker, section + marker, 1)
write("README.md", readme)

print("Codex-inspired command workflow integration applied")
