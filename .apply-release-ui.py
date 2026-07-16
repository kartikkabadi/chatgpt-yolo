from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


replace_once(
    "popup.js",
    '''    button.textContent = label;
    button.title = title;
    button.className = className;''',
    '''    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.className = className;''',
)
replace_once(
    "popup.js",
    '''      actions.append(
        itemButton("↑", "Move up", () => reorderQueue(moveOrder(item.id, -1))),
        itemButton("↓", "Move down", () => reorderQueue(moveOrder(item.id, 1))),
        itemButton("Edit", "Edit message", () => beginEdit(item)),
        itemButton("×", "Remove message", () => removeItem(item.id), "danger")
      );''',
    '''      const moveUp = itemButton("↑", "Move up", () => reorderQueue(moveOrder(item.id, -1)));
      const moveDown = itemButton("↓", "Move down", () => reorderQueue(moveOrder(item.id, 1)));
      const edit = itemButton("Edit", "Edit message", () => beginEdit(item));
      const remove = itemButton("×", "Remove message", () => removeItem(item.id), "danger");
      moveUp.disabled = index === 0;
      moveDown.disabled = index === items.length - 1;
      actions.append(moveUp, moveDown, edit, remove);''',
)

replace_once(
    "options.js",
    '''    for (const button of document.querySelectorAll("button")) button.disabled = nextBusy;''',
    '''    for (const button of document.querySelectorAll("button:not([data-section-link]):not(#clearSearch)")) {
      button.disabled = nextBusy;
    }''',
)
replace_once(
    "options.js",
    '''    els.templateStatus.style.color = error ? "var(--danger)" : "var(--muted)";''',
    '''    els.templateStatus.dataset.level = error ? "error" : "info";''',
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
    for (const template of templates) {''',
)
replace_once(
    "options.js",
    '''  async function removeTemplate(templateId) {
    setBusy(true);''',
    '''  async function removeTemplate(templateId) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setBusy(true);''',
)
replace_once(
    "options.js",
    '''        if (editingTemplateId === templateId) cancelTemplateEdit();
        renderTemplates();
      } else setTemplateStatus(response?.reason || "Could not delete template.", true);''',
    '''        if (editingTemplateId === templateId) cancelTemplateEdit();
        renderTemplates();
        setTemplateStatus("Template deleted.");
      } else setTemplateStatus(response?.reason || "Could not delete template.", true);''',
)
replace_once(
    "options.js",
    '''  async function resetTemplates() {
    setBusy(true);''',
    '''  async function resetTemplates() {
    if (!window.confirm("Replace all templates with the built-in defaults?")) return;
    setBusy(true);''',
)
replace_once(
    "options.js",
    '''        renderTemplates();
        setTemplateStatus("Default templates restored.");
      }
    } finally {''',
    '''        renderTemplates();
        setTemplateStatus("Default templates restored.");
      } else {
        setTemplateStatus(response?.reason || "Could not restore default templates.", true);
      }
    } finally {''',
)
replace_once(
    "options.js",
    '''  els.resetDefaults.addEventListener("click", () => {
    const next = Config.normalizeSettings({ ...Config.DEFAULT_SETTINGS, enabled: settings.enabled });''',
    '''  els.resetDefaults.addEventListener("click", () => {
    if (!window.confirm("Restore every automation setting to its default value?")) return;
    const next = Config.normalizeSettings({ ...Config.DEFAULT_SETTINGS, enabled: settings.enabled });''',
)

replace_once(
    "package.json",
    '''node --check popup.js && node --check options.js"''',
    '''node --check popup.js && node --check options.js && node --check options-ui.js"''',
)

ui_tests = r'''

test("premium popup keeps one dominant action and progressive disclosure", () => {
  const popup = read("popup.html");
  assert.equal((popup.match(/class="primary-button"/g) || []).length, 1);
  assert.match(popup, /class="brand-lockup"/);
  assert.match(popup, /class="compose-panel"/);
  assert.match(popup, /class="queue-panel"/);
  assert.match(popup, /class="activity-panel"/);
  assert.match(popup, /id="advanced"[^>]*aria-label="Open Advanced settings"/);
});

test("advanced settings has searchable persistent section navigation", () => {
  const options = read("options.html");
  const links = [...options.matchAll(/data-section-link="([^"]+)"/g)].map((match) => match[1]);
  const sections = [...options.matchAll(/id="([^"]+)"[^>]*data-settings-section/g)].map((match) => match[1]);
  assert.deepEqual(links, ["overview", "queue", "approvals", "recovery", "nudges", "refresh", "safety", "templates", "data"]);
  assert.deepEqual(sections, links);
  assert.match(options, /id="settingsSearch"[^>]*type="search"/);
  assert.match(options, /id="searchEmpty"/);
  assert.match(options, /class="workspace-header"/);
  assert.match(options, /<script src="options-ui\.js"><\/script>/);
});

test("premium visual systems include focus, reduced motion, and responsive layouts", () => {
  const popupCss = read("styles.css");
  const optionsCss = read("options.css");
  for (const css of [popupCss, optionsCss]) {
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /--surface:/);
  }
  assert.match(optionsCss, /@media \(max-width: 680px\)/);
  assert.match(optionsCss, /position: sticky/);
});

test("settings controller provides filtering, active navigation, and save-state mapping", () => {
  const source = read("options-ui.js");
  assert.match(source, /sectionMatches/);
  assert.match(source, /aria-current/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /saveStateFor/);
});

test("queue item controls are explicitly named and respect reorder boundaries", () => {
  const source = read("popup.js");
  assert.match(source, /button\.setAttribute\("aria-label", title\)/);
  assert.match(source, /moveUp\.disabled = index === 0/);
  assert.match(source, /moveDown\.disabled = index === items\.length - 1/);
});

test("settings navigation preserves scope and respects reduced motion", () => {
  const source = read("options-ui.js");
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /win\.location\?\.search/);
  assert.match(source, /behavior: reducedMotion \? "auto" : "smooth"/);
});

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

test("destructive settings actions require confirmation and always report outcomes", () => {
  const source = read("options.js");
  assert.match(source, /Delete this template\? This cannot be undone/);
  assert.match(source, /Replace all templates with the built-in defaults/);
  assert.match(source, /Restore every automation setting to its default value/);
  assert.match(source, /Template deleted\./);
  assert.match(source, /Could not restore default templates/);
});
'''
if 'premium popup keeps one dominant action' not in read('tests/ui.test.js'):
    write('tests/ui.test.js', read('tests/ui.test.js').rstrip() + ui_tests)

print('Reviewed UI integration applied without replacing the command injection stack')
