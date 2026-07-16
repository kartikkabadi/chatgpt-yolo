from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new))


replace_once(
    "coordinator.js",
    '''  const clean = (value, max = 240) => String(value ?? "").trim().slice(0, max);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;''',
    '''  const clean = (value, max = 240) => String(value ?? "").trim().slice(0, max);
  const cleanKey = (value) => clean(value, 1400);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;'''
)

for old, new in [
    ("const key = clean(raw.key);", "const key = cleanKey(raw.key);"),
    ("const normalizedKey = clean(key);", "const normalizedKey = cleanKey(key);"),
    ("state.entries.find((candidate) => candidate.key === clean(key))", "state.entries.find((candidate) => candidate.key === cleanKey(key))"),
    ("const normalizedPrefix = clean(prefix);", "const normalizedPrefix = cleanKey(prefix);")
]:
    content = read("coordinator.js")
    if old not in content:
        raise RuntimeError(f"Coordinator key normalization pattern missing: {old}")
    write("coordinator.js", content.replace(old, new))

replace_once(
    "coordinator.js",
    '''  function reset(rawState, key = "", at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedKey = cleanKey(key);
    state.entries = normalizedKey ? state.entries.filter((entry) => entry.key !== normalizedKey) : [];
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }

  function resetPrefix(rawState, prefix, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedPrefix = cleanKey(prefix);
    if (!normalizedPrefix) return { state, ok: false, reason: "Action guard prefix is required", code: "action.guard_invalid" };
    state.entries = state.entries.filter((entry) => !entry.key.startsWith(normalizedPrefix));
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }''',
    '''  function reset(rawState, key = "", at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedKey = cleanKey(key);
    const targets = normalizedKey ? state.entries.filter((entry) => entry.key === normalizedKey) : state.entries;
    if (targets.some((entry) => ["claimed", "executing"].includes(entry.phase))) {
      return { state, ok: false, reason: "An action is still running in another tab", code: "action.busy" };
    }
    state.entries = normalizedKey ? state.entries.filter((entry) => entry.key !== normalizedKey) : [];
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }

  function resetPrefix(rawState, prefix, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedPrefix = cleanKey(prefix);
    if (!normalizedPrefix) return { state, ok: false, reason: "Action guard prefix is required", code: "action.guard_invalid" };
    const targets = state.entries.filter((entry) => entry.key.startsWith(normalizedPrefix));
    if (targets.some((entry) => ["claimed", "executing"].includes(entry.phase))) {
      return { state, ok: false, reason: "An action is still running in another tab", code: "action.busy" };
    }
    state.entries = state.entries.filter((entry) => !entry.key.startsWith(normalizedPrefix));
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }'''
)

replace_once(
    "content.js",
    '''      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) {
          return { ok: false, code: "route.changed", reason: "Conversation changed before delivery could be confirmed", deliveryAmbiguous: true };
        }
        if (Platforms.submissionObserved(state.platform, { expectedText: prompt, previousSnapshot })) {
          return { ok: true, deliveryAmbiguous: true };
        }
        await sleep(100);
      }''',
    '''      const confirmationDeadline = now() + 15_000;
      while (now() < confirmationDeadline) {
        if (state.destroyed || state.pageId !== actionPageId || currentPageId() !== actionPageId) {
          return { ok: false, code: "route.changed", reason: "Conversation changed before delivery could be confirmed", deliveryAmbiguous: true };
        }
        if (Platforms.submissionObserved(state.platform, { expectedText: prompt, previousSnapshot })) {
          return { ok: true, deliveryAmbiguous: true };
        }
        await sleep(150);
      }'''
)

replace_once(
    "content.js",
    '''  async function resetRuntime() {
    if (!await ensureCurrentRoute()) throw new Error("Conversation navigation is still in progress");
    state.runtime = freshRuntime();
    await backgroundSendWithRetry({ type: "YOLO_ACTION_RESET", pageId: state.pageId, actionKey: "" });
    scheduleNextRefresh(true);''',
    '''  async function resetRuntime() {
    if (!await ensureCurrentRoute()) throw new Error("Conversation navigation is still in progress");
    const guardReset = await backgroundSendWithRetry({ type: "YOLO_ACTION_RESET", pageId: state.pageId, actionKey: "" });
    if (!guardReset?.ok) throw new Error(guardReset?.reason || "Could not reset the conversation action guards");
    state.runtime = freshRuntime();
    scheduleNextRefresh(true);'''
)

write("tests/coordinator.test.js", read("tests/coordinator.test.js").rstrip() + r'''

test('long conversation keys remain distinct and reset by full prefix', () => {
  const shared = 'https://chatgpt.com/c/' + 'a'.repeat(300);
  const firstKey = `${shared}-one::approval`;
  const secondKey = `${shared}-two::approval`;
  let first = Coordinator.claim(null, firstKey, 'tab-a', { at: 1000 });
  first = Coordinator.complete(first.state, firstKey, first.token, 1100);
  let second = Coordinator.claim(first.state, secondKey, 'tab-b', { at: 1200 });
  second = Coordinator.complete(second.state, secondKey, second.token, 1300);
  assert.equal(second.state.entries.length, 2);
  const reset = Coordinator.resetPrefix(second.state, `${shared}-one::`, 1400);
  assert.equal(reset.ok, true);
  assert.deepEqual(reset.state.entries.map((entry) => entry.key), [secondKey]);
});

test('manual reset cannot erase an active side effect lease', () => {
  const claim = Coordinator.claim(null, 'page::approval', 'tab-a', { at: 1000, leaseMs: 10000 });
  const claimedReset = Coordinator.resetPrefix(claim.state, 'page::', 1100);
  assert.equal(claimedReset.ok, false);
  assert.equal(claimedReset.code, 'action.busy');
  const executing = Coordinator.begin(claim.state, 'page::approval', claim.token, 1200);
  const executingReset = Coordinator.resetPrefix(executing.state, 'page::', 1300);
  assert.equal(executingReset.ok, false);
  assert.equal(executingReset.code, 'action.busy');
  const unknown = Coordinator.normalizeState(executing.state, 12000);
  const recovered = Coordinator.resetPrefix(unknown, 'page::', 12001);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.entries.length, 0);
});
''')

write("tests/reliability-foundation.test.js", read("tests/reliability-foundation.test.js").rstrip() + r'''

test('runtime reset fails closed when guard storage cannot be reset', () => {
  const content = read('content.js');
  const start = content.indexOf('async function resetRuntime');
  const end = content.indexOf('function registerClient', start);
  const reset = content.slice(start, end);
  assert.match(reset, /const guardReset = await backgroundSendWithRetry/);
  assert.match(reset, /if \(!guardReset\?\.ok\) throw new Error/);
  assert.ok(reset.indexOf('guardReset') < reset.indexOf('state.runtime = freshRuntime()'));
});

test('delivery confirmation uses a wall-clock deadline', () => {
  const content = read('content.js');
  assert.match(content, /confirmationDeadline = now\(\) \+ 15_000/);
  assert.doesNotMatch(content, /attempt < 50/);
});
''')
