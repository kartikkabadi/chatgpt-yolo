const test = require("node:test");
const assert = require("node:assert/strict");
const UI = require("../options-ui.js");

test("normalizes settings search terms", () => {
  assert.equal(UI.normalizeSearch("  Queue   LIMIT  "), "queue limit");
  assert.equal(UI.normalizeSearch(null), "");
});

test("matches every search token across metadata and visible copy", () => {
  assert.equal(UI.sectionMatches("queue retry delivery", "Automatic retries", "queue retry"), true);
  assert.equal(UI.sectionMatches("github approvals", "Safe permissions", "safe github"), true);
  assert.equal(UI.sectionMatches("queue", "Hourly limit", "queue destructive"), false);
  assert.equal(UI.sectionMatches("anything", "anything", ""), true);
});

test("maps save messages to explicit visual states", () => {
  assert.equal(UI.saveStateFor("Loading…"), "loading");
  assert.equal(UI.saveStateFor("Saving…"), "saving");
  assert.equal(UI.saveStateFor("Saved"), "saved");
  assert.equal(UI.saveStateFor("Session history reset"), "saved");
  assert.equal(UI.saveStateFor("Could not save settings."), "error");
  assert.equal(UI.saveStateFor("No conversation selected"), "limited");
});
