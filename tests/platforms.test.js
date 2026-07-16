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

test("submission observation requires a new matching user message", () => {
  const messages = [{ textContent: "same prompt" }];
  const adapter = { userSelectors: ["user"] };
  const documentLike = { querySelectorAll(selector) { return selector === "user" ? messages : []; } };
  const previousSnapshot = Platforms.userMessageSnapshot(adapter, documentLike);

  assert.equal(Platforms.submissionObserved(adapter, { expectedText: "same prompt", previousSnapshot }, documentLike), false);
  messages.push({ textContent: "same prompt" });
  assert.equal(Platforms.submissionObserved(adapter, { expectedText: "same prompt", previousSnapshot }, documentLike), true);
  messages.push({ textContent: "different prompt" });
  assert.equal(Platforms.submissionObserved(adapter, { expectedText: "same prompt", previousSnapshot }, documentLike), false);
});

test("composer clearing or generation alone is not a delivery receipt", () => {
  const adapter = { userSelectors: ["user"] };
  const documentLike = { querySelectorAll() { return []; } };
  assert.equal(Platforms.submissionObserved(adapter, { expectedText: "queued prompt", previousSnapshot: { count: 0, latestText: "" } }, documentLike), false);
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
