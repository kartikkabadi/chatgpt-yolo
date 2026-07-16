import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUNTIME_FILES } from "./package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(relative) {
  return JSON.parse(await readFile(path.join(root, relative), "utf8"));
}

function sameMembers(actual = [], expected = []) {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function collectManifestPaths(manifest) {
  const paths = new Set();
  if (manifest.background?.service_worker) paths.add(manifest.background.service_worker);
  if (manifest.action?.default_popup) paths.add(manifest.action.default_popup);
  if (manifest.options_ui?.page) paths.add(manifest.options_ui.page);
  for (const icon of Object.values(manifest.icons || {})) paths.add(icon);
  for (const icon of Object.values(manifest.action?.default_icon || {})) paths.add(icon);
  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) paths.add(file);
    for (const file of script.css || []) paths.add(file);
  }
  return paths;
}

const manifest = await readJson("manifest.json");
const pkg = await readJson("package.json");

if (manifest.manifest_version !== 3) fail("manifest.json must use Manifest V3");
if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} does not match package version ${pkg.version}`);
if (pkg.private !== true) fail("package.json must remain private; this repository ships a browser extension, not an npm library");
if (pkg.dependencies && Object.keys(pkg.dependencies).length) fail("runtime npm dependencies are not allowed");
if (pkg.devDependencies && Object.keys(pkg.devDependencies).length) fail("development dependencies are not allowed without an explicit architecture decision");

const expectedPermissions = ["alarms", "scripting", "storage"];
if (!sameMembers(manifest.permissions || [], expectedPermissions)) {
  fail(`required permissions must remain exactly: ${expectedPermissions.join(", ")}`);
}

const expectedHosts = ["https://chatgpt.com/*", "https://*.chatgpt.com/*"];
if (!sameMembers(manifest.host_permissions || [], expectedHosts)) {
  fail(`host permissions must remain exactly: ${expectedHosts.join(", ")}`);
}
if ((manifest.optional_permissions || []).length) fail("optional_permissions must be empty");
if ((manifest.optional_host_permissions || []).length) fail("optional_host_permissions must be empty");

for (const forbidden of ["activeTab", "tabs", "debugger", "nativeMessaging", "webRequest", "webRequestBlocking", "history", "cookies"]) {
  if ((manifest.permissions || []).includes(forbidden)) fail(`forbidden permission present: ${forbidden}`);
}
for (const forbiddenKey of ["update_url", "externally_connectable", "oauth2", "key"]) {
  if (Object.prototype.hasOwnProperty.call(manifest, forbiddenKey)) fail(`forbidden manifest key present: ${forbiddenKey}`);
}

const contentScripts = manifest.content_scripts || [];
if (contentScripts.length !== 1) fail("exactly one content-script declaration is expected");
for (const declaration of contentScripts) {
  if (!sameMembers(declaration.matches || [], expectedHosts)) fail("content-script matches must stay scoped to ChatGPT");
  if (declaration.run_at !== "document_idle") fail("content scripts must run at document_idle");
}

const runtimeSet = new Set(RUNTIME_FILES);
for (const referenced of collectManifestPaths(manifest)) {
  if (!runtimeSet.has(referenced)) fail(`manifest references a file missing from the package allowlist: ${referenced}`);
}

const forbiddenRuntimePatterns = [
  /^cli\//,
  /(?:^|\/)agent-/,
  /(?:^|\/)review-/,
  /(?:^|\/)server(?:\.|\/)/,
  /native-messaging/i
];
for (const relative of RUNTIME_FILES) {
  if (path.isAbsolute(relative) || relative.includes("..")) fail(`unsafe runtime path: ${relative}`);
  if (forbiddenRuntimePatterns.some((pattern) => pattern.test(relative))) {
    fail(`non-extension runtime surface is not allowed in the release package: ${relative}`);
  }
  try {
    await access(path.join(root, relative));
  } catch {
    fail(`packaged file is missing: ${relative}`);
  }
}

const dynamicCodePatterns = [
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /new\s+Function\s*\(/, label: "new Function" },
  { pattern: /importScripts\s*\(\s*["']https?:\/\//, label: "remote importScripts" },
  { pattern: /import\s*\(\s*["']https?:\/\//, label: "remote dynamic import" }
];
for (const relative of RUNTIME_FILES.filter((file) => file.endsWith(".js"))) {
  const source = await readFile(path.join(root, relative), "utf8");
  for (const { pattern, label } of dynamicCodePatterns) {
    if (pattern.test(source)) fail(`${relative} contains forbidden dynamic code: ${label}`);
  }
}

for (const required of ["README.md", "LICENSE", "NOTICE.md", "PRIVACY.md"]) {
  if (!runtimeSet.has(required)) fail(`public release package must include ${required}`);
}

if (failures.length) {
  console.error("Extension release verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Verified public extension boundary (${RUNTIME_FILES.length} packaged files)`);
}
