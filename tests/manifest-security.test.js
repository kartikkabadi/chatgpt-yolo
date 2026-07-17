const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

test("extension pages use a strict local-only CSP", () => {
  const policy = manifest.content_security_policy?.extension_pages || "";
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'none'/);
  assert.doesNotMatch(policy, /https?:|unsafe-inline|unsafe-eval|wasm-unsafe-eval/);
});

test("manifest permissions and hosts remain narrowly scoped", () => {
  assert.deepEqual([...manifest.permissions].sort(), ["alarms", "scripting", "storage"]);
  assert.deepEqual([...manifest.host_permissions].sort(), ["https://*.chatgpt.com/*", "https://chatgpt.com/*"]);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.equal(manifest.externally_connectable, undefined);
});
