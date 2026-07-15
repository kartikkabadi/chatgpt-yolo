const test = require("node:test");
const assert = require("node:assert/strict");
const Config = require("../config.js");

test("normalizes and clamps settings with interval invariants", () => {
  const settings = Config.normalizeSettings({
    queueIntervalMinSec: 50,
    queueIntervalMaxSec: 2,
    approvalDelayMinSec: -10,
    scanIntervalSec: 500,
    queueMaxRetries: "2.6"
  });
  assert.equal(settings.queueIntervalMinSec, 50);
  assert.equal(settings.queueIntervalMaxSec, 50);
  assert.equal(settings.approvalDelayMinSec, 0);
  assert.equal(settings.scanIntervalSec, 60);
  assert.equal(settings.queueMaxRetries, 3);
});

test("migrates legacy boolean setting names", () => {
  const settings = Config.normalizeSettings({ approvals: false, errorContinue: false, deepNudges: true, autoRefresh: true });
  assert.equal(settings.approvalsEnabled, false);
  assert.equal(settings.errorRecoveryEnabled, false);
  assert.equal(settings.deepNudgesEnabled, true);
  assert.equal(settings.autoRefreshEnabled, true);
});

test("normalizes conversation URLs into stable page IDs", () => {
  assert.equal(Config.pageId("https://chatgpt.com/c/abc?temporary-chat=true#bottom"), "https://chatgpt.com/c/abc");
  assert.equal(Config.pageId("https://grok.com/"), "https://grok.com/");
});

test("enforces hourly and session action limits with reason codes", () => {
  const at = 10_000_000;
  const hourAgo = at - Config.HOUR_MS;
  const hourly = Config.limitStatus([hourAgo + 1, at - 100], 2, 2, 10, at);
  assert.equal(hourly.allowed, false);
  assert.equal(hourly.code, "limit.hourly");
  const session = Config.limitStatus([], 10, 3, 3, at);
  assert.equal(session.code, "limit.session");
});

test("applies named profiles without changing the conversation master switch", () => {
  const safe = Config.applyPreset({ ...Config.DEFAULT_SETTINGS, enabled: true }, "safe");
  assert.equal(safe.enabled, true);
  assert.equal(safe.profile, "safe");
  assert.equal(safe.approvalPolicy, "safe");
  assert.equal(safe.queueIntervalMinSec, 45);
});

test("renders supported template variables", () => {
  const rendered = Config.renderTemplate("{{platform}} on {{date}} at {{time}}", {
    platform: "ChatGPT",
    date: new Date("2026-07-15T10:30:00Z")
  });
  assert.match(rendered, /^ChatGPT on /);
  assert.doesNotMatch(rendered, /\{\{/);
});

test("uses collision-resistant per-conversation storage keys", () => {
  const first = Config.pageSettingsKey("https://chatgpt.com/c/one");
  const second = Config.pageSettingsKey("https://chatgpt.com/c/two");
  assert.notEqual(first, second);
  assert.match(first, /^yoloPage:/);
  assert.match(Config.lastActionKey("https://grok.com/c/one"), /^yoloLastAction:/);
});
