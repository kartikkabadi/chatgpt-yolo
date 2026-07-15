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
