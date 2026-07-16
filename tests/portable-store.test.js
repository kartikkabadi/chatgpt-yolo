const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadStore() {
  const storage = {};
  let failNextRemove = false;
  const context = {
    console, Date, Promise, Math, JSON, URL, TextEncoder, setTimeout, clearTimeout,
    chrome: {
      runtime: { lastError: null },
      storage: {
        local: {
          get(keys, callback) {
            if (keys === null) return callback({ ...storage });
            const list = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]])));
          },
          set(items, callback) {
            Object.assign(storage, items);
            callback?.();
          },
          remove(keys, callback) {
            if (failNextRemove) {
              failNextRemove = false;
              context.chrome.runtime.lastError = { message: "remove failed" };
              callback?.();
              context.chrome.runtime.lastError = null;
              return;
            }
            for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
            callback?.();
          }
        }
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["config.js", "portable-store.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  return { Store: context.YOLOPortableStore, storage, failRemove() { failNextRemove = true; } };
}

test("portable mutations serialize and increment one monotonic revision", async () => {
  const { Store, storage } = loadStore();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = Store.mutate(async ({ stored }) => {
    await gate;
    return { setItems: { value: (stored.value || 0) + 1 } };
  });
  const second = Store.mutate(({ stored }) => ({ setItems: { value: (stored.value || 0) + 1 } }));
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.revision, 1);
  assert.equal(b.revision, 2);
  assert.equal(storage.value, 2);
  assert.equal(storage.yoloPortableRevisionV1, 2);
});

test("identical portable writes are no-ops and do not invalidate previews", async () => {
  const { Store, storage } = loadStore();
  const first = await Store.mutate(() => ({ setItems: { value: { enabled: true } } }));
  const second = await Store.mutate(() => ({ setItems: { value: { enabled: true } } }));
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(first.revision, 1);
  assert.equal(second.revision, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);
});

test("a failed remove rolls back values and the revision", async () => {
  const { Store, storage, failRemove } = loadStore();
  storage.keep = "old";
  storage.removeMe = "restore-me";
  storage.yoloPortableRevisionV1 = 4;
  failRemove();
  await assert.rejects(
    Store.mutate(() => ({ setItems: { keep: "new", created: true }, removeKeys: ["removeMe"] })),
    /remove failed/i
  );
  assert.equal(storage.keep, "old");
  assert.equal(storage.removeMe, "restore-me");
  assert.equal(storage.created, undefined);
  assert.equal(storage.yoloPortableRevisionV1, 4);
});
