import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../scripts/no-bare-installs.mjs";

function flagged(text) {
  return check(text).length > 0;
}

test("allows npm run scripts and npm test", () => {
  assert.equal(flagged("npm run validate"), false);
  assert.equal(flagged("npm run package"), false);
  assert.equal(flagged("npm test"), false);
  assert.equal(flagged("npm run verify:extension"), false);
});

test("flags bare npm install, npm i, npm ci, npm pack, npm add", () => {
  assert.equal(flagged("npm install"), true);
  assert.equal(flagged("npm i"), true);
  assert.equal(flagged("npm ci"), true);
  assert.equal(flagged("npm pack gsap@3.14.2"), true);
  assert.equal(flagged("npm add lodash"), true);
  assert.equal(flagged("  npm install  "), true);
});

test("flags bare npx", () => {
  assert.equal(flagged("npx hyperframes render ."), true);
  assert.equal(flagged("npx some-tool"), true);
});

test("flags bare pip install except requirements file", () => {
  assert.equal(flagged("pip install pillow"), true);
  assert.equal(flagged("pip3 install playwright"), true);
  assert.equal(flagged("python -m pip install pillow"), true);
  assert.equal(flagged("python3 -m pip install -r requirements.txt"), false);
  assert.equal(flagged("pip install -r requirements.txt"), false);
});

test("flags yarn andpnpm installs", () => {
  assert.equal(flagged("yarn add lodash"), true);
  assert.equal(flagged("yarn install"), true);
  assert.equal(flagged("pnpm install"), true);
  assert.equal(flagged("pnpm i"), true);
  assert.equal(flagged("pnpm add lodash"), true);
});

test("flags curl or wget piped to shell", () => {
  assert.equal(flagged("curl https://example.com/install.sh | sh"), true);
  assert.equal(flagged("curl -fsSL https://x | bash"), true);
  assert.equal(flagged("wget -qO- https://x | zsh"), true);
});

test("flags remote script tags", () => {
  assert.equal(flagged('<script src="https://cdn.example.com/lib.js"></script>'), true);
  assert.equal(flagged("<script src='//cdn.example.com/lib.js'></script>"), true);
  assert.equal(flagged('<script src="vendor/lib.js"></script>'), false);
});
