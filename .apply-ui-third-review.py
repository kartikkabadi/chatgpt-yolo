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
    '''  async function removeTemplate(templateId) {
    setBusy(true);''',
    '''  async function removeTemplate(templateId) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setBusy(true);'''
)
replace_once(
    "options.js",
    '''        if (editingTemplateId === templateId) cancelTemplateEdit();
        renderTemplates();
      } else setTemplateStatus(response?.reason || "Could not delete template.", true);''',
    '''        if (editingTemplateId === templateId) cancelTemplateEdit();
        renderTemplates();
        setTemplateStatus("Template deleted.");
      } else setTemplateStatus(response?.reason || "Could not delete template.", true);'''
)
replace_once(
    "options.js",
    '''  async function resetTemplates() {
    setBusy(true);''',
    '''  async function resetTemplates() {
    if (!window.confirm("Replace all templates with the built-in defaults?")) return;
    setBusy(true);'''
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
    } finally {'''
)
replace_once(
    "options.js",
    '''  els.resetDefaults.addEventListener("click", () => {
    const next = Config.normalizeSettings({ ...Config.DEFAULT_SETTINGS, enabled: settings.enabled });''',
    '''  els.resetDefaults.addEventListener("click", () => {
    if (!window.confirm("Restore every automation setting to its default value?")) return;
    const next = Config.normalizeSettings({ ...Config.DEFAULT_SETTINGS, enabled: settings.enabled });'''
)

ui_append = r'''

test("destructive settings actions require confirmation and always report outcomes", () => {
  const source = read("options.js");
  assert.match(source, /Delete this template\? This cannot be undone/);
  assert.match(source, /Replace all templates with the built-in defaults/);
  assert.match(source, /Restore every automation setting to its default value/);
  assert.match(source, /Template deleted\./);
  assert.match(source, /Could not restore default templates/);
});
'''
ui = read("tests/ui.test.js")
if "destructive settings actions require confirmation" not in ui:
    write("tests/ui.test.js", ui.rstrip() + ui_append)

print("Third premium UI review fixes applied")
