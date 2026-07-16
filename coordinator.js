((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOCoordinator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const MAX_GUARDS = 100;
  const DEFAULT_LEASE_MS = 20 * 1000;
  const MAX_COMPLETION_AGE_MS = 24 * 60 * 60 * 1000;
  const PHASES = new Set(["idle", "claimed", "executing", "unknown"]);

  const clean = (value, max = 240) => String(value ?? "").trim().slice(0, max);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function makeToken() {
    if (globalThis.crypto?.randomUUID) return `guard_${globalThis.crypto.randomUUID()}`;
    return `guard_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeEntry(raw, at = Date.now()) {
    if (!raw || typeof raw !== "object") return null;
    const key = clean(raw.key);
    if (!key) return null;

    const rawPhase = PHASES.has(raw.phase) ? raw.phase : (raw.ownerId ? "claimed" : "idle");
    const expiresAt = Math.max(0, finite(raw.expiresAt, 0));
    const active = ["claimed", "executing"].includes(rawPhase) && expiresAt > at;
    const expiredExecuting = rawPhase === "executing" && !active && clean(raw.token);
    const unknown = rawPhase === "unknown" || expiredExecuting;
    const phase = active ? rawPhase : (unknown ? "unknown" : "idle");

    return {
      key,
      phase,
      ownerId: active ? clean(raw.ownerId) : "",
      token: active || unknown ? clean(raw.token) : "",
      expiresAt: active ? expiresAt : 0,
      unknownAt: unknown ? Math.max(0, finite(raw.unknownAt, expiresAt || at)) : 0,
      lastCompletedAt: Math.max(0, finite(raw.lastCompletedAt, 0)),
      lastCompletedToken: clean(raw.lastCompletedToken),
      updatedAt: Math.max(0, finite(raw.updatedAt, at))
    };
  }

  function normalizeState(raw, at = Date.now()) {
    const entries = [];
    const seen = new Set();
    for (const value of Array.isArray(raw?.entries) ? raw.entries : []) {
      const entry = normalizeEntry(value, at);
      if (!entry || seen.has(entry.key)) continue;
      const recentCompletion = entry.lastCompletedAt && at - entry.lastCompletedAt <= MAX_COMPLETION_AGE_MS;
      if (entry.phase === "idle" && !recentCompletion) continue;
      seen.add(entry.key);
      entries.push(entry);
    }
    entries.sort((a, b) => a.updatedAt - b.updatedAt);
    return { version: 2, entries: entries.slice(-MAX_GUARDS), updatedAt: Math.max(0, finite(raw?.updatedAt, at)) };
  }

  function claim(rawState, key, ownerId, options = {}) {
    const at = options.at ?? Date.now();
    const leaseMs = Math.max(5000, finite(options.leaseMs, DEFAULT_LEASE_MS));
    const cooldownMs = Math.max(0, finite(options.cooldownMs, 0));
    const state = normalizeState(rawState, at);
    const normalizedKey = clean(key);
    const normalizedOwner = clean(ownerId);
    if (!normalizedKey || !normalizedOwner) {
      return { state, ok: false, reason: "Action key and owner are required", code: "action.guard_invalid" };
    }

    let entry = state.entries.find((candidate) => candidate.key === normalizedKey);
    if (!entry) {
      entry = normalizeEntry({ key: normalizedKey }, at);
      state.entries.push(entry);
    }

    if (entry.phase === "unknown") {
      return {
        state,
        ok: false,
        reason: "The previous action may have happened and requires manual reset before retrying",
        code: "action.outcome_unknown",
        unknownAt: entry.unknownAt
      };
    }
    if (entry.ownerId && entry.ownerId !== normalizedOwner && entry.expiresAt > at) {
      return { state, ok: false, reason: "This action is already running in another tab", code: "action.busy", retryAt: entry.expiresAt };
    }
    if (entry.phase === "idle" && cooldownMs > 0 && entry.lastCompletedAt + cooldownMs > at) {
      return { state, ok: false, reason: "This action is still in cooldown", code: "action.cooldown", retryAt: entry.lastCompletedAt + cooldownMs };
    }

    if (entry.ownerId === normalizedOwner && entry.expiresAt > at) {
      entry.expiresAt = at + leaseMs;
      entry.updatedAt = at;
      state.updatedAt = at;
      return { state: normalizeState(state, at), ok: true, token: entry.token, renewed: true, phase: entry.phase };
    }

    entry.phase = "claimed";
    entry.ownerId = normalizedOwner;
    entry.token = makeToken();
    entry.expiresAt = at + leaseMs;
    entry.unknownAt = 0;
    entry.updatedAt = at;
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, token: entry.token, renewed: false, phase: entry.phase };
  }

  function begin(rawState, key, token, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const entry = state.entries.find((candidate) => candidate.key === clean(key));
    const normalizedToken = clean(token);
    if (!entry) return { state, ok: false, reason: "Action lease was not found", code: "action.guard_missing" };
    if (entry.phase === "unknown" && entry.token === normalizedToken) {
      return { state, ok: true, alreadyExecuting: true, unknown: true };
    }
    if (!normalizedToken || entry.token !== normalizedToken || !["claimed", "executing"].includes(entry.phase)) {
      return { state, ok: false, reason: "Action lease is no longer valid", code: "action.guard_invalid" };
    }
    entry.phase = "executing";
    entry.updatedAt = at;
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, alreadyExecuting: false };
  }

  function complete(rawState, key, token, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedKey = clean(key);
    const normalizedToken = clean(token);
    const entry = state.entries.find((candidate) => candidate.key === normalizedKey);
    if (!entry) return { state, ok: false, reason: "Action lease was not found", code: "action.guard_missing" };
    if (entry.lastCompletedToken && entry.lastCompletedToken === normalizedToken) {
      return { state, ok: true, alreadyCompleted: true };
    }
    if (!normalizedToken || entry.token !== normalizedToken || !["claimed", "executing", "unknown"].includes(entry.phase)) {
      return { state, ok: false, reason: "Action lease is no longer valid", code: "action.guard_invalid" };
    }
    entry.phase = "idle";
    entry.ownerId = "";
    entry.token = "";
    entry.expiresAt = 0;
    entry.unknownAt = 0;
    entry.lastCompletedAt = at;
    entry.lastCompletedToken = normalizedToken;
    entry.updatedAt = at;
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true };
  }

  function release(rawState, key, token, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const entry = state.entries.find((candidate) => candidate.key === clean(key));
    if (!entry) return { state, ok: true, released: false };
    if (!token || entry.token !== clean(token)) {
      return { state, ok: false, reason: "Action lease is no longer valid", code: "action.guard_invalid" };
    }
    if (["executing", "unknown"].includes(entry.phase)) {
      return {
        state,
        ok: false,
        reason: "The action may already have happened and cannot be released automatically",
        code: "action.outcome_unknown"
      };
    }
    entry.phase = "idle";
    entry.ownerId = "";
    entry.token = "";
    entry.expiresAt = 0;
    entry.updatedAt = at;
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, released: true };
  }

  function reset(rawState, key = "", at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedKey = clean(key);
    state.entries = normalizedKey ? state.entries.filter((entry) => entry.key !== normalizedKey) : [];
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }

  return Object.freeze({
    MAX_GUARDS,
    DEFAULT_LEASE_MS,
    freshState: () => normalizeState(null),
    normalizeState,
    claim,
    begin,
    complete,
    release,
    reset
  });
});
