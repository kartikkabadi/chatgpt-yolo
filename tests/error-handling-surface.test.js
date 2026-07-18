const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const contentSrc = fs.readFileSync(path.join(root, "content.js"), "utf8");
const optionsSrc = fs.readFileSync(path.join(root, "options.js"), "utf8");
const runtimeSrc = fs.readFileSync(path.join(root, "command-runtime.js"), "utf8");

function sliceBetween(source, startMarker, endMarker) {
  const afterStart = source.indexOf(startMarker) + startMarker.length;
  assert.ok(source.indexOf(startMarker) !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, afterStart);
  assert.notEqual(end, -1, `end marker not found after ${startMarker}`);
  return source.slice(afterStart, end);
}

test("YOLO_GET_STATE handler logs failures before resolving null", () => {
  const handler = sliceBetween(contentSrc, 'if (message?.type === "YOLO_GET_STATE") {', 'if (message?.type === "YOLO_SET_SETTINGS"');
  assert.match(handler, /\.catch\(\(error\) => \{[\s\S]*console\.error\(`YOLO_GET_STATE failed: \$\{Shared\.errorMessage\(error\)\}`\);[\s\S]*sendResponse\(null\);[\s\S]*\}\)/);
  assert.doesNotMatch(handler, /\.catch\(\(\) => \{[\s\S]*sendResponse\(null\);\s*\}\)/);
});

test("flushScheduledSave logs lock failures and surfaces them in the status", () => {
  const fn = sliceBetween(optionsSrc, "async function flushScheduledSave() {", "\n  function setTemplateStatus");
  assert.match(fn, /saveLock\.current\.catch\(\(error\) => \{[\s\S]*console\.error\(`Flush scheduled save failed: \$\{Shared\.errorMessage\(error\)\}`\);[\s\S]*els\.saveStatus\.textContent = "Save failed";[\s\S]*\}\)/);
});

test("workflow poll record failure is logged and polling continues", () => {
  const fn = sliceBetween(runtimeSrc, "state.pollTimer = window.setTimeout(async () => {", "}, delay);");
  assert.match(fn, /await record\(`Workflow poll failed: \$\{Shared\.errorMessage\(error\)\}`/);
  assert.match(fn, /\.catch\(\(recordError\) => \{[\s\S]*console\.error\(`Workflow poll status record failed: \$\{Shared\.errorMessage\(recordError\)\}`\);[\s\S]*\}\)/);
  assert.match(fn, /schedulePoll\(\);/);
});
