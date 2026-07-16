"use strict";

importScripts("config.js", "queue.js");

const Config = globalThis.YOLOConfig;
const Queue = globalThis.YOLOQueue;
const queueLock = { current: Promise.resolve() };
const templateLock = { current: Promise.resolve() };
const MAX_CONVERSATION_QUEUES = 25;

const storageGet = (keys) => new Promise((resolve, reject) => {
  chrome.storage.local.get(keys, (items) => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Extension storage read failed"));
    else resolve(items || {});
  });
});
const storageSet = (items) => new Promise((resolve, reject) => {
  chrome.storage.local.set(items, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Extension storage write failed"));
    else resolve(true);
  });
});

function withLock(lock, task) {
  const run = lock.current.catch(() => {}).then(task);
  lock.current = run.catch(() => {});
  return run;
}

async function readQueueMap() {
  const stored = await storageGet([Config.STORAGE_KEYS.queues]);
  const value = stored[Config.STORAGE_KEYS.queues];
  return value && typeof value === "object" ? value : {};
}

async function readQueueState(pageId) {
  return withLock(queueLock, async () => {
    const map = await readQueueMap();
    const state = Queue.normalizeState(map[pageId]);
    return { ok: true, state, summary: Queue.summary(state) };
  });
}

async function mutateQueue(pageId, mutator) {
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
}

function validPageId(pageId) {
  return typeof pageId === "string" && pageId.length > 0 && pageId.length <= 1000;
}

function normalizeTemplate(raw, fallbackId = "") {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 80);
  const text = String(raw.text || "").trim().slice(0, Queue.MAX_TEXT_LENGTH);
  if (!name || !text) return null;
  return {
    id: String(raw.id || fallbackId || Queue.makeId("template")).trim().slice(0, 180),
    name,
    text,
    builtIn: Boolean(raw.builtIn),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now()
  };
}

async function readTemplates() {
  const stored = await storageGet([Config.STORAGE_KEYS.templates]);
  const raw = stored[Config.STORAGE_KEYS.templates];
  const source = Array.isArray(raw) && raw.length ? raw : Config.DEFAULT_TEMPLATES;
  const templates = source.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  return templates.length ? templates : Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate(template));
}

async function writeTemplates(templates) {
  const normalized = templates.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  await storageSet({ [Config.STORAGE_KEYS.templates]: normalized });
  return normalized;
}

async function handleTemplateMessage(message) {
  return withLock(templateLock, async () => {
    let templates = await readTemplates();
    const now = Date.now();
    if (message.type === "YOLO_TEMPLATES_GET") return { ok: true, templates };
    if (message.type === "YOLO_TEMPLATES_RESET") {
      templates = Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate({ ...template, createdAt: now, updatedAt: now }));
      return { ok: true, templates: await writeTemplates(templates) };
    }
    if (message.type === "YOLO_TEMPLATE_ADD") {
      if (templates.length >= 50) return { ok: false, reason: "Template limit reached" };
      const template = normalizeTemplate({ ...message.template, id: Queue.makeId("template"), createdAt: now, updatedAt: now });
      if (!template) return { ok: false, reason: "Template name and text are required" };
      templates.push(template);
      return { ok: true, templates: await writeTemplates(templates), template };
    }
    if (message.type === "YOLO_TEMPLATE_UPDATE") {
      const index = templates.findIndex((template) => template.id === message.template?.id);
      if (index < 0) return { ok: false, reason: "Template not found" };
      const template = normalizeTemplate({ ...templates[index], ...message.template, builtIn: false, updatedAt: now });
      if (!template) return { ok: false, reason: "Template name and text are required" };
      templates[index] = template;
      return { ok: true, templates: await writeTemplates(templates), template };
    }
    if (message.type === "YOLO_TEMPLATE_REMOVE") {
      const template = templates.find((entry) => entry.id === message.templateId);
      if (!template) return { ok: false, reason: "Template not found" };
      templates = templates.filter((entry) => entry.id !== message.templateId);
      return { ok: true, templates: await writeTemplates(templates) };
    }
    if (message.type === "YOLO_TEMPLATES_REORDER") {
      const order = Array.isArray(message.orderedIds) ? message.orderedIds : [];
      const byId = new Map(templates.map((template) => [template.id, template]));
      const ordered = [];
      for (const id of order) {
        if (!byId.has(id)) continue;
        ordered.push(byId.get(id));
        byId.delete(id);
      }
      for (const template of templates) if (byId.has(template.id)) ordered.push(template);
      return { ok: true, templates: await writeTemplates(ordered) };
    }
    return { ok: false, reason: "Unknown template operation" };
  });
}

async function handleQueueMessage(message) {
  const pageId = message.pageId;
  if (!validPageId(pageId)) return { ok: false, reason: "Invalid conversation identifier" };

  if (message.type === "YOLO_QUEUE_GET") {
    return readQueueState(pageId);
  }
  if (message.type === "YOLO_QUEUE_ADD") {
    return mutateQueue(pageId, async (state) => Queue.addItem(state, message.item, { front: Boolean(message.front) }));
  }
  if (message.type === "YOLO_QUEUE_UPDATE") {
    return mutateQueue(pageId, async (state) => Queue.updateItem(state, message.itemId, message.text));
  }
  if (message.type === "YOLO_QUEUE_REMOVE") {
    return mutateQueue(pageId, async (state) => Queue.removeItem(state, message.itemId));
  }
  if (message.type === "YOLO_QUEUE_REORDER") {
    return mutateQueue(pageId, async (state) => Queue.reorderItems(state, message.orderedIds));
  }
  if (message.type === "YOLO_QUEUE_PAUSE") {
    return mutateQueue(pageId, async (state) => Queue.setPaused(state, message.paused));
  }
  if (message.type === "YOLO_QUEUE_CLEAR") {
    return mutateQueue(pageId, async (state) => Queue.clearItems(state));
  }
  if (message.type === "YOLO_QUEUE_RETRY") {
    return mutateQueue(pageId, async (state) => Queue.retryItem(state, message.itemId));
  }
  if (message.type === "YOLO_QUEUE_CLAIM") {
    return mutateQueue(pageId, async (state) => Queue.claimNext(state, message.ownerId));
  }
  if (message.type === "YOLO_QUEUE_MARK_SUBMITTING") {
    return mutateQueue(pageId, async (state) => Queue.markSubmitting(state, message.itemId, message.claimToken));
  }
  if (message.type === "YOLO_QUEUE_RELEASE") {
    return mutateQueue(pageId, async (state) => Queue.releaseClaim(state, message.itemId, message.claimToken, { reason: message.reason }));
  }
  if (message.type === "YOLO_QUEUE_COMPLETE") {
    return mutateQueue(pageId, async (state) => Queue.completeClaim(state, message.itemId, message.claimToken));
  }
  if (message.type === "YOLO_QUEUE_FAIL") {
    return mutateQueue(pageId, async (state) => Queue.failClaim(state, message.itemId, message.claimToken, {
      error: message.error,
      errorCode: message.errorCode,
      maxRetries: message.maxRetries,
      backoffSec: message.backoffSec,
      pauseOnFailure: message.pauseOnFailure,
      deliveryAmbiguous: message.deliveryAmbiguous
    }));
  }
  if (message.type === "YOLO_EVENT_APPEND") {
    return mutateQueue(pageId, async (state) => ({ ok: true, state: Queue.appendEvent(state, message.event) }));
  }
  return { ok: false, reason: "Unknown queue operation" };
}

chrome.runtime.onInstalled.addListener(() => {
  readTemplates().then(writeTemplates).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type?.startsWith("YOLO_")) return false;
  const task = message.type.includes("TEMPLATE")
    ? handleTemplateMessage(message)
    : handleQueueMessage(message);
  Promise.resolve(task)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
  return true;
});
