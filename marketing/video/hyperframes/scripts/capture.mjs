#!/usr/bin/env node
// Deterministic product capture for the HyperFrames spike.
// Renders the real extension markup+styles (source/capture-popup.html) in
// headless Chrome and writes a crisp PNG into public/.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const input = resolve(root, "source/capture-popup.html");
const output = resolve(root, "public/screenshot-queue.png");

import { readdirSync } from "node:fs";

function findChrome() {
  if (process.env.HYPERFRAMES_BROWSER_PATH) return process.env.HYPERFRAMES_BROWSER_PATH;
  const candidates = [];
  const glob = resolve(root, "chrome-headless-shell");
  if (existsSync(glob)) {
    for (const platform of readdirSync(glob)) {
      const bin = resolve(glob, platform, "chrome-headless-shell-linux64", "chrome-headless-shell");
      if (existsSync(bin)) candidates.push(bin);
    }
  }
  for (const c of ["/home/ubuntu/.local/bin/google-chrome", "/usr/bin/google-chrome"]) {
    if (existsSync(c)) candidates.push(c);
  }
  if (!candidates.length) throw new Error("No Chrome binary found");
  return candidates[0];
}

const executablePath = findChrome();
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 640, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle0" });
const el = await page.$("main.app-shell");
await el.screenshot({ path: output });
await browser.close();
console.log("Captured", output);
