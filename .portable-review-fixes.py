from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:140]!r}")
    write(path, content.replace(old, new))


replace_once(
    "background.js",
    '''    const requestedId = String(message.template?.id || Queue.makeId("template")).trim().slice(0, 180);
    const existing = templates.find((template) => template.id === requestedId);''',
    '''    const requestedId = String(message.template?.id || "").trim().slice(0, 180);
    if (!requestedId) return { ok: false, reason: "Template identifier is required", code: "template.id_required" };
    const existing = templates.find((template) => template.id === requestedId);'''
)

replace_once(
    "content.js",
    '''      const pageKey = Config.pageSettingsKey(state.pageId);
      const settingsChanged = Object.prototype.hasOwnProperty.call(changes, Config.STORAGE_KEYS.global)
        || Object.prototype.hasOwnProperty.call(changes, Config.STORAGE_KEYS.pages)
        || Object.prototype.hasOwnProperty.call(changes, pageKey);
      if (settingsChanged) {
        storageGet([Config.STORAGE_KEYS.global, Config.STORAGE_KEYS.pages, pageKey]).then((stored) => {
          if (state.destroyed) return;
          const globalSettings = stored[Config.STORAGE_KEYS.global] || {};
          const legacyPageSettings = stored[Config.STORAGE_KEYS.pages]?.[state.pageId] || {};
          const pageSettings = stored[pageKey] || legacyPageSettings;
          state.settings = Config.mergeSettings(Config.DEFAULT_SETTINGS, globalSettings, pageSettings);''',
    '''      const settingsPageId = state.pageId;
      const pageKey = Config.pageSettingsKey(settingsPageId);
      const settingsChanged = Object.prototype.hasOwnProperty.call(changes, Config.STORAGE_KEYS.global)
        || Object.prototype.hasOwnProperty.call(changes, Config.STORAGE_KEYS.pages)
        || Object.prototype.hasOwnProperty.call(changes, pageKey);
      if (settingsChanged) {
        storageGet([Config.STORAGE_KEYS.global, Config.STORAGE_KEYS.pages, pageKey]).then((stored) => {
          if (state.destroyed || state.pageId !== settingsPageId || currentPageId() !== settingsPageId) return;
          const globalSettings = stored[Config.STORAGE_KEYS.global] || {};
          const legacyPageSettings = stored[Config.STORAGE_KEYS.pages]?.[settingsPageId] || {};
          const pageSettings = stored[pageKey] || legacyPageSettings;
          state.settings = Config.mergeSettings(Config.DEFAULT_SETTINGS, globalSettings, pageSettings);'''
)

write("tests/background.test.js", read("tests/background.test.js").rstrip() + r'''

test("template additions require a stable client mutation id", async () => {
  const { invoke, storage } = loadBackground();
  const response = await invoke({
    type: "YOLO_TEMPLATE_ADD",
    template: { name: "Missing id", text: "must not mutate" }
  });
  assert.equal(response.ok, false);
  assert.equal(response.code, "template.id_required");
  assert.equal(storage.yoloPortableRevisionV1, undefined);
  assert.equal(storage.yoloTemplatesV1, undefined);
});
''')

write("tests/portability-integration.test.js", read("tests/portability-integration.test.js").rstrip() + r'''

test("asynchronous settings reloads are bound to the route that initiated them", () => {
  const content = read("content.js");
  assert.match(content, /const settingsPageId = state\.pageId/);
  assert.match(content, /state\.pageId !== settingsPageId \|\| currentPageId\(\) !== settingsPageId/);
  assert.match(content, /legacyPageSettings = stored\[Config\.STORAGE_KEYS\.pages\]\?\.\[settingsPageId\]/);
});
''')
