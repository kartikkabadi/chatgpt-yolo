const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function repositoryFiles(directory = root, prefix = "") {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "dist", "node_modules"].includes(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...repositoryFiles(path.join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result;
}

test("public repository includes the essential open-source policy files", () => {
  for (const file of [
    "LICENSE",
    "NOTICE.md",
    "PRIVACY.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SUPPORT.md",
    "CHANGELOG.md"
  ]) assert.equal(fs.existsSync(path.join(root, file)), true, file);
  assert.match(read("LICENSE"), /MIT License/);
  assert.match(read("PRIVACY.md"), /no analytics, telemetry/i);
  assert.match(read("NOTICE.md"), /not affiliated/i);
});

test("ordinary pull-request CI is immutable and read-only", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(ci, /git push|contents: write|release\/v1-open-source|\.apply-/);
  assert.match(ci, /Validate on Node 20/);
  assert.match(ci, /Validate on Node 24/);
  assert.match(ci, /name: yolo-preview/);
});

test("release workflow validates tag identity and emits an archive checksum", () => {
  const release = read(".github/workflows/release.yml");
  assert.match(release, /test "\$GITHUB_REF_NAME" = "v\$\{version\}"/);
  assert.match(release, /zip -X -rq/);
  assert.match(release, /sha256sum/);
  assert.match(release, /if-no-files-found: error/);
  assert.match(release, /gh release create/);
});

test("temporary review and diagnostic files are absent", () => {
  const offenders = repositoryFiles().filter((file) =>
    /(^|\/)\.(apply|fix)-|\.ready$|diagnostic|\.error\.txt$/i.test(file));
  assert.deepEqual(offenders, []);
});

test("documentation promises match the local-only permission model", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://chatgpt.com/*", "https://*.chatgpt.com/*"]);
  for (const file of ["README.md", "PRIVACY.md", "docs/PERMISSIONS.md"]) {
    const content = read(file);
    assert.match(content, /local/i, file);
    assert.doesNotMatch(content, /collects telemetry|remote code is loaded/i, file);
  }
});
