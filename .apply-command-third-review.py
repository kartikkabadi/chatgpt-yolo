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
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:140]!r}")
    write(path, content.replace(old, new))


# ---------------------------------------------------------------------------
# Workflow state tracks response stability independently of ChatGPT's mutable
# generation selectors. This prevents partial loop responses from triggering a
# continuation when the live DOM temporarily fails to expose the stop button.
# ---------------------------------------------------------------------------
replace_once(
    "commands.js",
    '''      promptFingerprint: "",
      runnerId: "",''',
    '''      promptFingerprint: "",
      responseCandidateFingerprint: "",
      responseCandidateSince: 0,
      runnerId: "",''',
)
replace_once(
    "commands.js",
    '''      promptFingerprint: cleanText(raw.promptFingerprint, 180),
      runnerId: status === "running" ? cleanText(raw.runnerId, 220) : "",''',
    '''      promptFingerprint: cleanText(raw.promptFingerprint, 180),
      responseCandidateFingerprint: Boolean(raw.awaitingResponse) ? cleanText(raw.responseCandidateFingerprint, 180) : "",
      responseCandidateSince: Boolean(raw.awaitingResponse) ? Math.max(0, finite(raw.responseCandidateSince, 0)) : 0,
      runnerId: status === "running" ? cleanText(raw.runnerId, 220) : "",''',
)
replace_once(
    "commands.js",
    '''      workflow.awaitingResponse = false;
      workflow.sawGeneration = false;
      workflow.runnerId = "";''',
    '''      workflow.awaitingResponse = false;
      workflow.sawGeneration = false;
      workflow.responseCandidateFingerprint = "";
      workflow.responseCandidateSince = 0;
      workflow.runnerId = "";''',
)
replace_once(
    "commands.js",
    '''    workflow.awaitingResponse = false;
    workflow.sawGeneration = false;
    workflow.lastAssistantFingerprint = fingerprint(text);''',
    '''    workflow.awaitingResponse = false;
    workflow.sawGeneration = false;
    workflow.responseCandidateFingerprint = "";
    workflow.responseCandidateSince = 0;
    workflow.lastAssistantFingerprint = fingerprint(text);''',
)

# ---------------------------------------------------------------------------
# Queue capacity helper is shared by normal queue mutations and the new atomic
# workflow+queue transaction.
# ---------------------------------------------------------------------------
replace_once(
    "background.js",
    '''const storageSet = (items) => new Promise((resolve, reject) => {
  chrome.storage.local.set(items, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Extension storage write failed"));
    else resolve(true);
  });
});''',
    '''const storageSet = (items) => new Promise((resolve, reject) => {
  chrome.storage.local.set(items, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Extension storage write failed"));
    else resolve(true);
  });
});
const storageRemove = (keys) => new Promise((resolve, reject) => {
  chrome.storage.local.remove(keys, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Extension storage remove failed"));
    else resolve(true);
  });
});''',
)
replace_once(
    "background.js",
    '''async function mutateQueue(pageId, mutator) {
  return withLock(queueLock, async () => {
    const map = await readQueueMap();
    const existed = Object.prototype.hasOwnProperty.call(map, pageId);
    const current = Queue.normalizeState(map[pageId]);
    const result = await mutator(current);
    const state = Queue.normalizeState(result?.state || current);

    if (!existed && Object.keys(map).length >= MAX_CONVERSATION_QUEUES) {
      const emptyQueues = Object.entries(map)
        .filter(([, value]) => Queue.normalizeState(value).items.length === 0)
        .sort((a, b) => (a[1]?.updatedAt || 0) - (b[1]?.updatedAt || 0));
      while (Object.keys(map).length >= MAX_CONVERSATION_QUEUES && emptyQueues.length) {
        delete map[emptyQueues.shift()[0]];
      }
      if (Object.keys(map).length >= MAX_CONVERSATION_QUEUES) {
        return {
          ok: false,
          reason: `Active queue limit of ${MAX_CONVERSATION_QUEUES} conversations reached; clear an old queue first`,
          code: "queue.conversation_limit",
          state: current,
          summary: Queue.summary(current)
        };
      }
    }

    delete map[pageId];
    map[pageId] = state;
    await storageSet({ [Config.STORAGE_KEYS.queues]: map });
    return { ...result, state, summary: Queue.summary(state) };
  });
}''',
    '''function ensureQueueCapacity(map, pageId, current) {
  if (Object.prototype.hasOwnProperty.call(map, pageId) || Object.keys(map).length < MAX_CONVERSATION_QUEUES) return null;
  const emptyQueues = Object.entries(map)
    .filter(([, value]) => Queue.normalizeState(value).items.length === 0)
    .sort((a, b) => (a[1]?.updatedAt || 0) - (b[1]?.updatedAt || 0));
  while (Object.keys(map).length >= MAX_CONVERSATION_QUEUES && emptyQueues.length) {
    delete map[emptyQueues.shift()[0]];
  }
  if (Object.keys(map).length < MAX_CONVERSATION_QUEUES) return null;
  return {
    ok: false,
    reason: `Active queue limit of ${MAX_CONVERSATION_QUEUES} conversations reached; clear an old queue first`,
    code: "queue.conversation_limit",
    state: current,
    summary: Queue.summary(current)
  };
}

async function mutateQueue(pageId, mutator) {
  return withLock(queueLock, async () => {
    const map = await readQueueMap();
    const current = Queue.normalizeState(map[pageId]);
    const result = await mutator(current);
    const state = Queue.normalizeState(result?.state || current);
    const capacityError = ensureQueueCapacity(map, pageId, current);
    if (capacityError) return capacityError;

    delete map[pageId];
    map[pageId] = state;
    await storageSet({ [Config.STORAGE_KEYS.queues]: map });
    return { ...result, state, summary: Queue.summary(state) };
  });
}''',
)

# Helpers for active workflow limits and atomic workflow prompt enqueue.
replace_once(
    "background.js",
    '''async function handleWorkflowMessage(message, sender) {''',
    '''async function activeWorkflowLimitError(key, current, workflow) {
  if (current.status !== "idle" || workflow.status === "idle") return null;
  const allStored = await storageGet(null);
  const activeCount = Object.entries(allStored)
    .filter(([storedKey]) => storedKey.startsWith("yoloWorkflow:") && storedKey !== key)
    .map(([, value]) => Commands.normalizeWorkflow(value))
    .filter((entry) => entry.status !== "idle")
    .length;
  if (activeCount < MAX_ACTIVE_WORKFLOWS) return null;
  return {
    ok: false,
    reason: `Active workflow limit of ${MAX_ACTIVE_WORKFLOWS} conversations reached; clear an old workflow first`,
    code: "workflow.conversation_limit",
    workflow: current
  };
}

async function enqueueWorkflowPrompt(pageId, key, current, message) {
  return withLock(queueLock, async () => {
    const map = await readQueueMap();
    const queueCurrent = Queue.normalizeState(map[pageId]);
    const queueResult = Queue.addItem(queueCurrent, message.item, { front: true });
    if (!queueResult.ok) return { ...queueResult, workflow: current, summary: Queue.summary(queueCurrent) };
    const capacityError = ensureQueueCapacity(map, pageId, queueCurrent);
    if (capacityError) return { ...capacityError, workflow: current };

    const timestamp = Date.now();
    const ownerId = String(message.ownerId || "").trim().slice(0, 220);
    const workflow = Commands.normalizeWorkflow({
      ...message.workflow,
      revision: current.revision + 1,
      pendingItemId: queueResult.item.id,
      awaitingResponse: false,
      sawGeneration: false,
      responseCandidateFingerprint: "",
      responseCandidateSince: 0,
      runnerId: ownerId,
      runnerExpiresAt: ownerId ? timestamp + WORKFLOW_LEASE_MS : 0,
      updatedAt: timestamp
    });
    const limitError = await activeWorkflowLimitError(key, current, workflow);
    if (limitError) return limitError;

    delete map[pageId];
    map[pageId] = queueResult.state;
    await storageSet({
      [Config.STORAGE_KEYS.queues]: map,
      [key]: workflow
    });
    return {
      ok: true,
      workflow,
      item: queueResult.item,
      state: queueResult.state,
      summary: Queue.summary(queueResult.state)
    };
  });
}

async function handleWorkflowMessage(message, sender) {''',
)
# Replace duplicated limit logic in SET and add atomic operation / remove-on-clear.
old_set = '''      const workflow = Commands.normalizeWorkflow({ ...message.workflow, revision: current.revision + 1 });
      if (current.status === "idle" && workflow.status !== "idle") {
        const allStored = await storageGet(null);
        const activeCount = Object.entries(allStored)
          .filter(([storedKey]) => storedKey.startsWith("yoloWorkflow:") && storedKey !== key)
          .map(([, value]) => Commands.normalizeWorkflow(value))
          .filter((entry) => entry.status !== "idle")
          .length;
        if (activeCount >= MAX_ACTIVE_WORKFLOWS) {
          return {
            ok: false,
            reason: `Active workflow limit of ${MAX_ACTIVE_WORKFLOWS} conversations reached; clear an old workflow first`,
            code: "workflow.conversation_limit",
            workflow: current
          };
        }
      }
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };
    }

    if (message.type === "YOLO_WORKFLOW_CLEAR") {'''
new_set = '''      const workflow = Commands.normalizeWorkflow({ ...message.workflow, revision: current.revision + 1 });
      const limitError = await activeWorkflowLimitError(key, current, workflow);
      if (limitError) return limitError;
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };
    }

    if (message.type === "YOLO_WORKFLOW_QUEUE_ADD") {
      const expectedRevision = Math.max(0, Math.round(Number(message.expectedRevision) || 0));
      if (expectedRevision !== current.revision) {
        return { ok: false, reason: "Workflow changed in another tab", code: "workflow.conflict", workflow: current };
      }
      return enqueueWorkflowPrompt(pageId, key, current, message);
    }

    if (message.type === "YOLO_WORKFLOW_CLEAR") {'''
replace_once("background.js", old_set, new_set)
replace_once(
    "background.js",
    '''      const workflow = Commands.normalizeWorkflow({ ...Commands.freshWorkflow(), revision: current.revision + 1 });
      await storageSet({ [key]: workflow });
      return { ok: true, workflow };''',
    '''      await storageRemove([key]);
      return { ok: true, workflow: Commands.freshWorkflow() };''',
)

# ---------------------------------------------------------------------------
# Runtime uses the atomic transaction for every workflow prompt and requires a
# stable assistant response fingerprint for a full settle window.
# ---------------------------------------------------------------------------
replace_once(
    "command-runtime.js",
    '''  const RESPONSE_SETTLE_MS = 1200;''',
    '''  const RESPONSE_SETTLE_MS = 1200;
  const RESPONSE_STABLE_MS = 1400;''',
)
# Replace workflow branch of queuePrompt with an atomic call; retain one-shot path.
queue_prompt_pattern = re.compile(r'''  async function queuePrompt\(text, \{ workflow = null, source = "command" \} = \{\}\) \{.*?\n  \}\n\n  async function cancelPendingWorkflowPrompt''', re.S)
queue_prompt_replacement = r'''  async function queuePrompt(text, { workflow = null, source = "command" } = {}) {
    const prompt = String(text || "").trim();
    const pageId = state.pageId;
    if (!prompt) return { ok: false, reason: "Command produced an empty prompt" };

    let response;
    if (workflow) {
      const next = Commands.normalizeWorkflow(workflow);
      next.awaitingResponse = false;
      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.promptFingerprint = Commands.fingerprint(prompt);
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.lastPromptAt = now();
      next.reason = "Queued command prompt";
      next.updatedAt = now();
      response = await backgroundSend({
        type: "YOLO_WORKFLOW_QUEUE_ADD",
        pageId,
        expectedRevision: next.revision,
        ownerId: state.ownerId,
        workflow: next,
        item: {
          text: prompt,
          source,
          sourceId: next.id
        }
      });
      applyWorkflowResponse(response, pageId);
    } else {
      response = await backgroundSend({
        type: "YOLO_QUEUE_ADD",
        pageId,
        front: true,
        item: { text: prompt, source, sourceId: "" }
      });
    }
    if (!response?.ok) return response || { ok: false, reason: "Could not add the command prompt to the queue" };

    const api = engine();
    const sent = api ? await api.runAction("queue-next") : false;
    if (workflow && sent && state.pageId === pageId) {
      const next = Commands.normalizeWorkflow(state.workflow);
      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.reason = "Waiting for ChatGPT";
      next.updatedAt = now();
      await writeWorkflow(next, pageId);
    }
    return { ...response, sent };
  }

  async function cancelPendingWorkflowPrompt'''
runtime = read("command-runtime.js")
runtime, count = queue_prompt_pattern.subn(queue_prompt_replacement, runtime, count=1)
if count != 1:
    raise RuntimeError(f"Expected one queuePrompt replacement, found {count}")
write("command-runtime.js", runtime)
# Starting and resuming no longer pre-write a workflow before atomic enqueue.
replace_once(
    "command-runtime.js",
    '''    current.workflow.revision = latest.revision;
    current.workflow.runnerId = state.ownerId;
    state.workflow = current.workflow;
    if (!await writeWorkflow(state.workflow)) return { ok: false, reason: "Workflow changed in another tab", keepOpen: true };

    const prompt = Commands.workflowPrompt(state.workflow, "initial");
    const queued = await queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${kind}` });''',
    '''    current.workflow.revision = latest.revision;
    current.workflow.runnerId = state.ownerId;
    state.workflow = current.workflow;
    const prompt = Commands.workflowPrompt(state.workflow, "initial");
    const queued = await queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${kind}` });''',
)
replace_once(
    "command-runtime.js",
    '''    next.status = "running";
    next.reason = "Resumed by user";
    next.updatedAt = now();
    if (!await writeWorkflow(next)) return { ok: false, reason: "Workflow changed in another tab", keepOpen: true };
    if (!state.workflow.pendingItemId && !state.workflow.awaitingResponse) {
      const prompt = Commands.workflowPrompt(state.workflow, state.workflow.iteration === 0 ? "initial" : "continue");
      return queuePrompt(prompt, { workflow: state.workflow, source: `workflow:${state.workflow.kind}` });
    }
    return { ok: true };''',
    '''    next.status = "running";
    next.reason = "Resumed by user";
    next.updatedAt = now();
    const prompt = Commands.workflowPrompt(next, next.iteration === 0 ? "initial" : "continue");
    return queuePrompt(prompt, { workflow: next, source: `workflow:${next.kind}` });''',
)
# Continuations atomically persist the decision state and queue item; no interim write.
replace_once(
    "command-runtime.js",
    '''    if (!await writeWorkflow(state.workflow)) return true;
    const prompt = Commands.workflowPrompt(state.workflow, "continue");''',
    '''    const prompt = Commands.workflowPrompt(state.workflow, "continue");''',
)
# Awaiting transition resets stability candidate.
replace_once(
    "command-runtime.js",
    '''          next.sawGeneration = false;
          next.baselineFingerprint = latestAssistantFingerprint();''',
    '''          next.sawGeneration = false;
          next.responseCandidateFingerprint = "";
          next.responseCandidateSince = 0;
          next.baselineFingerprint = latestAssistantFingerprint();''',
)
replace_once(
    "command-runtime.js",
    '''      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();''',
    '''      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();''',
)
# Replace final response dispatch with an explicit stability fence.
replace_once(
    "command-runtime.js",
    '''    if (apiState.generating) {
      if (!workflow.sawGeneration) {
        workflow.sawGeneration = true;
        workflow.reason = "ChatGPT is working";
        workflow.updatedAt = now();
        await writeWorkflow(workflow);
      }
      return false;
    }

    if (now() - workflow.lastPromptAt < RESPONSE_SETTLE_MS) return false;
    return processResponse();''',
    '''    if (apiState.generating) {
      if (!workflow.sawGeneration || workflow.responseCandidateFingerprint) {
        workflow.sawGeneration = true;
        workflow.responseCandidateFingerprint = "";
        workflow.responseCandidateSince = 0;
        workflow.reason = "ChatGPT is working";
        workflow.updatedAt = now();
        await writeWorkflow(workflow);
      }
      return false;
    }

    if (now() - workflow.lastPromptAt < RESPONSE_SETTLE_MS) return false;
    const assistantText = Platforms.latestAssistantText(adapter());
    const candidateFingerprint = Commands.fingerprint(assistantText);
    if (!assistantText || candidateFingerprint === workflow.baselineFingerprint || candidateFingerprint === workflow.lastAssistantFingerprint) return false;
    if (workflow.responseCandidateFingerprint !== candidateFingerprint) {
      workflow.responseCandidateFingerprint = candidateFingerprint;
      workflow.responseCandidateSince = now();
      workflow.reason = "Waiting for ChatGPT response to settle";
      workflow.updatedAt = now();
      await writeWorkflow(workflow);
      return false;
    }
    if (now() - workflow.responseCandidateSince < RESPONSE_STABLE_MS) return false;
    return processResponse();''',
)

# ---------------------------------------------------------------------------
# UI query terms are never treated as optional command arguments. Optional
# scope remains available through direct composer syntax (/review security).
# ---------------------------------------------------------------------------
replace_once(
    "command-ui.js",
    '''      run(entry, search.value);
    }''',
    '''      run(entry, argumentCommand ? search.value : "");
    }''',
)

# Dynamic fallback injection must reproduce the full manifest content-script
# stack, not only the pre-command engine.
full_stack = '["config.js", "platforms.js", "commands.js", "command-ui.js", "content.js", "command-runtime.js"]'
replace_once("popup.js", 'files: ["config.js", "platforms.js", "content.js"]', f'files: {full_stack}')
replace_once("options.js", 'files: ["config.js", "platforms.js", "content.js"]', f'files: {full_stack}')

# ---------------------------------------------------------------------------
# Test harness supports Chrome storage removal and regression tests pin every
# third-review invariant.
# ---------------------------------------------------------------------------
replace_once(
    "tests/background.test.js",
    '''          set(items, callback) {
            if (failNextSet) {''',
    '''          set(items, callback) {
            if (failNextSet) {''',
)
# Insert remove after set implementation.
replace_once(
    "tests/background.test.js",
    '''            Object.assign(storage, items);
            callback?.();
          }
        }''',
    '''            Object.assign(storage, items);
            callback?.();
          },
          remove(keys, callback) {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const key of list) delete storage[key];
            callback?.();
          }
        }''',
)
background_append = r'''

test("workflow prompt enqueue commits queue and workflow together", async () => {
  const { invoke, storage } = loadBackground();
  const pageId = "https://chatgpt.com/c/atomic-workflow";
  const response = await invoke({
    type: "YOLO_WORKFLOW_QUEUE_ADD",
    pageId,
    expectedRevision: 0,
    ownerId: "tab-a",
    workflow: { kind: "goal", objective: "atomic", status: "running", promptFingerprint: "prompt" },
    item: { text: "workflow prompt", source: "workflow:goal", sourceId: "goal-a" }
  });
  assert.equal(response.ok, true);
  assert.equal(response.workflow.pendingItemId, response.item.id);
  assert.equal(response.workflow.runnerId, "tab-a");
  assert.equal(storage.yoloQueuesV1[pageId].items[0].id, response.item.id);
  const workflowKey = Object.keys(storage).find((key) => key.startsWith("yoloWorkflow:"));
  assert.equal(storage[workflowKey].pendingItemId, response.item.id);

  const stale = await invoke({
    type: "YOLO_WORKFLOW_QUEUE_ADD",
    pageId,
    expectedRevision: 0,
    ownerId: "tab-b",
    workflow: { kind: "goal", objective: "stale", status: "running" },
    item: { text: "must not queue" }
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "workflow.conflict");
  assert.equal(storage.yoloQueuesV1[pageId].items.length, 1);
});

test("clearing a workflow removes its per-conversation storage key", async () => {
  const { invoke, storage } = loadBackground();
  const pageId = "https://chatgpt.com/c/removable-workflow";
  const started = await invoke({
    type: "YOLO_WORKFLOW_SET",
    pageId,
    expectedRevision: 0,
    workflow: { kind: "goal", objective: "remove me", status: "paused" }
  });
  assert.equal(started.ok, true);
  assert.equal(Object.keys(storage).some((key) => key.startsWith("yoloWorkflow:")), true);
  const cleared = await invoke({
    type: "YOLO_WORKFLOW_CLEAR",
    pageId,
    expectedRevision: started.workflow.revision
  });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.workflow.status, "idle");
  assert.equal(Object.keys(storage).some((key) => key.startsWith("yoloWorkflow:")), false);
});
'''
if "workflow prompt enqueue commits queue and workflow together" not in read("tests/background.test.js"):
    write("tests/background.test.js", read("tests/background.test.js").rstrip() + background_append)

commands_append = r'''

test("awaiting workflows retain and clear response stability candidates safely", () => {
  const waiting = Commands.normalizeWorkflow({
    kind: "loop",
    objective: "iterate",
    status: "running",
    awaitingResponse: true,
    responseCandidateFingerprint: "candidate",
    responseCandidateSince: 1234
  }, 2000);
  assert.equal(waiting.responseCandidateFingerprint, "candidate");
  assert.equal(waiting.responseCandidateSince, 1234);

  const paused = Commands.setWorkflowStatus(waiting, "paused", "manual", 3000);
  assert.equal(paused.responseCandidateFingerprint, "");
  assert.equal(paused.responseCandidateSince, 0);
});
'''
if "response stability candidates" not in read("tests/commands.test.js"):
    write("tests/commands.test.js", read("tests/commands.test.js").rstrip() + commands_append)

queue_append = r'''

test("completion identity history remains bounded", () => {
  let state = Queue.freshState(1000);
  for (let index = 0; index < 30; index += 1) {
    const id = `completion-${index}`;
    state = Queue.addItem(state, { text: id }, { id, at: 1100 + index * 10 }).state;
    const claim = Queue.claimNext(state, "owner", { at: 1101 + index * 10 });
    state = Queue.completeClaim(claim.state, id, claim.item.claimToken, 1102 + index * 10).state;
  }
  assert.equal(state.completions.length, 20);
  assert.equal(state.completions[0].itemId, "completion-10");
  assert.equal(state.completions.at(-1).itemId, "completion-29");
});
'''
if "completion identity history remains bounded" not in read("tests/queue.test.js"):
    write("tests/queue.test.js", read("tests/queue.test.js").rstrip() + queue_append)

ui_append = r'''

test("workflow prompt creation is atomic and responses must settle", () => {
  const runtime = read("command-runtime.js");
  assert.match(runtime, /YOLO_WORKFLOW_QUEUE_ADD/);
  assert.match(runtime, /RESPONSE_STABLE_MS/);
  assert.match(runtime, /responseCandidateFingerprint/);
  assert.doesNotMatch(runtime, /type: "YOLO_QUEUE_ADD"[\s\S]{0,900}Workflow changed before its prompt could be committed/);
});

test("fallback injection restores the full command content-script stack", () => {
  const expected = '["config.js", "platforms.js", "commands.js", "command-ui.js", "content.js", "command-runtime.js"]';
  assert.match(read("popup.js"), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(read("options.js"), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("palette filter text is not leaked into optional command arguments", () => {
  const source = read("command-ui.js");
  assert.match(source, /run\(entry, argumentCommand \? search\.value : ""\)/);
});
'''
if "workflow prompt creation is atomic" not in read("tests/ui.test.js"):
    write("tests/ui.test.js", read("tests/ui.test.js").rstrip() + ui_append)

print("Third adversarial command workflow review applied")
