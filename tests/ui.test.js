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

test("premium popup keeps one dominant action and progressive disclosure", () => {
  const popup = read("popup.html");
  assert.equal((popup.match(/class="primary-button"/g) || []).length, 1);
  assert.match(popup, /class="brand-lockup"/);
  assert.match(popup, /class="compose-panel"/);
  assert.match(popup, /class="queue-panel"/);
  assert.match(popup, /class="activity-panel"/);
  assert.match(popup, /id="advanced"[^>]*aria-label="Open Advanced settings"/);
});

test("advanced settings has searchable persistent section navigation", () => {
  const options = read("options.html");
  const links = [...options.matchAll(/data-section-link="([^"]+)"/g)].map((match) => match[1]);
  const sections = [...options.matchAll(/id="([^"]+)"[^>]*data-settings-section/g)].map((match) => match[1]);
  assert.deepEqual(links, ["overview", "queue", "approvals", "recovery", "nudges", "refresh", "safety", "templates", "data"]);
  assert.deepEqual(sections, links);
  assert.match(options, /id="settingsSearch"[^>]*type="search"/);
  assert.match(options, /id="searchEmpty"/);
  assert.match(options, /class="workspace-header"/);
  assert.match(options, /<script src="options-ui\.js"><\/script>/);
});

test("premium visual systems include focus, reduced motion, and responsive layouts", () => {
  const popupCss = read("styles.css");
  const optionsCss = read("options.css");
  for (const css of [popupCss, optionsCss]) {
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /--surface:/);
  }
  assert.match(optionsCss, /@media \(max-width: 680px\)/);
  assert.match(optionsCss, /position: sticky/);
});

test("settings controller provides filtering, active navigation, and save-state mapping", () => {
  const source = read("options-ui.js");
  assert.match(source, /sectionMatches/);
  assert.match(source, /aria-current/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /saveStateFor/);
});

test("queue item controls are explicitly named and respect reorder boundaries", () => {
  const source = read("popup.js");
  assert.match(source, /button\.setAttribute\("aria-label", title\)/);
  assert.match(source, /moveUp\.disabled = index === 0/);
  assert.match(source, /moveDown\.disabled = index === items\.length - 1/);
});

test("settings navigation preserves scope and respects reduced motion", () => {
  const source = read("options-ui.js");
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /win\.location\?\.search/);
  assert.match(source, /behavior: reducedMotion \? "auto" : "smooth"/);
});

test("template feedback and empty state remain explicit", () => {
  const source = read("options.js");
  const css = read("options.css");
  assert.match(source, /templateStatus\.dataset\.level/);
  assert.match(source, /className = "template-empty"/);
  assert.match(css, /#templateStatus\[data-level="error"\]/);
  assert.match(css, /\.template-list \.template-empty/);
});

test("settings navigation stays available during template operations", () => {
  const source = read("options.js");
  assert.match(source, /button:not\(\[data-section-link\]\):not\(#clearSearch\)/);
});

test("destructive settings actions require confirmation and always report outcomes", () => {
  const source = read("options.js");
  assert.match(source, /Delete this template\? This cannot be undone/);
  assert.match(source, /Replace all templates with the built-in defaults/);
  assert.match(source, /Restore every automation setting to its default value/);
  assert.match(source, /Template deleted\./);
  assert.match(source, /Could not restore default templates/);
});
