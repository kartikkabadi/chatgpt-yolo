const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

test("flushScheduledSave surfaces saveSettings failures in the status", () => {
  const fn = sliceBetween(optionsSrc, "async function flushScheduledSave() {", "\n  function setTemplateStatus");
  assert.match(fn, /await saveSettings\(\)\.catch\(\(error\) => \{[\s\S]*console\.error\(\`\[YOLO options\] settings save failed: \$\{Shared\.errorMessage\(error\)\}\`\);[\s\S]*els\.saveStatus\.textContent = "Save failed";[\s\S]*\}\)/);
  assert.match(fn, /await saveLock\.current\.catch\(\(\) => \{\}\);/);
});

function element() {
  const listeners = new Map();
  return {
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    dataset: {},
    style: {},
    children: [],
    className: "",
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    querySelectorAll() { return []; },
    matches() { return false; },
    focus() {},
    scrollIntoView() {},
    setAttribute() {},
    getAttribute() { return null; }
  };
}

function runFailingSave() {
  const consoleErrors = [];
  const elements = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };

  const enabledControl = element();
  enabledControl.dataset.setting = "enabled";
  enabledControl.dataset.kind = "boolean";
  enabledControl.checked = true;

  const context = {
    console: {
      ...console,
      error(...args) { consoleErrors.push(args.join(" ")); }
    },
    Date, Promise, URLSearchParams, setTimeout, clearTimeout,
    crypto: { randomUUID: () => "test-uuid" },
    location: { search: "" },
    document: {
      activeElement: null,
      querySelectorAll(selector) { return selector === "[data-setting]" ? [enabledControl] : []; },
      querySelector(selector) { return getElement(selector); },
      getElementById() { return null; },
      createElement() { return element(); }
    },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(_message, callback) {
          callback?.({ ok: true, templates: [] });
        }
      },
      tabs: {
        query(_query, callback) { callback([{ id: 1, lastAccessed: 1 }]); },
        sendMessage(_tabId, message, callback) {
          if (message?.type === "YOLO_SET_SETTINGS") {
            throw new Error("sendContentWithInject rejection");
          }
          callback?.(message?.type === "YOLO_GET_STATE"
            ? { pageId: "https://chatgpt.com/c/fail", platform: "ChatGPT", settings: { enabled: false, profile: "balanced" } }
            : { ok: true });
        }
      },
      scripting: { executeScript() {} }
    },
    YOLOConfig: {
      DEFAULT_SETTINGS: { enabled: false, profile: "balanced" },
      normalizeSettings(value) { return value; },
      applyPreset(value) { return value; },
      isDurablePageId(value) { return /^https:\/\/chatgpt\.com\/c\/[^/]+$/.test(String(value || "")); }
    }
  };
  context.globalThis = context;
  context.window = { setTimeout, clearTimeout, addEventListener() {} };

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared.js"), "utf8"), context, { filename: "shared.js" });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "options.js"), "utf8"), context, { filename: "options.js" });

  return {
    context,
    consoleErrors,
    enabledControl,
    saveStatusText: () => getElement("#saveStatus").textContent
  };
}

test("flushScheduledSave surfaces direct saveSettings failures in UI and console", async () => {
  const harness = runFailingSave();
  await new Promise((resolve) => setImmediate(resolve));
  harness.enabledControl.dispatchEvent({ type: "change", target: harness.enabledControl });
  await harness.context.globalThis.YOLOOptionsController.beginExternalMutation();
  assert.ok(
    harness.consoleErrors.some((msg) => msg.includes("settings save failed")),
    `expected console.error to include "settings save failed", got ${JSON.stringify(harness.consoleErrors)}`
  );
  assert.equal(harness.saveStatusText(), "Save failed");
});

test("workflow poll record failure is logged and polling continues", () => {
  const fn = sliceBetween(runtimeSrc, "state.pollTimer = window.setTimeout(async () => {", "}, delay);");
  assert.match(fn, /await record\(`Workflow poll failed: \$\{Shared\.errorMessage\(error\)\}`/);
  assert.match(fn, /\.catch\(\(recordError\) => \{[\s\S]*console\.error\(`Workflow poll status record failed: \$\{Shared\.errorMessage\(recordError\)\}`\);[\s\S]*\}\)/);
  assert.match(fn, /schedulePoll\(\);/);
});
