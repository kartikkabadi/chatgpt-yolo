const test = require('node:test');
const assert = require('node:assert/strict');
const Coordinator = require('../coordinator.js');

test('coordinator serializes actions across tabs and renews one owner', () => {
  let state = Coordinator.freshState();
  const first = Coordinator.claim(state, 'page::approval', 'tab-a', { at: 1000, leaseMs: 10000 });
  assert.equal(first.ok, true);
  state = first.state;
  const competing = Coordinator.claim(state, 'page::approval', 'tab-b', { at: 2000, leaseMs: 10000 });
  assert.equal(competing.ok, false);
  assert.equal(competing.code, 'action.busy');
  const renewed = Coordinator.claim(state, 'page::approval', 'tab-a', { at: 3000, leaseMs: 10000 });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.renewed, true);
  assert.equal(renewed.token, first.token);
});

test('executing action expires into unknown and cannot retry automatically', () => {
  let result = Coordinator.claim(null, 'page::approval', 'tab-a', { at: 1000, leaseMs: 5000 });
  const token = result.token;
  result = Coordinator.begin(result.state, 'page::approval', token, 1100);
  assert.equal(result.ok, true);
  const expired = Coordinator.normalizeState(result.state, 7000);
  assert.equal(expired.entries[0].phase, 'unknown');
  const retry = Coordinator.claim(expired, 'page::approval', 'tab-b', { at: 7001 });
  assert.equal(retry.ok, false);
  assert.equal(retry.code, 'action.outcome_unknown');
  const lateCompletion = Coordinator.complete(expired, 'page::approval', token, 7100);
  assert.equal(lateCompletion.ok, true);
});

test('claimed action can expire safely before side effect begins', () => {
  const claim = Coordinator.claim(null, 'page::refresh', 'tab-a', { at: 1000, leaseMs: 5000 });
  const expired = Coordinator.normalizeState(claim.state, 7000);
  const retry = Coordinator.claim(expired, 'page::refresh', 'tab-b', { at: 7001 });
  assert.equal(retry.ok, true);
});

test('completion is idempotent and enforces cooldown', () => {
  const claim = Coordinator.claim(null, 'page::refresh', 'tab-a', { at: 1000 });
  const completed = Coordinator.complete(claim.state, 'page::refresh', claim.token, 1200);
  assert.equal(completed.ok, true);
  const duplicate = Coordinator.complete(completed.state, 'page::refresh', claim.token, 1300);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.alreadyCompleted, true);
  const cooled = Coordinator.claim(completed.state, 'page::refresh', 'tab-b', { at: 2000, cooldownMs: 5000 });
  assert.equal(cooled.ok, false);
  assert.equal(cooled.code, 'action.cooldown');
  const later = Coordinator.claim(completed.state, 'page::refresh', 'tab-b', { at: 6300, cooldownMs: 5000 });
  assert.equal(later.ok, true);
});

test('manual reset clears unknown outcomes', () => {
  let result = Coordinator.claim(null, 'page::approval', 'tab-a', { at: 1000, leaseMs: 5000 });
  result = Coordinator.begin(result.state, 'page::approval', result.token, 1100);
  const unknown = Coordinator.normalizeState(result.state, 7000);
  const reset = Coordinator.reset(unknown, 'page::approval', 7100);
  assert.equal(reset.ok, true);
  assert.equal(reset.state.entries.length, 0);
});

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
