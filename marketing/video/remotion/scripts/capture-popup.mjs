// Deterministic capture of the real product popup UI into public/product-queue.png.
// Reuses the extension's real styles.css + popup markup (see capture-popup.html)
// and populates a representative Scene-2 queue, then screenshots it headlessly.
//
// Usage: node scripts/capture-popup.mjs
//   CHROME_BIN=/path/to/chrome node scripts/capture-popup.mjs   (override binary)
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates = [
    '/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('No Chrome binary found. Set CHROME_BIN=/path/to/chrome');
}

const work = mkdtempSync(join(tmpdir(), 'yolo-capture-'));
copyFileSync(join(repoRoot, 'styles.css'), join(work, 'styles.css'));
copyFileSync(join(here, 'capture-popup.html'), join(work, 'capture-popup.html'));

const outFull = join(work, 'full.png');
const outFinal = resolve(here, '../public/product-queue.png');

execFileSync(findChrome(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  `--user-data-dir=${join(work, 'profile')}`,
  '--window-size=390,700',
  `--screenshot=${outFull}`,
  `file://${join(work, 'capture-popup.html')}`,
], {stdio: 'inherit'});

// Crop away the trailing whitespace (content is ~880px tall at 2x).
try {
  execFileSync('convert', [outFull, '-crop', '780x880+0+0', '+repage', outFinal], {
    stdio: 'inherit',
  });
} catch {
  copyFileSync(outFull, outFinal);
}
console.log('Wrote', outFinal);
