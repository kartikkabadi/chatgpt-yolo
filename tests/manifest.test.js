const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Config = require("../config.js");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("manifest and package versions match the runtime version", () => {
  assert.equal(manifest.version, Config.VERSION);
  assert.equal(pkg.version, Config.VERSION);
});

test("every manifest entry point exists", () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...manifest.content_scripts.flatMap((entry) => entry.js),
    ...Object.values(manifest.icons)
  ];
  for (const file of files) assert.equal(fs.existsSync(path.join(root, file)), true, file);
});

test("content scripts load shared configuration before the engine", () => {
  assert.deepEqual(manifest.content_scripts[0].js, ["config.js", "platforms.js", "content.js"]);
});
