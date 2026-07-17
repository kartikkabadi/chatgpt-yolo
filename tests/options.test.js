const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function element() {
  return {
    textContent: "", value: "", checked: false, disabled: false, hidden: false, dataset: {}, style: {},
    addEventListener() {}, append() {}, replaceChildren() {}, querySelectorAll() { return []; },
    matches() { return false; }, focus() {}, scrollIntoView() {}
  };
}

function runOptions({ tabs = [], states = {} } = {}) {
  let queried = false;
  let templatesRequested = false;
  const elements = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const context = {
    console, Date, Promise, URLSearchParams, setTimeout, clearTimeout,
    location: { search: "" },
    document: {
      activeElement: null,
      querySelectorAll() { return []; },
      querySelector(selector) { return getElement(selector); },
      getElementById() { return null; },
      createElement() { return element(); }
    },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          if (message?.type === "YOLO_TEMPLATES_GET") templatesRequested = true;
          callback?.({ ok: true, templates: [] });
        }
      },
      tabs: {
        query(_query, callback) { queried = true; callback(tabs); },
        sendMessage(tabId, message, callback) {
          callback?.(message?.type === "YOLO_GET_STATE" ? states[tabId] || null : null);
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
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "options.js"), "utf8"), context, { filename: "options.js" });
  return {
    queried: () => queried,
    templatesRequested: () => templatesRequested,
    getElement
  };
}

test("options page fails closed when no saved conversation exists", async () => {
  const harness = runOptions();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.queried(), true);
  assert.equal(harness.templatesRequested(), true);
  assert.match(harness.getElement("#scope").textContent, /Open a saved ChatGPT conversation/);
  assert.match(harness.getElement("#saveStatus").textContent, /No saved conversation selected/);
});

test("options skips transient chats and selects the most recent durable conversation", async () => {
  const harness = runOptions({
    tabs: [
      { id: 1, lastAccessed: 200 },
      { id: 2, lastAccessed: 100 }
    ],
    states: {
      1: { pageId: "https://chatgpt.com/", platform: "ChatGPT", settings: { enabled: false, profile: "balanced" } },
      2: { pageId: "https://chatgpt.com/c/saved", platform: "ChatGPT", settings: { enabled: true, profile: "safe" } }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.templatesRequested(), true);
  assert.equal(harness.getElement("#scope").textContent, "ChatGPT · https://chatgpt.com/c/saved");
  assert.equal(harness.getElement("#saveStatus").textContent, "Saved");
});
