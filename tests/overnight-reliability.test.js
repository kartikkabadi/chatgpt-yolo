const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("the tab supervisor is alarm-driven, staggered, and never force reloads or activates tabs", () => {
  const source = read("tab-supervisor.js");
  assert.match(source, /periodInMinutes: 1/);
  assert.match(source, /MAX_INJECTIONS_PER_SWEEP = 2/);
  assert.match(source, /tab\.discarded/);
  assert.match(source, /tab\.frozen/);
  assert.match(source, /tab\.status !== "loading"/);
  assert.doesNotMatch(source, /tabs\.reload|location\.reload|tabs\.discard|active: true/);
});

test("active workflow protection is explicit and returns idle tabs to Memory Saver", () => {
  const source = read("tab-supervisor.js");
  assert.match(source, /protectActiveWorkflowTabs/);
  assert.match(source, /autoDiscardable: desiredAutoDiscardable/);
  const options = read("options.html");
  assert.match(options, /data-setting="protectActiveWorkflowTabs"/);
  assert.match(options, /Memory Saver/);
});

test("content and command runtimes use adaptive one-shot timers instead of hot intervals", () => {
  const content = read("content.js");
  const runtime = read("command-runtime.js");
  assert.match(content, /Lifecycle\.scanDelay/);
  assert.match(content, /Lifecycle\.mutationDelay/);
  assert.match(content, /Lifecycle\.routeDelay/);
  assert.doesNotMatch(content, /setInterval\(runCycle|setInterval\(handleRouteChange/);
  assert.match(runtime, /Lifecycle\.workflowPollDelay/);
  assert.doesNotMatch(runtime, /setInterval\(tick/);
});

test("long turns cannot be refreshed or interpreted before hydration and quiet completion", () => {
  const content = read("content.js");
  const runtime = read("command-runtime.js");
  assert.match(content, /probeHydration/);
  assert.match(content, /Lifecycle\.canAutomaticRefresh/);
  assert.match(content, /workflowActive: workflow\.active/);
  assert.match(runtime, /if \(!apiState\.hydrated\) return false/);
  assert.match(runtime, /Lifecycle\.responseStableMs\(outcome\)/);
  assert.match(runtime, /apiState\.lastDomActivityAt/);
});

test("background supervision adds only the narrow alarms permission", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.deepEqual(manifest.permissions, ["alarms", "scripting", "storage"]);
  assert.equal(manifest.permissions.includes("tabs"), false);
  assert.equal(manifest.permissions.includes("activeTab"), false);
});
