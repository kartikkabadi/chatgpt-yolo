import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, "marketing", "asset-manifest.json"), "utf-8")
);

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

let failed = false;
const all = [...manifest.images, ...manifest.videos];
for (const item of all) {
  const file = path.join(root, item.path);
  if (!existsSync(file)) {
    console.error(`MISSING: ${item.path}`);
    failed = true;
    continue;
  }
  const actual = sha256(file);
  if (item.sha256 && actual !== item.sha256) {
    console.error(`SHA256 MISMATCH: ${item.path}`);
    console.error(`  expected: ${item.sha256}`);
    console.error(`  actual:   ${actual}`);
    failed = true;
  }
  const stat = statSync(file).size;
  console.log(`OK: ${item.path} (${stat} bytes)`);
}

if (failed) {
  process.exit(1);
}
console.log("Asset manifest validated.");
