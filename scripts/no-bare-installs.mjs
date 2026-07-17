import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const SKIP_FILES = new Set([
  "scripts/no-bare-installs.mjs",
  "tests/no-bare-installs.test.js",
]);

const NPM_RUN_PATTERN = /npm\s+run\s+[\w:-]+/g;
const NPM_TEST_PATTERN = /npm\s+test\b/g;

const checks = [
  {
    name: "bare npm install/pack/add",
    pattern: /(?:^|[^\w@./-])npm\s+(?:i|install|add|pack|publish|ci)\b/g,
    allowed: ["npm run ", "npm test", "npm run"],
  },
  {
    name: "bare npx",
    pattern: /(?:^|[^\w@./-])npx\s+\S+/g,
    allowed: [],
  },
  {
    name: "yarn/pnpm install or add",
    pattern: /(?:^|[^\w@./-])(?:yarn\s+(?:add|install)\b|pnpm\s+(?:add|i|install)\b)/g,
    allowed: [],
  },
  {
    name: "bare pip install",
    pattern: /(?:^|[^\w@./-])pip(?:3)?\s+(?:install|uninstall)\s+(?!-r\s)/g,
    allowed: [],
  },
  {
    name: "python -m pip install",
    pattern: /(?:^|[^\w@./-])python(?:3)?\s+-m\s+pip\s+(?:install|uninstall)\s+(?!-r\s)/g,
    allowed: [],
  },
  {
    name: "curl | shell",
    pattern: /curl\s+[^|\r\n]*\|\s*(?:sh|bash|zsh)\b/gi,
    allowed: [],
  },
  {
    name: "wget | shell",
    pattern: /wget\s+[^|\r\n]*\|\s*(?:sh|bash|zsh)\b/gi,
    allowed: [],
  },
  {
    name: "remote script src",
    pattern: /<script[^>]*\ssrc=["']https?:\/\//gi,
    allowed: [],
  },
  {
    name: "protocol-relative script src",
    pattern: /<script[^>]*\ssrc=["']\/\//gi,
    allowed: [],
  },
];

export function check(text) {
  const findings = [];
  for (const { name, pattern, allowed } of checks) {
    for (const match of text.matchAll(pattern)) {
      const matched = match[0];
      const start = Math.max(0, match.index - 20);
      const snippet = text.slice(start, match.index + matched.length + 20).replace(/\s+/g, " ").trim();
      if (allowed.length && allowed.some((a) => matched.trim().startsWith(a))) {
        continue;
      }
      findings.push({ name, matched: matched.trim(), snippet });
    }
  }
  return findings;
}

function listTrackedFiles() {
  return execSync("git ls-files", { encoding: "utf-8", cwd: process.cwd() })
    .split("\n")
    .filter(Boolean);
}

function isText(file) {
  return /\.(md|yml|yaml|mjs|js|html|css|json|sh|py|txt)$/i.test(file);
}

function main() {
  const files = listTrackedFiles();
  let failed = false;
  let checked = 0;

  for (const file of files) {
    if (!isText(file) || SKIP_FILES.has(file)) continue;
    checked++;
    const text = readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
    const findings = check(text);
    if (findings.length) {
      failed = true;
      for (const { name, snippet } of findings) {
        console.error(`${name}: ${file}`);
        console.error(`  ${snippet}`);
      }
    }
  }

  if (failed) {
    console.error(`Found forbidden install/execution patterns in ${checked} tracked text files.`);
    process.exit(1);
  }
  console.log(`Checked ${checked} tracked text files: no forbidden install or remote executable imports found.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
