const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function element() {
  return {
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    hidden: false,
    dataset: {},
    className: "",
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    children: [],
    addEventListener() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20, right: 100, bottom: 20 }; },
    focus() {},
    setAttribute() {}
  };
}

test("popup keeps settings and templates reachable on unsupported pages", async () => {
  let queried = false;
  const elements = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const context = {
    console, Date, Promise, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval,
    Option: function Option(text, value) { return { text, value }; },
    document: {
      querySelector(selector) { return getElement(selector); },
      createElement() { return element(); }
    },
    chrome: {
      runtime: { lastError: null, sendMessage() {}, getURL(value) { return value; } },
      tabs: {
        query(_query, callback) { queried = true; callback([{ id: 1, url: "https://example.com/" }]); },
        sendMessage() {},
        create() {}
      },
      scripting: { executeScript() {} }
    },
    YOLOConfig: {
      VERSION: "test",
      DEFAULT_SETTINGS: { enabled: false, profile: "balanced" },
      isSupportedUrl() { return false; },
      formatDuration() { return "now"; },
      applyPreset(value) { return value; },
      renderTemplate(value) { return value; }
    }
  };
  context.globalThis = context;
  context.window = { setTimeout, clearTimeout, setInterval, clearInterval, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "shared.js"), "utf8"), context, { filename: "shared.js" });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8"), context, { filename: "popup.js" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queried, true);
  assert.equal(getElement("#status").textContent, "Unavailable");
  assert.match(getElement("#scope").textContent, /Settings and templates remain available/);
  assert.equal(getElement("#message").disabled, true);
  assert.equal(getElement("#advanced").disabled, false);
  assert.equal(getElement("#manageTemplates").disabled, false);
});
