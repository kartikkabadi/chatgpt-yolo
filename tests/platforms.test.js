const test = require("node:test");
const assert = require("node:assert/strict");
const Platforms = require("../platforms.js");

test("selects platform adapters only for supported hosts", () => {
  assert.equal(Platforms.adapterForLocation({ hostname: "chatgpt.com" }).id, "chatgpt");
  assert.equal(Platforms.adapterForLocation({ hostname: "www.grok.com" }).id, "grok");
  assert.equal(Platforms.adapterForLocation({ hostname: "example.com" }), null);
});

test("safe approval policy blocks destructive card context", () => {
  assert.equal(Platforms.approvalVerbAllowed("Confirm", "safe", "Delete the branch on GitHub"), false);
  assert.equal(Platforms.approvalVerbAllowed("Allow", "safe", "Reset repository state"), false);
});

test("writes policy still blocks destructive actions", () => {
  assert.equal(Platforms.approvalVerbAllowed("Force push", "writes", "Update the GitHub branch"), false);
  assert.equal(Platforms.approvalVerbAllowed("Confirm", "writes", "Merge pull request"), false);
});

test("writes and all policies allow their intended risk levels", () => {
  assert.equal(Platforms.approvalVerbAllowed("Create", "writes", "Create a GitHub branch"), true);
  assert.equal(Platforms.approvalVerbAllowed("Confirm", "all", "Delete the GitHub branch"), true);
  assert.equal(Platforms.approvalVerbAllowed("Run", "safe", "Run GitHub workflow checks"), true);
});
