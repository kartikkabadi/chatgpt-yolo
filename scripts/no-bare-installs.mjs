import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedNpm = /npm\s+ci\b/;
const allowedNpx = /npx\s+\S+@\S+/;
const allowedPip = /pip\s+install\s+-r\s+\S+/;
const allowedCurl = /curl\s+-fS[sL]?/;

const patterns = [
  { re: /pip\s+install\s+(?!-r\s|\.)/i, label: "bare pip install" },
  { re: /npm\s+install\b(?!\s+--global|\s+--save|\s+--save-dev)/i, label: "bare npm install" },
  { re: /curl\s+[^|\n]*\|\s*(sh|bash|zsh)/i, label: "curl | shell" },
  { re: /<script[^>]+src=["']https?:\/\//i, label: "remote script src" },
  { re: /<script[^>]+src=["']\/\/[^/]/i, label: "protocol-relative script src" },
];

const scanDirs = [".github/workflows", "scripts", "marketing", "docs"];
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (st.isFile() && /\.(md|yml|yaml|mjs|js|html|json|sh)$/.test(name)) {
      files.push(full);
    }
  }
}

for (const d of scanDirs) {
  const full = path.join(root, d);
  if (statSync(full, { throwIfNoEntry: false })) walk(full);
}

let failed = false;
for (const file of files) {
  if (file.endsWith("no-bare-installs.mjs")) continue;
  const text = readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
  for (const { re, label } of patterns) {
    if (re.test(text)) {
      console.error(`${label}: ${path.relative(root, file)}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Found bare install commands, remote script references, or curl-pipe-shell patterns.");
  process.exit(1);
}
console.log("No bare install commands or remote executable imports found.");
