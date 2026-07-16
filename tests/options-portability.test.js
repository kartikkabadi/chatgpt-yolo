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

test("settings controller loads only packaged local portability scripts", () => {
  const source = read("options-ui.js");
  assert.match(source, /loadScript\(doc, win, "portability\.js"\)/);
  assert.match(source, /loadScript\(doc, win, "options-portability\.js"\)/);
  assert.match(source, /chrome\.runtime\.getURL/);
  assert.doesNotMatch(source, /https?:\/\//i);
});

test("portability UI builds explicit controls and delegates persistence to background", () => {
  const source = read("options-portability.js");
  for (const id of ["exportBackup", "importBackup", "importBackupFile", "copyDiagnostics", "dataPortabilityStatus"]) {
    assert.match(source, new RegExp(id));
  }
  assert.match(source, /YOLODATA_EXPORT/);
  assert.match(source, /YOLODATA_IMPORT_PREVIEW/);
  assert.match(source, /YOLODATA_IMPORT_APPLY/);
  assert.match(source, /YOLO_QUEUE_GET/);
  assert.doesNotMatch(source, /chrome\.storage/);
  assert.doesNotMatch(source, /queueState\.items.*text/);
});

test("data controls are progressively added to the existing maintenance section", () => {
  const source = read("options-portability.js");
  assert.match(source, /querySelector\("#data"\)/);
  assert.match(source, /insertBefore\(card, danger \|\| null\)/);
  assert.match(source, /backup export import diagnostics privacy/);
});
