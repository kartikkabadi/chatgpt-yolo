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
  assert.match(source, /previewToken: preview\.previewToken/);
  assert.match(source, /YOLO_QUEUE_GET/);
  assert.match(source, /YOLO_APPLY_IMPORTED_SETTINGS/);
  assert.doesNotMatch(source, /chrome\.storage/);
  assert.doesNotMatch(source, /queueState\.items.*text/);
});

test("data controls mount once and update settings search", () => {
  const source = read("options-portability.js");
  assert.match(source, /document\.querySelector\("#exportBackup"\)/);
  assert.match(source, /querySelector\("#data"\)/);
  assert.match(source, /insertBefore\(card, danger \|\| null\)/);
  assert.match(source, /backup export import diagnostics privacy/);
  assert.match(source, /dispatchEvent\(new SearchEvent\("input"/);
  assert.match(source, /YOLOOptionsPortability = api/);
});

test("failed current-tab synchronization is reported without undoing a completed import", () => {
  const source = read("options-portability.js");
  assert.match(source, /Backup imported\. Refresh the ChatGPT tab/);
  assert.match(source, /level === "warning"/);
});

test("imports lock and flush settings then synchronize without persisting", () => {
  const portability = read("options-portability.js");
  const options = read("options.js");
  const content = read("content.js");
  assert.match(portability, /beginExternalMutation/);
  assert.match(portability, /if \(!applied\) await setBusy\(false\)/);
  assert.match(portability, /YOLO_APPLY_IMPORTED_SETTINGS/);
  assert.doesNotMatch(portability, /type: "YOLO_SET_SETTINGS"/);
  assert.match(options, /setBusy\(true\);[\s\S]*await flushScheduledSave\(\)/);
  const start = content.indexOf('message?.type === "YOLO_APPLY_IMPORTED_SETTINGS"');
  const end = content.indexOf('message?.type === "YOLO_RUN_ACTION"', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(content.slice(start, end), /persistSettings|storageSet/);
});

test("portability follows the conversation resolved by the main settings controller", () => {
  const portability = read("options-portability.js");
  const options = read("options.js");
  assert.match(options, /getContext\(\)[\s\S]*sourceTabId[\s\S]*contentState\?\.pageId/);
  assert.match(portability, /YOLOOptionsController\?\.getContext\?\.\(\)/);
  assert.match(portability, /const \{ sourceTabId \} = currentContext\(\)/);
  assert.match(portability, /const \{ sourceTabId, pageId \} = currentContext\(\)/);
  assert.match(portability, /const \{ pageId \} = currentContext\(\)/);
});
