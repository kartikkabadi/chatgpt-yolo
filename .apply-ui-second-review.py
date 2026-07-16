from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:140]!r}")
    write(path, content.replace(old, new))


replace_once(
    "options.js",
    '''    for (const button of document.querySelectorAll("button")) button.disabled = nextBusy;''',
    '''    for (const button of document.querySelectorAll("button:not([data-section-link]):not(#clearSearch)")) {
      button.disabled = nextBusy;
    }'''
)

replace_once(
    "options.js",
    '''  function setTemplateStatus(message = "", error = false) {
    els.templateStatus.textContent = message;
    els.templateStatus.style.color = error ? "var(--danger)" : "var(--muted)";
  }''',
    '''  function setTemplateStatus(message = "", error = false) {
    els.templateStatus.textContent = message;
    els.templateStatus.dataset.level = error ? "error" : "info";
  }'''
)

replace_once(
    "options.js",
    '''  function renderTemplates() {
    els.templateList.replaceChildren();
    for (const template of templates) {''',
    '''  function renderTemplates() {
    els.templateList.replaceChildren();
    if (!templates.length) {
      const empty = document.createElement("li");
      empty.className = "template-empty";
      empty.textContent = "No templates yet. Create one from the editor.";
      els.templateList.append(empty);
      return;
    }
    for (const template of templates) {'''
)

replace_once(
    "options-ui.js",
    '''    if (text.includes("could not") || text.includes("failed") || text.includes("unavailable") || text.includes("no conversation")) return "error";
    return "saved";''',
    '''    if (text.includes("no conversation")) return "limited";
    if (text.includes("could not") || text.includes("failed") || text.includes("unavailable")) return "error";
    return "saved";'''
)

replace_once(
    "options.css",
    '''.save-state[data-state="saving"] .save-dot { background: var(--warning); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 13%, transparent); }
.save-state[data-state="error"] .save-dot { background: var(--danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 13%, transparent); }''',
    '''.save-state[data-state="saving"] .save-dot,
.save-state[data-state="limited"] .save-dot { background: var(--warning); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 13%, transparent); }
.save-state[data-state="error"] .save-dot { background: var(--danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 13%, transparent); }'''
)

replace_once(
    "options.css",
    '''#templateStatus { min-height: 18px; color: var(--text-faint); font-size: 11px; }
.template-library { min-width: 0; }''',
    '''#templateStatus { min-height: 18px; color: var(--text-faint); font-size: 11px; }
#templateStatus[data-level="error"] { color: var(--danger); }
.template-library { min-width: 0; }'''
)

replace_once(
    "options.css",
    '''.template-list li:first-child { border-top: 0; }
.template-copy { min-width: 0; display: grid; gap: 3px; }''',
    '''.template-list li:first-child { border-top: 0; }
.template-list .template-empty { display: block; padding: 28px 18px; color: var(--text-faint); text-align: center; font-size: 11px; }
.template-copy { min-width: 0; display: grid; gap: 3px; }'''
)

replace_once(
    "options.html",
    '<span id="sectionCount">9 sections</span>',
    '<span id="sectionCount" aria-live="polite">9 sections</span>'
)
replace_once(
    "options.html",
    '<div id="searchEmpty" class="search-empty" hidden>',
    '<div id="searchEmpty" class="search-empty" role="status" hidden>'
)

replace_once(
    "tests/options-ui.test.js",
    '''  assert.equal(UI.saveStateFor("No conversation selected"), "error");''',
    '''  assert.equal(UI.saveStateFor("No conversation selected"), "limited");'''
)

ui_append = r'''

test("template feedback and empty state remain explicit", () => {
  const source = read("options.js");
  const css = read("options.css");
  assert.match(source, /templateStatus\.dataset\.level/);
  assert.match(source, /className = "template-empty"/);
  assert.match(css, /#templateStatus\[data-level="error"\]/);
  assert.match(css, /\.template-list \.template-empty/);
});

test("settings navigation stays available during template operations", () => {
  const source = read("options.js");
  assert.match(source, /button:not\(\[data-section-link\]\):not\(#clearSearch\)/);
});
'''
ui = read("tests/ui.test.js")
if "template feedback and empty state remain explicit" not in ui:
    write("tests/ui.test.js", ui.rstrip() + ui_append)

print("Second premium UI review fixes applied")
