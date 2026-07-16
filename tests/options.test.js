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

test("options page resolves a conversation source and fails closed when none exists", async () => {
  let queried = false;
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
      runtime: { lastError: null, sendMessage() {} },
      tabs: {
        query(_query, callback) { queried = true; callback([]); },
        sendMessage() {}
      },
      scripting: { executeScript() {} }
    },
    YOLOConfig: {
      DEFAULT_SETTINGS: { enabled: false, profile: "balanced" },
      normalizeSettings(value) { return value; },
      applyPreset(value) { return value; }
    }
  };
  context.globalThis = context;
  context.window = { setTimeout, clearTimeout, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "options.js"), "utf8"), context, { filename: "options.js" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queried, true);
  assert.match(getElement("#scope").textContent, /Open a ChatGPT conversation/);
});
