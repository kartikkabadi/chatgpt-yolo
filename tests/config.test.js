const test = require("node:test");
const assert = require("node:assert/strict");
const Config = require("../config.js");

test("normalizes and clamps numeric settings", () => {
  const settings = Config.normalizeSettings({
    approvalDelayMinSec: -10,
    approvalDelayMaxSec: 1,
    scanIntervalSec: 500,
    maxActionsPerSession: "12.6"
  });

  assert.equal(settings.approvalDelayMinSec, 0);
  assert.equal(settings.approvalDelayMaxSec, 1);
  assert.equal(settings.scanIntervalSec, 60);
  assert.equal(settings.maxActionsPerSession, 13);
});

test("keeps max intervals greater than or equal to min intervals", () => {
  const settings = Config.normalizeSettings({
    errorDelayMinSec: 25,
    errorDelayMaxSec: 2,
    refreshIntervalMinMin: 30,
    refreshIntervalMaxMin: 5
  });

  assert.equal(settings.errorDelayMaxSec, 25);
  assert.equal(settings.refreshIntervalMaxMin, 30);
});

test("migrates legacy boolean setting names", () => {
  const settings = Config.normalizeSettings({
    approvals: false,
    errorContinue: false,
    deepNudges: true,
    autoRefresh: true
  });

  assert.equal(settings.approvalsEnabled, false);
  assert.equal(settings.errorRecoveryEnabled, false);
  assert.equal(settings.deepNudgesEnabled, true);
  assert.equal(settings.autoRefreshEnabled, true);

  const merged = Config.mergeSettings(Config.DEFAULT_SETTINGS, { approvals: false, deepNudges: true });
  assert.equal(merged.approvalsEnabled, false);
  assert.equal(merged.deepNudgesEnabled, true);
});

test("normalizes conversation URLs into stable page IDs", () => {
  assert.equal(
    Config.pageId("https://chatgpt.com/c/abc123?temporary-chat=true#bottom"),
    "https://chatgpt.com/c/abc123"
  );
  assert.equal(Config.pageId("https://grok.com/"), "https://grok.com/");
});

test("enforces hourly and session action limits", () => {
  const at = 10_000_000;
  const hourAgo = at - Config.HOUR_MS;
  const hourly = Config.limitStatus([hourAgo + 1, at - 100], 2, 2, 10, at);
  assert.equal(hourly.allowed, false);
  assert.equal(hourly.reason, "Hourly action limit reached");

  const session = Config.limitStatus([], 10, 3, 3, at);
  assert.equal(session.allowed, false);
  assert.equal(session.reason, "Session action limit reached");

  const allowed = Config.limitStatus([hourAgo - 1], 2, 1, 3, at);
  assert.equal(allowed.allowed, true);
  assert.deepEqual(allowed.recent, []);
});
