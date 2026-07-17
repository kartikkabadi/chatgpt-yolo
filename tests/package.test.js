const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts/package.mjs"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

function packagedFiles() {
  const match = script.match(/RUNTIME_FILES = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(match, "runtime allowlist is declared");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

test("release package uses an explicit runtime allowlist", () => {
  const files = packagedFiles();
  for (const file of files) assert.equal(fs.existsSync(path.join(root, file)), true, file);
  for (const forbidden of ["tests", ".github", ".git", "docs", "CONTRIBUTING.md", "SECURITY.md"]) {
    assert.equal(files.some((file) => file === forbidden || file.startsWith(`${forbidden}/`)), false, forbidden);
  }
});

test("every manifest runtime entry point is packaged", () => {
  const files = new Set(packagedFiles());
  const required = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...manifest.content_scripts.flatMap((entry) => entry.js),
    ...Object.values(manifest.icons)
  ];
  for (const file of required) assert.equal(files.has(file), true, file);
});

test("onboarding is entirely local and packaged", () => {
  const files = new Set(packagedFiles());
  assert.equal(files.has("onboarding.html"), true);
  assert.equal(files.has("onboarding.js"), true);
  const html = fs.readFileSync(path.join(root, "onboarding.html"), "utf8");
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("release README is packaged unconditionally and matches source", async () => {
  const { packageExtension } = await import("../scripts/package.mjs");
  const outDir = await packageExtension();
  const releaseText = fs.readFileSync(path.join(root, "README.release.md"), "utf8");
  const packagedText = fs.readFileSync(path.join(outDir, "README.md"), "utf8");
  assert.equal(packagedText, releaseText);
  assert.doesNotMatch(packagedText, /\.\.\/docs\/assets|\.\.\/marketing\//);
});
