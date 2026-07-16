const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Config = require("../config.js");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function ids(html) {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
}

test("popup and advanced page have unique element identifiers", () => {
  for (const name of ["popup.html", "options.html"]) {
    const values = ids(read(name));
    assert.equal(new Set(values).size, values.length, `${name} contains duplicate ids`);
  }
});

test("advanced page exposes every configurable setting while popup stays compact", () => {
  const options = read("options.html");
  for (const key of Object.keys(Config.DEFAULT_SETTINGS)) {
    assert.match(options, new RegExp(`data-setting=["']${key}["']`), `missing advanced control for ${key}`);
  }

  const popup = read("popup.html");
  assert.equal((popup.match(/<details\b/g) || []).length <= 1, true);
  assert.equal((popup.match(/data-setting=/g) || []).length, 0);
  assert.match(popup, /id="queueList"/);
  assert.match(popup, /id="templateSelect"/);
});

test("extension pages use external scripts only", () => {
  for (const name of ["popup.html", "options.html"]) {
    const html = read(name);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    assert.doesNotMatch(html, /\son\w+\s*=/i);
  }
});


test("queue engine persists submission intent before touching the composer", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  const markIndex = source.indexOf('type: "YOLO_QUEUE_MARK_SUBMITTING"');
  const submitIndex = source.indexOf("const submitted = await writeAndSubmit(item.text, queuePageId)");
  assert.ok(markIndex >= 0);
  assert.ok(submitIndex > markIndex);
});

test("popup commits content and queue state atomically", () => {
  const source = read("popup.js");
  const queueGuard = source.indexOf("if (!queueResponse?.ok) return false;");
  const contentCommit = source.indexOf("contentState = nextContent;");
  const queueCommit = source.indexOf("queueState = queueResponse.state;");
  assert.ok(queueGuard >= 0 && contentCommit > queueGuard && queueCommit > contentCommit);
});

test("popup initialization and editing shortcuts fail closed", () => {
  const source = read("popup.js");
  const init = source.slice(source.indexOf("async function init()"), source.indexOf("els.enabled.addEventListener"));
  assert.match(init, /setBusy\(true\)/);
  assert.match(init, /includeTemplates: true, force: true/);
  assert.match(init, /setBusy\(false\)/);
  assert.match(source, /send: event\.shiftKey && !editingId/);
});

test("template rendering receives the current conversation", () => {
  const source = read("popup.js");
  assert.match(source, /conversation: contentState\?\.pageId/);
});

test("primary controls and dynamic option statuses are accessibly named", () => {
  assert.match(read("popup.html"), /id="enabled"[^>]*aria-label="Run automation for this conversation"/);
  const options = read("options.html");
  assert.match(options, /id="saveStatus"[^>]*role="status"/);
  assert.match(options, /id="templateStatus"[^>]*role="status"/);
});

test("queue failures forward explicit delivery ambiguity", () => {
  const source = read("content.js");
  assert.match(source, /deliveryAmbiguous: submissionAttempted/);
  assert.match(source, /submitted\.code, deliveryAmbiguous/);
  assert.match(source, /"queue\.exception", deliveryAmbiguous/);
});

test("ChatGPT content scripts include the composer-native command system", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("commands.js") < scripts.indexOf("command-ui.js"));
  assert.ok(scripts.indexOf("command-ui.js") < scripts.indexOf("content.js"));
  assert.ok(scripts.indexOf("content.js") < scripts.indexOf("command-runtime.js"));
});

test("command palette supports slash and Codex-style command shortcuts", () => {
  const source = read("command-ui.js");
  assert.match(source, /event\.key === "\/"/);
  assert.match(source, /event\.shiftKey && event\.key\.toLowerCase\(\) === "p"/);
  assert.match(source, /Commands\.parseInvocation/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
});

test("command workflows reuse the reliable queue and fail closed", () => {
  const runtime = read("command-runtime.js");
  assert.match(runtime, /type: "YOLO_QUEUE_ADD"/);
  assert.match(runtime, /runAction\("queue-next"\)/);
  assert.match(runtime, /Goal response omitted the required terminal control marker/);
  assert.match(runtime, /Reached the \$\{workflow\.maxIterations\}-iteration safety cap/);
});

test("content exposes only a narrow lifecycle-safe command API", () => {
  const source = read("content.js");
  assert.match(source, /const commandApi = Object\.freeze/);
  assert.match(source, /registerClient/);
  assert.match(source, /runAction: runManualAction/);
  assert.match(source, /state\.clients\.clear\(\)/);
});

test("command workflow runtime enforces ownership, CAS, and a single runner", () => {
  const runtime = read("command-runtime.js");
  assert.match(runtime, /expectedRevision: normalized\.revision/);
  assert.match(runtime, /YOLO_WORKFLOW_CLAIM/);
  assert.match(runtime, /latestUserFingerprint\(\) !== workflow\.promptFingerprint/);
  assert.match(runtime, /lastCompletedItemId === workflow\.pendingItemId/);
  assert.doesNotMatch(runtime, /lastSentAt >= workflow\.lastPromptAt/);
});

test("command palette preserves failed direct commands and exposes feedback", () => {
  const source = read("command-ui.js");
  assert.match(source, /role", "status"/);
  assert.match(source, /originalComposerText/);
  assert.match(source, /Commands\.requiresArgs\(entry\.name\)/);
  assert.match(source, /\["paused", "blocked"\]\.includes\(currentWorkflow\.status\)/);
});
