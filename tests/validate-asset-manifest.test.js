const { test } = require("node:test");
const assert = require("node:assert/strict");

test("parseDimensions parses WxH strings", async () => {
  const { parseDimensions } = await import("../scripts/validate-asset-manifest.mjs");
  assert.deepEqual(parseDimensions("1920x1080"), { width: 1920, height: 1080 });
  assert.deepEqual(parseDimensions("1536 x 864"), { width: 1536, height: 864 });
  assert.equal(parseDimensions("not dimensions"), null);
});

test("parseFrameRate parses fraction and number", async () => {
  const { parseFrameRate } = await import("../scripts/validate-asset-manifest.mjs");
  assert.equal(parseFrameRate("30/1"), 30);
  assert.equal(parseFrameRate(24), 24);
  assert.equal(parseFrameRate("60/2"), 30);
});

test("parsePngDimensions reads a simple PNG", async () => {
  const { parsePngDimensions } = await import("../scripts/validate-asset-manifest.mjs");
  const buf = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x07, 0x80, 0x00, 0x00, 0x04, 0x38,
    0x08, 0x02, 0x00, 0x00, 0x00,
  ]);
  assert.deepEqual(parsePngDimensions(buf), { width: 1920, height: 1080 });
});

test("parseSvgDimensions reads width/height or viewBox", async () => {
  const { parseSvgDimensions } = await import("../scripts/validate-asset-manifest.mjs");
  assert.deepEqual(parseSvgDimensions('<svg width="128" height="128" viewBox="0 0 128 128"></svg>'), { width: 128, height: 128 });
  assert.deepEqual(parseSvgDimensions('<svg viewBox="0 0 64 48"></svg>'), { width: 64, height: 48 });
  assert.equal(parseSvgDimensions("<svg></svg>"), null);
});

test("validateEntry catches missing sha256, unsafe path, and duplicate path", async () => {
  const { validateEntry } = await import("../scripts/validate-asset-manifest.mjs");
  const seen = new Set();
  const item = { path: "docs/../test.txt", dimensions: "100x100", size_budget_kb: 1 };
  const errors = validateEntry(item, "/nonexistent", seen);
  assert.ok(errors.some((e) => e.includes("unsafe path")), errors.join("; "));
  assert.ok(errors.some((e) => e.includes("file missing")), errors.join("; "));
  assert.ok(errors.some((e) => e.includes("missing sha256")), errors.join("; "));

  const seen2 = new Set();
  validateEntry({ path: "x/y.txt", sha256: "abc" }, "/nonexistent", seen2);
  const dupErrors = validateEntry({ path: "x/y.txt", sha256: "def" }, "/nonexistent", seen2);
  assert.ok(dupErrors.some((e) => e.includes("duplicate path")), dupErrors.join("; "));
});
