((root, factory) => {
  const Config = typeof module === "object" && module.exports ? require("./config.js") : root.YOLOConfig;
  const Shared = typeof module === "object" && module.exports ? require("./shared.js") : root.YOLOShared;
  const api = factory(Config, Shared);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOPortableStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Config, Shared) => {
  "use strict";

  const lock = Shared.createLock();
  const REVISION_KEY = Config.STORAGE_KEYS.portableRevision;

  const storageGet = Shared.storageGet;
  const storageSet = Shared.storageSet;
  const storageRemove = Shared.storageRemove;
  const withLock = (task) => Shared.withLock(lock, task);

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map((entry) => stable(entry)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function revisionOf(stored) {
    return Math.max(0, Math.floor(Number(stored?.[REVISION_KEY]) || 0));
  }

  async function readLocked(reader) {
    return withLock(async () => {
      const stored = await storageGet(null);
      const context = { stored, revision: revisionOf(stored) };
      return typeof reader === "function" ? reader(context) : context;
    });
  }

  function uniqueKeys(values) {
    return [...new Set(values.map((value) => String(value || "")).filter(Boolean))];
  }

  async function mutate(builder) {
    return withLock(async () => {
      const stored = await storageGet(null);
      const revision = revisionOf(stored);
      const plan = await builder({ stored, revision });
      if (!plan) return { ok: false, reason: "Portable mutation plan is missing", code: "data.plan_missing" };
      if (plan.ok === false) return plan;
      if (plan.mutate === false) return { ok: true, ...(plan.result || {}), revision, changed: false };

      const requestedSet = { ...(plan.setItems || {}) };
      const requestedRemove = uniqueKeys(Array.isArray(plan.removeKeys) ? plan.removeKeys : [])
        .filter((key) => key !== REVISION_KEY && !Object.prototype.hasOwnProperty.call(requestedSet, key));
      const changedSet = Object.entries(requestedSet)
        .filter(([key, value]) => stable(stored[key]) !== stable(value));
      const changedRemove = requestedRemove.filter((key) => Object.prototype.hasOwnProperty.call(stored, key));

      if (!changedSet.length && !changedRemove.length) {
        return { ok: true, ...(plan.result || {}), revision, changed: false };
      }

      const nextRevision = revision + 1;
      const setItems = Object.fromEntries(changedSet);
      setItems[REVISION_KEY] = nextRevision;
      const touchedKeys = uniqueKeys([...Object.keys(setItems), ...changedRemove]);
      const previous = Object.fromEntries(
        touchedKeys.filter((key) => Object.prototype.hasOwnProperty.call(stored, key)).map((key) => [key, stored[key]])
      );
      const createdKeys = touchedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(stored, key));

      try {
        await storageSet(setItems);
        if (changedRemove.length) await storageRemove(changedRemove);
      } catch (error) {
        try {
          if (Object.keys(previous).length) await storageSet(previous);
          if (createdKeys.length) await storageRemove(createdKeys);
        } catch {
          throw new Error(`${Shared.errorMessage(error)}; portable rollback also failed`);
        }
        throw error;
      }

      return { ok: true, ...(plan.result || {}), revision: nextRevision, changed: true };
    });
  }

  return Object.freeze({
    REVISION_KEY,
    stable,
    revisionOf,
    read: readLocked,
    mutate
  });
});
