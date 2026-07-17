const { test } = require("node:test");
const assert = require("node:assert/strict");

function flagged(check, text) {
  return check(text).length > 0;
}

test("allows npm run scripts and npm test", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, "npm run validate"), false);
  assert.equal(flagged(check, "npm run package"), false);
  assert.equal(flagged(check, "npm test"), false);
  assert.equal(flagged(check, "npm run verify:extension"), false);
});

test("flags bare npm install, npm i, npm ci, npm pack, npm add", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, "npm install"), true);
  assert.equal(flagged(check, "npm i"), true);
  assert.equal(flagged(check, "npm ci"), true);
  assert.equal(flagged(check, "npm pack gsap@3.14.2"), true);
  assert.equal(flagged(check, "npm add lodash"), true);
  assert.equal(flagged(check, "  npm install  "), true);
});

test("flags bare npx", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, "npx hyperframes render ."), true);
  assert.equal(flagged(check, "npx some-tool"), true);
});

test("flags bare pip install except requirements file", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, "pip install pillow"), true);
  assert.equal(flagged(check, "pip3 install playwright"), true);
  assert.equal(flagged(check, "python -m pip install pillow"), true);
  assert.equal(flagged(check, "python3 -m pip install -r requirements.txt"), false);
  assert.equal(flagged(check, "pip install -r requirements.txt"), false);
});

test("flags yarn and pnpm installs", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, "yarn add lodash"), true);
  assert.equal(flagged(check, "yarn install"), true);
  assert.equal(flagged(check, "pnpm install"), true);
  assert.equal(flagged(check, "pnpm i"), true);
  assert.equal(flagged(check, "pnpm add lodash"), true);
});

test("flags curl or wget piped to shell", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, "curl https://example.com/install.sh | sh"), true);
  assert.equal(flagged(check, "curl -fsSL https://x | bash"), true);
  assert.equal(flagged(check, "wget -qO- https://x | zsh"), true);
});

test("flags remote script tags", async () => {
  const { check } = await import("../scripts/no-bare-installs.mjs");
  assert.equal(flagged(check, '<script src="https://cdn.example.com/lib.js"></script>'), true);
  assert.equal(flagged(check, "<script src='//cdn.example.com/lib.js'></script>"), true);
  assert.equal(flagged(check, '<script src="vendor/lib.js"></script>'), false);
});
