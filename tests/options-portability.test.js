const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const UI = require("../options-portability.js");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("import confirmation is explicit about scope and exclusions", () => {
  const message = UI.importConfirmation({ conversations: 2, templates: 3 });
  assert.match(message, /2 conversation settings/);
  assert.match(message, /3 templates/);
  assert.match(message, /Active queues and goals will not be changed/);
});

test("Advanced settings wires export, import, diagnostics, and local scripts", () => {
  const html = read("options.html");
  for (const id of ["exportBackup", "importBackup", "importBackupFile", "copyDiagnostics", "dataPortabilityStatus"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<script src="portability\.js"><\/script>/);
  assert.match(html, /<script src="options-portability\.js"><\/script>/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("portability UI delegates persistence to background messages", () => {
  const source = read("options-portability.js");
  assert.match(source, /YOLO_DATA_EXPORT/);
  assert.match(source, /YOLO_DATA_IMPORT_PREVIEW/);
  assert.match(source, /YOLO_DATA_IMPORT_APPLY/);
  assert.match(source, /YOLO_QUEUE_GET/);
  assert.doesNotMatch(source, /chrome\.storage/);
  assert.doesNotMatch(source, /queueState\.items.*text/);
});
