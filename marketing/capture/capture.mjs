/*
 * Deterministic product-capture harness for "YOLO for ChatGPT".
 *
 * Live authenticated ChatGPT capture is not available in CI or a clean
 * profile, so this harness stages the demonstration scenario from the launch
 * brief using the repository's OWN HTML, CSS, and JS:
 *
 *   - The popup card is composed from the real popup.html + styles.css and
 *     populated with queue items whose DOM exactly mirrors popup.js.
 *   - The command palette, workflow bar, and status dialog are rendered by
 *     mounting the real command-ui.js + commands.js (no re-implementation).
 *   - The Advanced settings page is the real options.html + options.css.
 *   - The surrounding chat surface is neutral marketing scene chrome
 *     (marketing/capture/lib/surface.css), clearly disclosed as staged.
 *
 * Everything is invented demonstration content: no private data, no real
 * conversations, no tokens, no real GitHub credentials. See README.md.
 *
 * Output: five optimized WebP screenshots in docs/assets/.
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const OUTPUT_DIR = join(HERE, "output");
const SCENE_DIR = join(OUTPUT_DIR, "scenes");
const ASSET_DIR = join(REPO_ROOT, "docs", "assets");

const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;
const WEBP_MAX_BYTES = 350 * 1024;

const fileUrl = (rel) => pathToFileURL(join(REPO_ROOT, rel)).href;
const surfaceCssUrl = pathToFileURL(join(HERE, "lib", "surface.css")).href;

const scenariosOnly = process.argv.includes("--scenes-only");

/* --------------------------------------------------------------------- */
/* Shared markup helpers                                                  */
/* --------------------------------------------------------------------- */

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function stagedBadge() {
  return `<div class="staged-badge"><span class="d"></span>Staged demo \u00b7 no live data</div>`;
}

function githubGlyph() {
  return `<svg class="gh-glyph" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;
}

function chatMessage(msg) {
  if (msg.role === "receipt") {
    return `<div class="receipt"><span>\u2713 ${esc(msg.text)}</span></div>`;
  }
  const who = msg.role === "user" ? "You" : "Assistant";
  const avatar = msg.role === "user" ? "Y" : "C";
  return `<div class="msg ${msg.role}">
      <div class="avatar" aria-hidden="true">${avatar}</div>
      <div class="bubble"><span class="who">${who}</span>${esc(msg.text)}</div>
    </div>`;
}

function composer({ slash = false, text = "", placeholder = "Describe what ChatGPT should do next\u2026", action = "/goal" } = {}) {
  const field = slash
    ? `<div class="field slash" id="composer-field">/${esc(text)}<span class="caret"></span></div>`
    : `<div class="field" id="composer-field"><span class="placeholder">${esc(placeholder)}</span><span class="caret"></span></div>`;
  return `<div class="composer-wrap">
      <div class="composer">
        ${field}
        <div class="composer-bar">
          <span class="yolo-action"><span class="tag">YOLO ACTION</span><code>${esc(action)}</code></span>
          <span class="send" aria-hidden="true">\u2191</span>
        </div>
      </div>
    </div>`;
}

function chatColumn({ title = "orders-service audit", messages = [], githubChip = false, comp = {} }) {
  const chip = githubChip
    ? `<span class="chip">${githubGlyph()}<span>Optional \u00b7 <strong>GitHub app</strong> connected to ChatGPT</span></span>`
    : `<span class="chip">Clean profile \u00b7 invented demo content</span>`;
  return `<section class="chat">
    <div class="chat-topbar">
      <span class="chat-title"><span class="dot"></span>${esc(title)}</span>
      ${chip}
    </div>
    <div class="thread">
      ${messages.map(chatMessage).join("\n")}
    </div>
    ${composer(comp)}
  </section>`;
}

async function loadShell() {
  const head = `<!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="${surfaceCssUrl}">
  </head><body>`;
  const foot = `</body></html>`;
  return { head, foot };
}

/* --------------------------------------------------------------------- */
/* Popup card composed from the real popup.html + styles.css              */
/* --------------------------------------------------------------------- */

async function popupAppShell() {
  const popupHtml = await readFile(join(REPO_ROOT, "popup.html"), "utf8");
  const match = popupHtml.match(/<main class="app-shell">[\s\S]*?<\/main>/);
  if (!match) throw new Error("Could not extract app-shell from popup.html");
  return match[0];
}

/*
 * Reproduces popup.js renderQueue() item structure so the staged popup uses
 * the real CSS classes and DOM shape. Kept intentionally close to the source.
 */
const POPUP_POPULATE = `
function compactText(text, max = 180) {
  const clean = String(text || "").replace(/\\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + "\u2026";
}
function itemButton(label, title, className = "") {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label; b.title = title;
  b.setAttribute("aria-label", title); b.className = className;
  return b;
}
function populatePopup(state) {
  const q = document.querySelector("#queueList");
  const items = state.items || [];
  document.querySelector("#enabled").checked = Boolean(state.enabled);
  document.querySelector("#status").textContent = state.enabled ? "Running" : "Paused";
  document.querySelector("#status").dataset.on = String(Boolean(state.enabled));
  document.querySelector("#scope").textContent = "ChatGPT \u00b7 current conversation";
  document.querySelector("#profile").value = state.profile || "balanced";
  document.querySelector("#queueCount").textContent = items.length + " queued";
  document.querySelector("#emptyQueue").hidden = items.length > 0;
  document.querySelector("#togglePause").textContent = "Pause";
  document.querySelector("#version").textContent = "v" + (state.version || "1.1.0");
  document.querySelector("#lastAction").textContent = state.lastAction || "Delivered next step";
  document.querySelector("#sessionActions").textContent = String(state.sessionActions ?? 0);
  document.querySelector("#hourlyActions").textContent = String(state.hourlyActions ?? 0);
  document.querySelector("#nextSend").textContent = state.nextSend || "\u2014";
  const managedIndex = Number.isInteger(state.workflowManagedIndex) ? state.workflowManagedIndex : -1;
  items.forEach((item, index) => {
    const managed = index === managedIndex;
    const li = document.createElement("li");
    li.className = "queue-item";
    li.dataset.state = item.state;
    li.dataset.workflowOwned = String(managed);
    li.draggable = !managed && item.state !== "sending";
    const drag = itemButton("\u22EE\u22EE", managed ? "Workflow-managed message" : "Drag to reorder", "drag-handle");
    const copy = document.createElement("div");
    copy.className = "queue-copy";
    const strong = document.createElement("strong");
    strong.textContent = compactText(item.text);
    const meta = document.createElement("div");
    meta.className = "queue-meta";
    const position = document.createElement("span");
    position.textContent = "#" + (index + 1);
    const status = document.createElement("span");
    status.textContent = item.state === "failed"
      ? "failed" + (item.attempts ? " \u00b7 " + item.attempts + " attempts" : "")
      : item.state;
    status.className = item.state;
    meta.append(position, status);
    if (managed) {
      const owner = document.createElement("span");
      owner.textContent = "managed by workflow";
      meta.append(owner);
    }
    copy.append(strong, meta);
    const actions = document.createElement("div");
    actions.className = "item-actions";
    if (item.state === "failed" && !managed) actions.append(itemButton("\u21BB", "Retry message"));
    const moveUp = itemButton("\u2191", "Move up");
    const moveDown = itemButton("\u2193", "Move down");
    const edit = itemButton("Edit", managed ? "Edit the active workflow instead" : "Edit message");
    const remove = itemButton("\u00D7", managed ? "Stop the active workflow instead" : "Remove message", "danger");
    moveUp.disabled = managed || index === 0;
    moveDown.disabled = managed || index === items.length - 1;
    edit.disabled = managed; remove.disabled = managed;
    if (item.state === "sending") { moveUp.disabled = moveDown.disabled = true; }
    actions.append(moveUp, moveDown, edit, remove);
    if (item.state === "sending") drag.disabled = true;
    li.append(drag, copy, actions);
    q.append(li);
  });
}
`;

/*
 * styles.css sets `html, body { width: 420px }` globally, so the real popup
 * must be isolated in its own document. We render it into a same-origin
 * iframe and size the frame to its content on load. This keeps the popup
 * pixel-faithful to the shipped extension without leaking its global rules
 * into the surrounding scene.
 */
async function writePopupFile(id, state) {
  const appShell = await popupAppShell();
  const styles = fileUrl("styles.css");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <link rel="stylesheet" href="${styles}">
    <style>html, body { max-height: none; overflow: visible; } body { background: transparent; }</style>
  </head><body>
    ${appShell}
    <script>${POPUP_POPULATE}</script>
    <script>populatePopup(${JSON.stringify(state)});</script>
  </body></html>`;
  const file = `${id}__popup.html`;
  await writeFile(join(SCENE_DIR, file), html, "utf8");
  return file;
}

function popupIframe(file) {
  const src = `./${file}`;
  return `<div class="popup-frame"><iframe class="popup-iframe" src="${src}" title="YOLO popup"
    style="width:420px;border:0;display:block"
    onload="this.style.height=this.contentWindow.document.body.scrollHeight+'px'"></iframe></div>`;
}

/* --------------------------------------------------------------------- */
/* Scene builders                                                         */
/* --------------------------------------------------------------------- */

async function buildQueueScene(scn) {
  const { head, foot } = await loadShell();
  const messages = scn.conversation.queue;
  const popupFile = await writePopupFile("screenshot-queue", {
    enabled: true,
    profile: "balanced",
    version: "1.1.0",
    lastAction: "Delivered next step \u00b7 Review edge cases",
    sessionActions: 6, hourlyActions: 6, nextSend: "28s",
    items: scn.queue
  });
  return `${head}
  <div class="stage">
    ${chatColumn({ title: "orders-service audit", messages, comp: { placeholder: "Queue the next step\u2026", action: "/review" } })}
    <aside class="dock">
      <div class="dock-note"><span class="k">YOLO</span> \u00b7 popup for this conversation</div>
      ${popupIframe(popupFile)}
    </aside>
  </div>
  ${stagedBadge()}
  ${foot}`;
}

// Nonce shared between the CSP meta and the capture script so the real
// options.* scripts (which need Chrome extension APIs) are blocked while our
// own populate script runs. This avoids parsing/sanitizing HTML with regex.
const SETTINGS_NONCE = "yolo-capture";

async function buildSettingsScene(scn) {
  let optionsHtml = await readFile(join(REPO_ROOT, "options.html"), "utf8");
  const optionsCss = fileUrl("options.css");
  const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${SETTINGS_NONCE}'">`;
  optionsHtml = optionsHtml.replace(
    '<link rel="stylesheet" href="options.css">',
    `${csp}<link rel="stylesheet" href="${optionsCss}">`
  );

  // Focused selection only: Overview (profiles), Approvals (off by default),
  // Safety (limits + always-on draft protection), Data (local data controls).
  const KEEP = new Set(["overview", "approvals", "safety", "data"]);
  const focusStyle = `<style id="capture-focus">
    html { scroll-behavior: auto; }
    body { min-width: 1440px; }
    .settings-section:not([data-keep]) { display: none !important; }
    .search-empty { display: none !important; }
  </style>`;

  const populate = `<script nonce="${SETTINGS_NONCE}">
    (function () {
      const KEEP = ${JSON.stringify([...KEEP])};
      for (const sec of document.querySelectorAll("[data-settings-section]")) {
        if (KEEP.includes(sec.id)) sec.setAttribute("data-keep", "");
      }
      const values = {
        profile: "balanced", enabled: true,
        approvalsEnabled: false, approvalPolicy: "safe",
        approvalDelayMinSec: 2, approvalDelayMaxSec: 6, approvalCooldownSec: 12, approvalLimitPerHour: 12,
        loadGraceSec: 10, scanIntervalSec: 3, protectActiveWorkflowTabs: true,
        maxActionsPerSession: 100, pauseOnComposerText: true
      };
      for (const [key, value] of Object.entries(values)) {
        const el = document.querySelector('[data-setting="' + key + '"]');
        if (!el) continue;
        if (el.type === "checkbox") el.checked = Boolean(value);
        else el.value = String(value);
      }
      document.querySelector("#scope").textContent = "acme-labs/orders-service \u00b7 current conversation";
      document.querySelector("#saveStatus").textContent = "All changes saved";
      const dot = document.querySelector(".save-dot"); if (dot) dot.style.background = "var(--success)";
      // Reflect focused set in nav + count.
      document.querySelectorAll("[data-section-link]").forEach((b) => b.removeAttribute("aria-current"));
      const nav = document.querySelector('[data-section-link="overview"]'); if (nav) nav.setAttribute("aria-current", "page");
      const count = document.querySelector("#sectionCount"); if (count) count.textContent = "Focused view";
    })();
  </script>`;

  optionsHtml = optionsHtml.replace("</head>", `${focusStyle}</head>`).replace("</body>", `${populate}${stagedBadge()}</body>`);
  return optionsHtml;
}

async function buildCommandUiScene(scn, { mode }) {
  const { head, foot } = await loadShell();
  const commandsJs = fileUrl("commands.js");
  const commandUiJs = fileUrl("command-ui.js");

  const chatOpts = mode === "workflow"
    ? {
        title: "orders-service audit",
        messages: scn.conversation.queue,
        comp: { placeholder: "Goal running \u2014 YOLO will continue\u2026", action: "/status" }
      }
    : {
        title: "orders-service audit",
        messages: scn.conversation.queue.slice(0, 2),
        comp: { slash: true, text: "", action: "/goal" }
      };

  const mountScript = mode === "workflow"
    ? `
      const ui = window.YOLOCommandUI.mount({ getComposer: () => composer, getComposerText: () => "" });
      ui.update({ workflow: ${JSON.stringify({
        version: 1, revision: 3, id: "goal_demo", kind: scn.workflow.kind,
        objective: scn.workflow.objective, status: scn.workflow.status,
        maxIterations: scn.workflow.maxIterations, iteration: scn.workflow.iteration,
        awaitingResponse: true, updatedAt: Date.now(), createdAt: Date.now()
      })} });
      ui.showStatus({
        "Workflow": "Goal \u00b7 running",
        "Objective": ${JSON.stringify(scn.workflow.objective)},
        "Iteration": "${scn.workflow.iteration} of ${scn.workflow.maxIterations}",
        "Queue": "4 queued \u00b7 1 sending",
        "Hourly limit": "6 of 30 used",
        "Draft protection": "On",
        "Last action": "Delivered next step \u00b7 12s ago"
      });
      window.setTimeout(() => ui.reposition(), 60);
    `
    : `
      const ui = window.YOLOCommandUI.mount({ getComposer: () => composer, getComposerText: () => "/" });
      ui.open("/");
      window.setTimeout(() => ui.reposition(), 60);
    `;

  return `${head}
  <div class="stage single">
    ${chatColumn(chatOpts)}
  </div>
  ${stagedBadge()}
  <script src="${commandsJs}"></script>
  <script src="${commandUiJs}"></script>
  <script>
    const composer = document.querySelector("#composer-field");
    ${mountScript}
  </script>
  ${foot}`;
}

async function buildGithubScene(scn) {
  const { head, foot } = await loadShell();
  const messages = scn.github.conversation.queue;
  const ghQueue = [
    { text: "Review the resulting changes for regressions.", state: "sending" },
    { text: "Run or inspect the relevant validation.", state: "queued" },
    { text: "Fix concrete findings.", state: "queued" },
    { text: "Summarize the final state and remaining risks.", state: "queued" }
  ];
  const popupFile = await writePopupFile("screenshot-github-workflow", {
    enabled: true, profile: "balanced", version: "1.1.0",
    lastAction: "Delivered next step \u00b7 Implement the fix",
    sessionActions: 4, hourlyActions: 4, nextSend: "31s",
    items: ghQueue
  });
  return `${head}
  <div class="stage">
    ${chatColumn({ title: "acme-labs/orders-service", messages, githubChip: true, comp: { placeholder: "Queue the next step\u2026", action: "/review" } })}
    <aside class="dock">
      <div class="dock-note"><span class="k">GitHub \u2192 ChatGPT</span> \u00b7 YOLO queues the follow-ups</div>
      <div class="chip" style="align-self:flex-start">${githubGlyph()}<span>GitHub connects to <strong>ChatGPT</strong>, not YOLO</span></div>
      ${popupIframe(popupFile)}
    </aside>
  </div>
  ${stagedBadge()}
  ${foot}`;
}

/* --------------------------------------------------------------------- */
/* Orchestration                                                          */
/* --------------------------------------------------------------------- */

const SCENES = [
  { id: "screenshot-queue", build: buildQueueScene },
  { id: "screenshot-command-palette", build: (s) => buildCommandUiScene(s, { mode: "palette" }) },
  { id: "screenshot-workflow", build: (s) => buildCommandUiScene(s, { mode: "workflow" }) },
  { id: "screenshot-github-workflow", build: buildGithubScene },
  { id: "screenshot-settings", build: buildSettingsScene }
];

async function encodeWebp(pngPath, webpPath) {
  for (const quality of [86, 80, 74, 68, 60]) {
    const buffer = await sharp(pngPath)
      .resize(VIEWPORT.width, VIEWPORT.height, { fit: "cover" })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (buffer.length <= WEBP_MAX_BYTES || quality === 60) {
      await writeFile(webpPath, buffer);
      return { bytes: buffer.length, quality };
    }
  }
}

async function main() {
  const scn = JSON.parse(await readFile(join(HERE, "fixtures", "scenario.json"), "utf8"));
  await rm(SCENE_DIR, { recursive: true, force: true });
  await mkdir(SCENE_DIR, { recursive: true });
  await mkdir(ASSET_DIR, { recursive: true });

  for (const scene of SCENES) {
    const html = await scene.build(scn);
    await writeFile(join(SCENE_DIR, `${scene.id}.html`), html, "utf8");
  }
  console.log(`Wrote ${SCENES.length} scene files to ${SCENE_DIR}`);
  if (scenariosOnly) return;

  const browser = await chromium.launch({
    // --allow-file-access-from-files lets the scene measure the same-origin
    // popup iframe's real content height (file:// frames are otherwise
    // treated as opaque cross-origin).
    args: ["--force-color-profile=srgb", "--hide-scrollbars", "--allow-file-access-from-files"]
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: "light",
    reducedMotion: "reduce"
  });
  const page = await context.newPage();

  const results = [];
  for (const scene of SCENES) {
    const sceneUrl = pathToFileURL(join(SCENE_DIR, `${scene.id}.html`)).href;
    await page.goto(sceneUrl, { waitUntil: "networkidle" });
    // Size each embedded popup iframe to its real content height.
    await page.evaluate(() => {
      for (const frame of document.querySelectorAll("iframe.popup-iframe")) {
        try {
          const doc = frame.contentWindow.document;
          frame.style.height = `${doc.documentElement.scrollHeight}px`;
        } catch { /* cross-origin — not expected for file:// */ }
      }
    });
    await page.waitForTimeout(400);
    const pngPath = join(OUTPUT_DIR, `${scene.id}.png`);
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, ...VIEWPORT } });
    const webpPath = join(ASSET_DIR, `${scene.id}.webp`);
    const { bytes, quality } = await encodeWebp(pngPath, webpPath);
    results.push({ id: scene.id, kb: (bytes / 1024).toFixed(1), quality });
    console.log(`  ${scene.id}.webp  ${(bytes / 1024).toFixed(1)} KB  (q${quality})`);
  }

  await browser.close();

  const failures = results.filter((r) => Number(r.kb) * 1024 > WEBP_MAX_BYTES);
  if (failures.length) {
    console.error("Some screenshots exceeded 350 KB:", failures);
    process.exit(1);
  }
  console.log(`\nDone. ${results.length} screenshots written to ${ASSET_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
