const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Platforms = require("../platforms.js");

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "approval-cards.json"), "utf8"));

function createFixtureDocument(fixture) {
  const view = { getComputedStyle: () => ({ visibility: "visible", display: "block", opacity: "1" }) };
  const ownerDocument = { defaultView: view };
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const attrs = (values = {}) => ({ getAttribute(name) { return values[name] || null; } });
  const card = {
    nodeType: 1,
    ownerDocument,
    textContent: fixture.text,
    parentElement: null,
    getBoundingClientRect: () => rect(0, 0, 500, 160),
    querySelectorAll(selector) { return selector === "button" ? [negative, positive] : []; }
  };
  const negative = {
    nodeType: 1,
    ownerDocument,
    parentElement: card,
    textContent: fixture.negative,
    disabled: false,
    isConnected: true,
    getBoundingClientRect: () => rect(20, 110, 90, 32),
    ...attrs()
  };
  const positive = {
    nodeType: 1,
    ownerDocument,
    parentElement: card,
    textContent: fixture.positive,
    disabled: false,
    isConnected: true,
    getBoundingClientRect: () => rect(130, 110, 100, 32),
    ...attrs()
  };
  return {
    querySelectorAll(selector) { return selector === "button" ? [negative, positive] : []; }
  };
}

test("selects platform adapters only for supported hosts", () => {
  assert.equal(Platforms.adapterForLocation({ hostname: "chatgpt.com" }).id, "chatgpt");
  assert.equal(Platforms.adapterForLocation({ hostname: "www.grok.com" }), null);
  assert.equal(Platforms.adapterForLocation({ hostname: "example.com" }), null);
});

test("fixture-based approval detection respects every risk policy", () => {
  for (const fixture of fixtures) {
    const documentLike = createFixtureDocument(fixture);
    for (const policy of ["safe", "writes", "all"]) {
      const found = Platforms.findApprovalCards(Platforms.ADAPTERS.chatgpt, policy, documentLike);
      assert.equal(found.length, fixture.expected[policy], `${fixture.name} under ${policy}`);
    }
  }
});

test("generic safe button labels cannot hide destructive context", () => {
  assert.equal(Platforms.approvalVerbAllowed("Confirm", "safe", "Delete the GitHub branch"), false);
  assert.equal(Platforms.approvalVerbAllowed("Confirm", "writes", "Merge pull request"), false);
  assert.equal(Platforms.approvalVerbAllowed("Confirm", "all", "Delete the GitHub branch"), true);
});

test("submission observation requires a cleared composer or active generation", () => {
  const view = { getComputedStyle: () => ({ visibility: "visible", display: "block", opacity: "1" }) };
  const rect = { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 };
  const composer = {
    nodeType: 1,
    tagName: "TEXTAREA",
    value: "still present",
    disabled: false,
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => rect,
    getAttribute: () => null
  };
  const stop = {
    nodeType: 1,
    disabled: false,
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => rect,
    getAttribute: () => null
  };
  const adapter = { composerSelectors: ["composer"], generationSelectors: ["stop"] };
  const documentLike = {
    querySelectorAll(selector) {
      if (selector === "composer") return [composer];
      if (selector === "stop") return [];
      if (selector === "button") return [];
      return [];
    }
  };

  assert.equal(Platforms.submissionObserved(adapter, documentLike), false);
  composer.value = "";
  assert.equal(Platforms.submissionObserved(adapter, documentLike), true);
  composer.value = "still present";
  documentLike.querySelectorAll = (selector) => selector === "composer" ? [composer] : selector === "stop" ? [stop] : [];
  assert.equal(Platforms.submissionObserved(adapter, documentLike), true);
});

test("a missing composer is not treated as delivery confirmation", () => {
  const adapter = { composerSelectors: ["composer"], generationSelectors: ["stop"] };
  const documentLike = { querySelectorAll() { return []; } };
  assert.equal(Platforms.submissionObserved(adapter, documentLike), false);
});

test("reads the latest ChatGPT assistant response for workflow markers", () => {
  const first = { textContent: "first response" };
  const second = { textContent: "latest response\n[YOLO:CONTINUE]" };
  const documentLike = {
    querySelectorAll(selector) {
      return selector === "assistant" ? [first, second] : [];
    }
  };
  const adapter = { assistantSelectors: ["assistant"] };
  assert.equal(Platforms.latestAssistantText(adapter, documentLike), "latest response\n[YOLO:CONTINUE]");
});

test("reads the latest ChatGPT user prompt for workflow ownership", () => {
  const first = { textContent: "manual prompt" };
  const second = { textContent: "workflow prompt" };
  const documentLike = {
    querySelectorAll(selector) {
      return selector === "user" ? [first, second] : [];
    }
  };
  assert.equal(Platforms.latestUserText({ userSelectors: ["user"] }, documentLike), "workflow prompt");
});
