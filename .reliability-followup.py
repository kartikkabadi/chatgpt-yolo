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
    "content.js",
    '''  function actionDedupeKey(action, prompt, reason) {
    const cooldownSec = action === "recovery" ? state.settings.errorCooldownSec : state.settings.deepNudgeCooldownSec;
    const bucketMs = Math.max(1000, cooldownSec * 1000);
    return `auto:${action}:${Math.floor(now() / bucketMs)}:${Commands.fingerprint(`${prompt}\n${reason}`)}`;
  }''',
    '''  function actionDedupeKey(action, prompt, reason) {
    return `auto:${action}:${Commands.fingerprint(`${prompt}\n${reason}`)}`;
  }'''
)

replace_once(
    "background.js",
    '''  const actionKey = String(message.actionKey || "").trim().slice(0, 240);
  const guardKey = `${pageId}::${actionKey}`;
  if (message.type === "YOLO_ACTION_CLAIM") {''',
    '''  const actionKey = String(message.actionKey || "").trim().slice(0, 240);
  if (message.type !== "YOLO_ACTION_RESET" && !actionKey) {
    return { ok: false, reason: "Action key is required", code: "action.guard_invalid" };
  }
  const guardKey = `${pageId}::${actionKey}`;
  if (message.type === "YOLO_ACTION_CLAIM") {'''
)

replace_once(
    "background.js",
    '''  if (message.type === "YOLO_ACTION_RESET") {
    return mutateActionGuards((state) => Coordinator.reset(state, actionKey ? guardKey : ""));
  }''',
    '''  if (message.type === "YOLO_ACTION_RESET") {
    return mutateActionGuards((state) => actionKey
      ? Coordinator.reset(state, guardKey)
      : Coordinator.resetPrefix(state, `${pageId}::`));
  }'''
)

replace_once(
    "coordinator.js",
    '''    entries.sort((a, b) => a.updatedAt - b.updatedAt);
    return { version: 2, entries: entries.slice(-MAX_GUARDS), updatedAt: Math.max(0, finite(raw?.updatedAt, at)) };''',
    '''    const protectedEntries = entries
      .filter((entry) => entry.phase !== "idle")
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const idleEntries = entries
      .filter((entry) => entry.phase === "idle")
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const bounded = [...protectedEntries, ...idleEntries].slice(0, MAX_GUARDS);
    bounded.sort((a, b) => a.updatedAt - b.updatedAt);
    return { version: 2, entries: bounded, updatedAt: Math.max(0, finite(raw?.updatedAt, at)) };'''
)

replace_once(
    "coordinator.js",
    '''    let entry = state.entries.find((candidate) => candidate.key === normalizedKey);
    if (!entry) {
      entry = normalizeEntry({ key: normalizedKey }, at);
      state.entries.push(entry);
    }''',
    '''    let entry = state.entries.find((candidate) => candidate.key === normalizedKey);
    if (!entry) {
      if (state.entries.length >= MAX_GUARDS) {
        const idleIndex = state.entries.findIndex((candidate) => candidate.phase === "idle");
        if (idleIndex < 0) {
          return { state, ok: false, reason: "Action guard capacity is occupied by unresolved actions", code: "action.guard_capacity" };
        }
        state.entries.splice(idleIndex, 1);
      }
      entry = normalizeEntry({ key: normalizedKey }, at);
      state.entries.push(entry);
    }'''
)

replace_once(
    "coordinator.js",
    '''    entry.phase = "executing";
    entry.updatedAt = at;
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, alreadyExecuting: false };''',
    '''    const alreadyExecuting = entry.phase === "executing";
    entry.phase = "executing";
    entry.updatedAt = at;
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, alreadyExecuting };'''
)

replace_once(
    "coordinator.js",
    '''  function reset(rawState, key = "", at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedKey = clean(key);
    state.entries = normalizedKey ? state.entries.filter((entry) => entry.key !== normalizedKey) : [];
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }

  return Object.freeze({''',
    '''  function reset(rawState, key = "", at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedKey = clean(key);
    state.entries = normalizedKey ? state.entries.filter((entry) => entry.key !== normalizedKey) : [];
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }

  function resetPrefix(rawState, prefix, at = Date.now()) {
    const state = normalizeState(rawState, at);
    const normalizedPrefix = clean(prefix);
    if (!normalizedPrefix) return { state, ok: false, reason: "Action guard prefix is required", code: "action.guard_invalid" };
    state.entries = state.entries.filter((entry) => !entry.key.startsWith(normalizedPrefix));
    state.updatedAt = at;
    return { state: normalizeState(state, at), ok: true, reset: true };
  }

  return Object.freeze({'''
)

replace_once(
    "coordinator.js",
    '''    complete,
    release,
    reset
  });''',
    '''    complete,
    release,
    reset,
    resetPrefix
  });'''
)

write("tests/coordinator.test.js", read("tests/coordinator.test.js").rstrip() + r'''

test('conversation reset does not clear another conversation guard', () => {
  const state = Coordinator.normalizeState({
    entries: [
      { key: 'page-a::approval', phase: 'unknown', token: 'a', unknownAt: 1000, updatedAt: 1000 },
      { key: 'page-b::approval', phase: 'unknown', token: 'b', unknownAt: 1000, updatedAt: 1000 }
    ]
  }, 2000);
  const reset = Coordinator.resetPrefix(state, 'page-a::', 2100);
  assert.equal(reset.ok, true);
  assert.deepEqual(reset.state.entries.map((entry) => entry.key), ['page-b::approval']);
});

test('capacity never evicts unresolved action outcomes', () => {
  const state = Coordinator.normalizeState({
    entries: Array.from({ length: Coordinator.MAX_GUARDS }, (_, index) => ({
      key: `page-${index}::approval`,
      phase: 'unknown',
      token: `token-${index}`,
      unknownAt: 1000 + index,
      updatedAt: 1000 + index
    }))
  }, 5000);
  const claim = Coordinator.claim(state, 'new-page::approval', 'tab-new', { at: 5001 });
  assert.equal(claim.ok, false);
  assert.equal(claim.code, 'action.guard_capacity');
  assert.equal(claim.state.entries.length, Coordinator.MAX_GUARDS);
  assert.ok(claim.state.entries.every((entry) => entry.phase === 'unknown'));
});
''')

write("tests/reliability-foundation.test.js", read("tests/reliability-foundation.test.js").rstrip() + r'''

test('automatic dedupe identity is stable across cooldown boundaries', () => {
  const content = read('content.js');
  const start = content.indexOf('function actionDedupeKey');
  const end = content.indexOf('async function sendPrompt', start);
  const helper = content.slice(start, end);
  assert.match(helper, /Commands\.fingerprint/);
  assert.doesNotMatch(helper, /Math\.floor|bucketMs/);
});

test('runtime reset is scoped to the current conversation', () => {
  const background = read('background.js');
  assert.match(background, /Coordinator\.resetPrefix\(state, `\$\{pageId\}::`\)/);
  assert.doesNotMatch(background, /Coordinator\.reset\(state, actionKey \? guardKey : ""\)/);
});
''')
