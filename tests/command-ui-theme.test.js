const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "command-ui.js"), "utf8");

test("command UI follows ChatGPT theme changes and cleans up its observer", () => {
  assert.match(source, /document\.documentElement\.classList\.contains\("dark"\)/);
  assert.match(source, /host\.dataset\.theme = detectTheme\(\)/);
  assert.match(source, /new MutationObserver\(\(\) => \{\s*host\.dataset\.theme = detectTheme\(\);\s*\}\)/);
  assert.match(source, /attributeFilter: \["class"\]/);
  assert.match(source, /:host\(\[data-theme="light"\]\)/);
  assert.match(source, /themeObserver\.disconnect\(\)/);
  assert.doesNotMatch(source, /@media \(prefers-color-scheme: light\)/);
});
