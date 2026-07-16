const test = require("node:test");
const assert = require("node:assert/strict");
const Queue = require("../queue.js");

test("adds, edits, reorders, and removes queued messages", () => {
  let state = Queue.freshState(1000);
  let result = Queue.addItem(state, { text: "one" }, { id: "one", at: 1001 });
  state = result.state;
  result = Queue.addItem(state, { text: "two" }, { id: "two", at: 1002 });
  state = result.state;
  assert.deepEqual(state.items.map((item) => item.id), ["one", "two"]);
  state = Queue.reorderItems(state, ["two", "one"], 1003).state;
  assert.deepEqual(state.items.map((item) => item.id), ["two", "one"]);
  state = Queue.updateItem(state, "two", "updated", 1004).state;
  assert.equal(state.items[0].text, "updated");
  state = Queue.removeItem(state, "one", 1005).state;
  assert.deepEqual(state.items.map((item) => item.id), ["two"]);
});

test("claims and completes exactly one queue item", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "send me" }, { id: "a", at: 1001 }).state;
  const claim = Queue.claimNext(state, "owner", { at: 1100, leaseMs: 5000 });
  assert.equal(claim.ok, true);
  assert.equal(claim.item.state, "sending");
  state = claim.state;
  const second = Queue.claimNext(state, "other", { at: 1101 });
  assert.equal(second.ok, false);
  const completed = Queue.completeClaim(state, "a", claim.item.claimToken, 1200);
  assert.equal(completed.ok, true);
  assert.equal(completed.state.items.length, 0);
  assert.equal(completed.state.lastSentAt, 1200);
});


test("does not grant concurrent claims for one conversation queue", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "one" }, { id: "one", at: 1001 }).state;
  state = Queue.addItem(state, { text: "two" }, { id: "two", at: 1002 }).state;
  const first = Queue.claimNext(state, "owner-a", { at: 1100 });
  const second = Queue.claimNext(first.state, "owner-b", { at: 1101 });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, "queue.busy");
});


test("retry backoff preserves strict pending order", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "first" }, { id: "first", at: 1001 }).state;
  state = Queue.addItem(state, { text: "second" }, { id: "second", at: 1002 }).state;
  state.items[0].nextAttemptAt = 5000;
  const claim = Queue.claimNext(state, "owner", { at: 2000 });
  assert.equal(claim.ok, false);
  assert.equal(claim.code, "queue.waiting");
  assert.equal(claim.nextAttemptAt, 5000);
});

test("reordering keeps a sending item in its fixed slot", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "one" }, { id: "one", at: 1001 }).state;
  state = Queue.addItem(state, { text: "two" }, { id: "two", at: 1002 }).state;
  state = Queue.addItem(state, { text: "three" }, { id: "three", at: 1003 }).state;
  state = Queue.claimNext(state, "owner", { at: 1100 }).state;
  state = Queue.reorderItems(state, ["three", "two"], 1200).state;
  assert.deepEqual(state.items.map((item) => item.id), ["one", "three", "two"]);
  assert.equal(state.items[0].state, "sending");
});

test("expired pre-submit claims return to pending safely", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "send me" }, { id: "a", at: 1001 }).state;
  state = Queue.claimNext(state, "owner", { at: 1100, leaseMs: 5000 }).state;
  const normalized = Queue.normalizeState(state, 7000);
  assert.equal(normalized.items[0].state, "pending");
  assert.equal(normalized.items[0].claimToken, "");
  assert.equal(normalized.items[0].errorCode, "queue.claim_expired");
});

test("expired submitting claims fail closed instead of risking duplicate delivery", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "send once" }, { id: "a", at: 1001 }).state;
  const claim = Queue.claimNext(state, "owner", { at: 1100, leaseMs: 5000 });
  const submitting = Queue.markSubmitting(claim.state, "a", claim.item.claimToken, 1200);
  assert.equal(submitting.ok, true);
  assert.equal(submitting.item.claimPhase, "submitting");
  const normalized = Queue.normalizeState(submitting.state, 7000);
  assert.equal(normalized.items[0].state, "failed");
  assert.equal(normalized.items[0].errorCode, "queue.delivery_unknown");
  assert.match(normalized.items[0].error, /delivery status is unknown/i);
});

test("failures retry with backoff then pause after final failure", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "send me" }, { id: "a", at: 1001 }).state;
  let claim = Queue.claimNext(state, "owner", { at: 1100 });
  let failed = Queue.failClaim(claim.state, "a", claim.item.claimToken, {
    at: 1200,
    maxRetries: 1,
    backoffSec: 30,
    pauseOnFailure: true,
    error: "missing composer"
  });
  assert.equal(failed.state.items[0].state, "pending");
  assert.equal(failed.state.items[0].nextAttemptAt, 31200);
  claim = Queue.claimNext(failed.state, "owner", { at: 31201 });
  failed = Queue.failClaim(claim.state, "a", claim.item.claimToken, {
    at: 31300,
    maxRetries: 1,
    backoffSec: 30,
    pauseOnFailure: true,
    error: "still missing"
  });
  assert.equal(failed.state.items[0].state, "failed");
  assert.equal(failed.state.paused, true);
});

test("retrying a failed item also resumes the queue", () => {
  const raw = {
    paused: true,
    pauseReason: "failure",
    items: [{ id: "a", text: "hello", state: "failed", attempts: 3 }]
  };
  const result = Queue.retryItem(raw, "a", 2000);
  assert.equal(result.state.paused, false);
  assert.equal(result.state.items[0].state, "pending");
});

test("event history is bounded and consecutive duplicates are collapsed", () => {
  let state = Queue.freshState(1000);
  state = Queue.appendEvent(state, { code: "same", message: "same", at: 1001 }, 1001);
  state = Queue.appendEvent(state, { code: "same", message: "same", at: 1002 }, 1002);
  assert.equal(state.events.length, 1);
  for (let index = 0; index < Queue.MAX_EVENTS + 10; index += 1) {
    state = Queue.appendEvent(state, { code: `e${index}`, message: `event ${index}`, at: 2000 + index }, 2000 + index);
  }
  assert.equal(state.events.length, Queue.MAX_EVENTS);
});

test("randomized queue operations preserve structural invariants", () => {
  let seed = 0x5eed1234;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  let state = Queue.freshState(1000);
  let sequence = 0;

  for (let step = 0; step < 1000; step += 1) {
    const at = 2000 + step;
    const operation = Math.floor(random() * 9);
    const item = state.items[Math.floor(random() * Math.max(1, state.items.length))];

    if (operation === 0 && state.items.length < Queue.MAX_ITEMS) {
      sequence += 1;
      state = Queue.addItem(state, { text: `message ${sequence}` }, { id: `item-${sequence}`, at }).state;
    } else if (operation === 1 && item && item.state !== "sending") {
      state = Queue.removeItem(state, item.id, at).state;
    } else if (operation === 2 && item && item.state !== "sending") {
      state = Queue.updateItem(state, item.id, `edited ${step}`, at).state;
    } else if (operation === 3) {
      const ids = state.items.filter((entry) => entry.state !== "sending").map((entry) => entry.id).reverse();
      state = Queue.reorderItems(state, ids, at).state;
    } else if (operation === 4) {
      state = Queue.setPaused(state, random() > 0.5, at).state;
    } else if (operation === 5) {
      const claim = Queue.claimNext(state, "fuzzer", { at, leaseMs: 100 });
      state = claim.state;
    } else if (operation === 6) {
      const sending = state.items.find((entry) => entry.state === "sending");
      if (sending) state = Queue.completeClaim(state, sending.id, sending.claimToken, at).state;
    } else if (operation === 7) {
      const sending = state.items.find((entry) => entry.state === "sending");
      if (sending) state = Queue.releaseClaim(state, sending.id, sending.claimToken, { at }).state;
    } else if (operation === 8 && item?.state === "failed") {
      state = Queue.retryItem(state, item.id, at).state;
    }

    state = Queue.normalizeState(state, at);
    assert.ok(state.items.length <= Queue.MAX_ITEMS);
    assert.equal(new Set(state.items.map((entry) => entry.id)).size, state.items.length);
    assert.ok(state.items.filter((entry) => entry.state === "sending").length <= 1);
    assert.ok(state.items.every((entry) => entry.text.length <= Queue.MAX_TEXT_LENGTH));
    assert.ok(state.events.length <= Queue.MAX_EVENTS);
  }
});

test("queue rejects payloads that exceed bounded text capacity", () => {
  let state = Queue.freshState(1000);
  const chunk = "x".repeat(Queue.MAX_TEXT_LENGTH);
  let index = 0;
  while (state.items.reduce((sum, item) => sum + item.text.length, 0) + chunk.length <= Queue.MAX_QUEUE_TEXT_LENGTH) {
    index += 1;
    const result = Queue.addItem(state, { text: chunk }, { id: `large-${index}`, at: 1000 + index });
    assert.equal(result.ok, true);
    state = result.state;
  }
  const rejected = Queue.addItem(state, { text: chunk }, { id: "too-large", at: 9999 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "queue.capacity");
});

test("normalization deduplicates ids and recovers multiple sender leases", () => {
  const normalized = Queue.normalizeState({
    items: [
      { id: "same", text: "first", state: "sending", claimToken: "one", claimExpiresAt: 5000 },
      { id: "same", text: "duplicate", state: "pending" },
      { id: "other", text: "second sender", state: "sending", claimToken: "two", claimExpiresAt: 5000 }
    ]
  }, 2000);
  assert.deepEqual(normalized.items.map((item) => item.id), ["same", "other"]);
  assert.equal(normalized.items.filter((item) => item.state === "sending").length, 1);
  assert.equal(normalized.items[1].state, "pending");
});

test("queue completion is idempotent after an acknowledgement is lost", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "send once" }, { id: "once", at: 1001 }).state;
  const claim = Queue.claimNext(state, "owner", { at: 1100 });
  const first = Queue.completeClaim(claim.state, "once", claim.item.claimToken, 1200);
  assert.equal(first.ok, true);
  const retried = Queue.completeClaim(first.state, "once", claim.item.claimToken, 1201);
  assert.equal(retried.ok, true);
  assert.equal(retried.alreadyCompleted, true);
  assert.equal(retried.state.items.length, 0);
});


test("ambiguous delivery outcomes fail closed and require manual retry", () => {
  for (const errorCode of ["composer.unconfirmed", "route.changed", "queue.exception"]) {
    let state = Queue.addItem(Queue.freshState(1000), { text: `send once: ${errorCode}` }, { id: errorCode, at: 1001 }).state;
    const claim = Queue.claimNext(state, "owner", { at: 1100 });
    const submitting = Queue.markSubmitting(claim.state, errorCode, claim.item.claimToken, 1150);
    const failed = Queue.failClaim(submitting.state, errorCode, claim.item.claimToken, {
      at: 1200,
      maxRetries: 5,
      backoffSec: 1,
      pauseOnFailure: false,
      error: `ambiguous outcome: ${errorCode}`,
      errorCode,
      deliveryAmbiguous: true
    });

    assert.equal(failed.ok, true);
    assert.equal(failed.state.items[0].state, "failed");
    assert.equal(failed.state.items[0].errorCode, "queue.delivery_unknown");
    assert.equal(failed.state.items[0].nextAttemptAt, 0);
    assert.equal(failed.state.paused, true);
    assert.equal(failed.state.pauseReason, "failure");
    assert.match(failed.state.items[0].error, /manual retry required/i);

    const automaticClaim = Queue.claimNext(failed.state, "other", { at: 5000 });
    assert.equal(automaticClaim.ok, false);
    assert.equal(automaticClaim.code, "queue.paused");

    const retried = Queue.retryItem(failed.state, errorCode, 6000);
    assert.equal(retried.state.paused, false);
    assert.equal(retried.state.items[0].state, "pending");
  }
});

test("proven pre-submit failures retain automatic retry backoff", () => {
  let state = Queue.addItem(Queue.freshState(1000), { text: "retry safely" }, { id: "safe-retry", at: 1001 }).state;
  const claim = Queue.claimNext(state, "owner", { at: 1100 });
  const submitting = Queue.markSubmitting(claim.state, "safe-retry", claim.item.claimToken, 1150);
  const failed = Queue.failClaim(submitting.state, "safe-retry", claim.item.claimToken, {
    at: 1200,
    maxRetries: 2,
    backoffSec: 10,
    pauseOnFailure: true,
    error: "composer not found before submit",
    errorCode: "composer.missing",
    deliveryAmbiguous: false
  });

  assert.equal(failed.state.items[0].state, "pending");
  assert.equal(failed.state.items[0].errorCode, "composer.missing");
  assert.equal(failed.state.items[0].nextAttemptAt, 11200);
  assert.equal(failed.state.paused, false);
});

test("delivery-unknown failures remain a hard block until explicitly resolved", () => {
  const raw = {
    paused: false,
    items: [
      { id: "unknown", text: "possibly sent", state: "failed", errorCode: "queue.delivery_unknown" },
      { id: "later", text: "must wait", state: "pending" }
    ]
  };
  const normalized = Queue.normalizeState(raw, 2000);
  assert.equal(normalized.paused, true);
  assert.equal(normalized.pauseReason, "failure");

  const resumed = Queue.setPaused(normalized, false, 2100);
  assert.equal(resumed.ok, false);
  assert.equal(resumed.code, "queue.delivery_unknown");
  assert.equal(resumed.state.paused, true);
  assert.equal(Queue.claimNext(resumed.state, "owner", { at: 2200 }).code, "queue.paused");

  const retried = Queue.retryItem(resumed.state, "unknown", 2300);
  assert.equal(retried.state.items[0].state, "pending");
  assert.equal(retried.state.paused, false);
});

test("retrying one failed item does not clear a failure pause while another failure remains", () => {
  const raw = {
    paused: true,
    pauseReason: "failure",
    items: [
      { id: "one", text: "one", state: "failed", errorCode: "queue.send_failed" },
      { id: "two", text: "two", state: "failed", errorCode: "queue.send_failed" }
    ]
  };
  const retried = Queue.retryItem(raw, "one", 3000);
  assert.equal(retried.state.items[0].state, "pending");
  assert.equal(retried.state.paused, true);
  assert.equal(retried.state.pauseReason, "failure");
});
