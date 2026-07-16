const test = require("node:test");
const assert = require("node:assert/strict");
const Lifecycle = require("../lifecycle.js");

test("hidden tabs back off scans and workflow polling", () => {
  assert.equal(Lifecycle.scanDelay({ hidden: false, configuredSec: 3 }), 3000);
  assert.equal(Lifecycle.scanDelay({ hidden: true, generating: false, configuredSec: 3 }), 5000);
  assert.equal(Lifecycle.scanDelay({ hidden: true, generating: true, configuredSec: 3 }), 10000);
  assert.equal(Lifecycle.workflowPollDelay({ hidden: false, workflowActive: true }), 750);
  assert.equal(Lifecycle.workflowPollDelay({ hidden: true, workflowActive: true }), 5000);
  assert.equal(Lifecycle.workflowPollDelay({ hidden: true, workflowActive: false }), 15000);
});

test("hydration waits for a real composer and a quiet DOM", () => {
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "loading", composerPresent: true, lastDomActivityAt: 0, now: 5000 }), false);
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "complete", composerPresent: false, lastDomActivityAt: 0, now: 5000 }), false);
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "complete", composerPresent: true, lastDomActivityAt: 4500, now: 5000 }), false);
  assert.equal(Lifecycle.hydrationCandidate({ documentReadyState: "complete", composerPresent: true, lastDomActivityAt: 3000, now: 5000 }), true);
});

test("missing workflow markers require a long quiet window", () => {
  assert.equal(Lifecycle.responseStableMs("continue"), 15000);
  assert.equal(Lifecycle.responseStableMs("done"), 15000);
  assert.equal(Lifecycle.responseStableMs("missing"), 3 * 60 * 60 * 1000);
});

test("scheduled refresh fails closed around work and recent activity", () => {
  const base = { hydrated: true, workflowActive: false, generating: false, composerBusy: false, lastDomActivityAt: 0, now: 120000 };
  assert.equal(Lifecycle.canAutomaticRefresh(base), true);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, workflowActive: true }), false);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, generating: true }), false);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, composerBusy: true }), false);
  assert.equal(Lifecycle.canAutomaticRefresh({ ...base, lastDomActivityAt: 90000 }), false);
});

test("only explicitly enabled running workflows are protected from discard", () => {
  assert.equal(Lifecycle.shouldProtectTab({ enabled: true, workflowStatus: "running" }), true);
  assert.equal(Lifecycle.shouldProtectTab({ enabled: false, workflowStatus: "running" }), false);
  assert.equal(Lifecycle.shouldProtectTab({ enabled: true, workflowStatus: "completed" }), false);
});
