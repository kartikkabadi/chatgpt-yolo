((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOQueue = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const MAX_ITEMS = 50;
  const MAX_TEXT_LENGTH = 8000;
  const MAX_QUEUE_TEXT_LENGTH = 120000;
  const MAX_EVENTS = 100;
  const CLAIM_TTL_MS = 2 * 60 * 1000;
  const EVENT_LEVELS = new Set(["info", "success", "warning", "error"]);

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const cleanText = (value, max = MAX_TEXT_LENGTH) => String(value ?? "").trim().slice(0, max);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function makeId(prefix = "q") {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function freshState(at = Date.now()) {
    return {
      version: 1,
      paused: false,
      pauseReason: "",
      items: [],
      events: [],
      lastSentAt: 0,
      lastCompletedItemId: "",
      lastCompletedSource: "",
      lastCompletedSourceId: "",
      updatedAt: at
    };
  }

  function normalizeEvent(raw, at = Date.now()) {
    if (!raw || typeof raw !== "object") return null;
    const code = cleanText(raw.code, 120);
    const message = cleanText(raw.message, 500);
    if (!code || !message) return null;
    return {
      id: cleanText(raw.id, 160) || makeId("event"),
      code,
      message,
      level: EVENT_LEVELS.has(raw.level) ? raw.level : "info",
      at: finite(raw.at, at)
    };
  }

  function normalizeItem(raw, at = Date.now()) {
    if (!raw || typeof raw !== "object") return null;
    const text = cleanText(raw.text);
    if (!text) return null;

    const state = ["pending", "sending", "failed"].includes(raw.state) ? raw.state : "pending";
    const normalized = {
      id: cleanText(raw.id, 180) || makeId("item"),
      text,
      templateId: cleanText(raw.templateId, 180),
      source: cleanText(raw.source, 120),
      sourceId: cleanText(raw.sourceId, 180),
      state,
      attempts: Math.max(0, Math.round(finite(raw.attempts, 0))),
      error: cleanText(raw.error, 500),
      errorCode: cleanText(raw.errorCode, 120),
      createdAt: finite(raw.createdAt, at),
      updatedAt: finite(raw.updatedAt, at),
      nextAttemptAt: Math.max(0, finite(raw.nextAttemptAt, 0)),
      claimToken: cleanText(raw.claimToken, 220),
      claimOwner: cleanText(raw.claimOwner, 220),
      claimExpiresAt: Math.max(0, finite(raw.claimExpiresAt, 0)),
      claimPhase: ["claimed", "submitting"].includes(raw.claimPhase) ? raw.claimPhase : (state === "sending" ? "claimed" : "")
    };

    if (normalized.state === "sending" && normalized.claimExpiresAt <= at) {
      const deliveryUnknown = normalized.claimPhase === "submitting";
      normalized.state = deliveryUnknown ? "failed" : "pending";
      normalized.claimToken = "";
      normalized.claimOwner = "";
      normalized.claimExpiresAt = 0;
      normalized.claimPhase = "";
      normalized.error = deliveryUnknown
        ? "Delivery status is unknown because the sender lease expired after submission began"
        : (normalized.error || "Previous sender lease expired before submission began");
      normalized.errorCode = deliveryUnknown ? "queue.delivery_unknown" : (normalized.errorCode || "queue.claim_expired");
      normalized.updatedAt = at;
    }

    if (normalized.state !== "sending") {
      normalized.claimToken = "";
      normalized.claimOwner = "";
      normalized.claimExpiresAt = 0;
      normalized.claimPhase = "";
    }
    return normalized;
  }

  function normalizeItems(rawItems, at) {
    const items = [];
    const ids = new Set();
    let totalTextLength = 0;
    let hasSendingItem = false;

    for (const rawItem of Array.isArray(rawItems) ? rawItems : []) {
      if (items.length >= MAX_ITEMS) break;
      const item = normalizeItem(rawItem, at);
      if (!item || ids.has(item.id)) continue;
      if (totalTextLength + item.text.length > MAX_QUEUE_TEXT_LENGTH) continue;
      ids.add(item.id);
      totalTextLength += item.text.length;
      if (item.state === "sending") {
        if (hasSendingItem) {
          const deliveryUnknown = item.claimPhase === "submitting";
          item.state = deliveryUnknown ? "failed" : "pending";
          item.claimToken = "";
          item.claimOwner = "";
          item.claimExpiresAt = 0;
          item.claimPhase = "";
          item.error = deliveryUnknown
            ? "Delivery status is unknown because multiple sender leases were recovered"
            : (item.error || "Duplicate sender lease recovered before submission began");
          item.errorCode = deliveryUnknown ? "queue.delivery_unknown" : (item.errorCode || "queue.duplicate_claim");
        } else hasSendingItem = true;
      }
      items.push(item);
    }
    return items;
  }

  function normalizeState(raw, at = Date.now()) {
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
      lastCompletedItemId: cleanText(source.lastCompletedItemId, 180),
      lastCompletedSource: cleanText(source.lastCompletedSource, 120),
      lastCompletedSourceId: cleanText(source.lastCompletedSourceId, 180),
      updatedAt: finite(source.updatedAt, at)
    };
  }

  function appendEvent(rawState, event, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalized = normalizeEvent({ ...event, at: event?.at ?? at }, at);
    if (!normalized) return state;

    const previous = state.events.at(-1);
    if (previous && previous.code === normalized.code && previous.message === normalized.message && normalized.at - previous.at < 3000) {
      previous.at = normalized.at;
      state.updatedAt = at;
      return state;
    }

    state.events = [...state.events, normalized].slice(-MAX_EVENTS);
    state.updatedAt = at;
    return state;
  }

  function addItem(rawState, input, { front = false, at = Date.now(), id } = {}) {
    let state = normalizeState(rawState, at);
    if (state.items.length >= MAX_ITEMS) {
      return { state, ok: false, reason: `Queue limit of ${MAX_ITEMS} messages reached`, code: "queue.full" };
    }
    const text = cleanText(input?.text);
    if (!text) return { state, ok: false, reason: "Message is empty", code: "queue.empty" };
    const totalTextLength = state.items.reduce((sum, item) => sum + item.text.length, 0);
    if (totalTextLength + text.length > MAX_QUEUE_TEXT_LENGTH) {
      return { state, ok: false, reason: "Queue text capacity reached; send or remove messages before adding more", code: "queue.capacity" };
    }

    const item = normalizeItem({
      id: id || makeId("item"),
      text,
      templateId: input?.templateId || "",
      source: input?.source || "",
      sourceId: input?.sourceId || "",
      state: "pending",
      attempts: 0,
      createdAt: at,
      updatedAt: at
    }, at);
    state.items = front ? [item, ...state.items] : [...state.items, item];
    state.updatedAt = at;
    state = appendEvent(state, {
      code: "queue.added",
      message: front ? "Message added to the front of the queue" : "Message added to the queue",
      level: "success"
    }, at);
    return { state, ok: true, item };
  }

  function updateItem(rawState, itemId, text, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const clean = cleanText(text);
    if (!clean) return { state, ok: false, reason: "Message is empty", code: "queue.empty" };
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return { state, ok: false, reason: "Queue item not found", code: "queue.not_found" };
    if (item.state === "sending") return { state, ok: false, reason: "Message is currently sending", code: "queue.sending" };
    const totalWithoutItem = state.items.reduce((sum, entry) => sum + (entry.id === item.id ? 0 : entry.text.length), 0);
    if (totalWithoutItem + clean.length > MAX_QUEUE_TEXT_LENGTH) {
      return { state, ok: false, reason: "Queue text capacity reached; shorten or remove another message", code: "queue.capacity" };
    }
    item.text = clean;
    item.updatedAt = at;
    item.error = "";
    item.errorCode = "";
    if (item.state === "failed") {
      item.state = "pending";
      if (state.pauseReason === "failure" && !state.items.some((entry) => entry.id !== item.id && entry.state === "failed")) {
        state.paused = false;
        state.pauseReason = "";
      }
    }
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.edited", message: "Queued message updated", level: "info" }, at);
    return { state, ok: true, item };
  }

  function removeItem(rawState, itemId, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return { state, ok: false, reason: "Queue item not found", code: "queue.not_found" };
    if (item.state === "sending") return { state, ok: false, reason: "Message is currently sending", code: "queue.sending" };
    state.items = state.items.filter((entry) => entry.id !== itemId);
    if (state.pauseReason === "failure" && !state.items.some((entry) => entry.state === "failed")) {
      state.paused = false;
      state.pauseReason = "";
    }
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.removed", message: "Queued message removed", level: "info" }, at);
    return { state, ok: true };
  }

  function reorderItems(rawState, orderedIds, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const ids = Array.isArray(orderedIds) ? orderedIds.map(String) : [];
    const movableById = new Map(state.items.filter((item) => item.state !== "sending").map((item) => [item.id, item]));
    const movable = [];
    for (const id of ids) {
      const item = movableById.get(id);
      if (!item) continue;
      movable.push(item);
      movableById.delete(id);
    }
    for (const item of state.items) {
      if (movableById.has(item.id)) {
        movable.push(item);
        movableById.delete(item.id);
      }
    }
    let movableIndex = 0;
    state.items = state.items.map((item) => item.state === "sending" ? item : movable[movableIndex++]);
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.reordered", message: "Queue order updated", level: "info" }, at);
    return { state, ok: true };
  }

  function setPaused(rawState, paused, at = Date.now()) {
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

  function clearItems(rawState, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const sending = state.items.filter((item) => item.state === "sending");
    state.items = sending;
    if (state.pauseReason === "failure") {
      state.paused = false;
      state.pauseReason = "";
    }
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.cleared", message: "Pending queue cleared", level: "warning" }, at);
    return { state, ok: true };
  }

  function retryItem(rawState, itemId, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return { state, ok: false, reason: "Queue item not found", code: "queue.not_found" };
    if (item.state === "sending") return { state, ok: false, reason: "Message is currently sending", code: "queue.sending" };
    item.state = "pending";
    item.error = "";
    item.errorCode = "";
    item.nextAttemptAt = 0;
    item.updatedAt = at;
    if (state.pauseReason === "failure" && !state.items.some((entry) => entry.state === "failed")) {
      state.paused = false;
      state.pauseReason = "";
    }
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.retry", message: "Failed message returned to the queue", level: "info" }, at);
    return { state, ok: true, item };
  }

  function claimNext(rawState, ownerId, { at = Date.now(), leaseMs = CLAIM_TTL_MS } = {}) {
    let state = normalizeState(rawState, at);
    if (state.paused) return { state, ok: false, reason: "Queue is paused", code: "queue.paused" };
    if (state.items.some((entry) => entry.state === "sending")) {
      return { state, ok: false, reason: "Another queued message is already sending", code: "queue.busy" };
    }
    const item = state.items.find((entry) => entry.state === "pending");
    if (!item) return { state, ok: false, reason: "No queued message is ready", code: "queue.empty" };
    if (item.nextAttemptAt > at) {
      return { state, ok: false, reason: "The next queued message is waiting for retry backoff", code: "queue.waiting", nextAttemptAt: item.nextAttemptAt };
    }

    item.state = "sending";
    item.claimOwner = cleanText(ownerId, 220) || "unknown";
    item.claimToken = makeId("claim");
    item.claimExpiresAt = at + Math.max(5000, finite(leaseMs, CLAIM_TTL_MS));
    item.claimPhase = "claimed";
    item.updatedAt = at;
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.sending", message: "Sending next queued message", level: "info" }, at);
    return { state, ok: true, item: clone(item) };
  }

  function markSubmitting(rawState, itemId, claimToken, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || item.state !== "sending" || item.claimToken !== claimToken) {
      return { state, ok: false, reason: "Queue claim is no longer valid", code: "queue.claim_invalid" };
    }
    item.claimPhase = "submitting";
    item.updatedAt = at;
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.submitting", message: "Submitting queued message", level: "info" }, at);
    return { state, ok: true, item: clone(item) };
  }

  function releaseClaim(rawState, itemId, claimToken, { at = Date.now(), reason = "Message returned to queue" } = {}) {
    let state = normalizeState(rawState, at);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || item.state !== "sending" || item.claimToken !== claimToken) {
      return { state, ok: false, reason: "Queue claim is no longer valid", code: "queue.claim_invalid" };
    }
    item.state = "pending";
    item.claimToken = "";
    item.claimOwner = "";
    item.claimExpiresAt = 0;
    item.claimPhase = "";
    item.updatedAt = at;
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.released", message: cleanText(reason, 500), level: "info" }, at);
    return { state, ok: true };
  }

  function completeClaim(rawState, itemId, claimToken, at = Date.now()) {
    let state = normalizeState(rawState, at);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) {
      if (state.lastCompletedItemId === itemId) return { state, ok: true, alreadyCompleted: true };
      return { state, ok: false, reason: "Queue item was not found", code: "queue.not_found" };
    }
    if (item.state !== "sending" || item.claimToken !== claimToken) {
      return { state, ok: false, reason: "Queue claim is no longer valid", code: "queue.claim_invalid" };
    }
    state.items = state.items.filter((entry) => entry.id !== itemId);
    state.lastSentAt = at;
    state.lastCompletedItemId = item.id;
    state.lastCompletedSource = item.source;
    state.lastCompletedSourceId = item.sourceId;
    state.updatedAt = at;
    state = appendEvent(state, { code: "queue.sent", message: "Queued message sent", level: "success" }, at);
    return { state, ok: true, item };
  }

  function failClaim(rawState, itemId, claimToken, options = {}) {
    const at = options.at ?? Date.now();
    let state = normalizeState(rawState, at);
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || item.state !== "sending" || item.claimToken !== claimToken) {
      return { state, ok: false, reason: "Queue claim is no longer valid", code: "queue.claim_invalid" };
    }

    const maxRetries = Math.max(0, Math.round(finite(options.maxRetries, 0)));
    const backoffSec = Math.max(1, finite(options.backoffSec, 30));
    const ambiguousDelivery = Boolean(options.deliveryAmbiguous);
    item.attempts += 1;
    item.error = cleanText(options.error || "Message could not be sent", 500);
    item.errorCode = cleanText(options.errorCode || "queue.send_failed", 120);
    item.claimToken = "";
    item.claimOwner = "";
    item.claimExpiresAt = 0;
    item.claimPhase = "";
    item.updatedAt = at;

    if (ambiguousDelivery) {
      const detail = item.error;
      item.state = "failed";
      item.nextAttemptAt = 0;
      item.error = cleanText(`Delivery status is unknown; manual retry required. ${detail}`, 500);
      item.errorCode = "queue.delivery_unknown";
      state.paused = true;
      state.pauseReason = "failure";
      state = appendEvent(state, {
        code: "queue.delivery_unknown",
        message: "Queue paused because delivery could not be confirmed; manual retry is required",
        level: "error"
      }, at);
      state.updatedAt = at;
      return { state, ok: true, item: clone(item) };
    }

    if (item.attempts <= maxRetries) {
      item.state = "pending";
      item.nextAttemptAt = at + backoffSec * 1000 * Math.max(1, item.attempts);
      state = appendEvent(state, {
        code: "queue.retry_scheduled",
        message: `Queue send failed; retry ${item.attempts} scheduled`,
        level: "warning"
      }, at);
    } else {
      item.state = "failed";
      item.nextAttemptAt = 0;
      if (options.pauseOnFailure) {
        state.paused = true;
        state.pauseReason = "failure";
      }
      state = appendEvent(state, {
        code: "queue.failed",
        message: options.pauseOnFailure ? "Queue paused after a message failed" : "Queued message failed",
        level: "error"
      }, at);
    }
    state.updatedAt = at;
    return { state, ok: true, item: clone(item) };
  }

  function summary(rawState, at = Date.now()) {
    const state = normalizeState(rawState, at);
    return {
      paused: state.paused,
      pauseReason: state.pauseReason,
      total: state.items.length,
      pending: state.items.filter((item) => item.state === "pending").length,
      sending: state.items.filter((item) => item.state === "sending").length,
      failed: state.items.filter((item) => item.state === "failed").length,
      lastSentAt: state.lastSentAt,
      updatedAt: state.updatedAt
    };
  }

  return Object.freeze({
    MAX_ITEMS,
    MAX_TEXT_LENGTH,
    MAX_QUEUE_TEXT_LENGTH,
    MAX_EVENTS,
    CLAIM_TTL_MS,
    makeId,
    freshState,
    normalizeState,
    appendEvent,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    setPaused,
    clearItems,
    retryItem,
    claimNext,
    markSubmitting,
    releaseClaim,
    completeClaim,
    failClaim,
    summary
  });
});
