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
    addEventListener() {},
    closest() { return null; },
    matches() { return false; }
  };
}

test("popup starts initialization when its script loads", async () => {
  let queried = false;
  const elements = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };

  const context = {
    console,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: {
      activeElement: null,
      visibilityState: "visible",
      querySelectorAll() { return []; },
      querySelector(selector) { return getElement(selector); }
    },
    chrome: {
      runtime: { lastError: null },
      tabs: {
        query(_query, callback) {
          queried = true;
          callback([{ id: 1, url: "https://example.com/" }]);
        },
        sendMessage() {}
      },
      scripting: { executeScript() {} }
    },
    YOLOConfig: {
      VERSION: "test",
      DEFAULT_SETTINGS: { enabled: false },
      normalizeSettings(value) { return value; },
      isSupportedUrl() { return false; },
      formatDuration() { return "now"; }
    }
  };
  context.globalThis = context;
  context.window = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener() {}
  };

  const source = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");
  vm.runInNewContext(source, context, { filename: "popup.js" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(queried, true);
  assert.equal(getElement("#status").textContent, "Unavailable");
});
