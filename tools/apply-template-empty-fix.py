from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "background.js",
    '''  const raw = stored[Config.STORAGE_KEYS.templates];
  const source = Array.isArray(raw) && raw.length ? raw : Config.DEFAULT_TEMPLATES;
  const templates = source.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  return templates.length ? templates : Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate(template));''',
    '''  const raw = stored[Config.STORAGE_KEYS.templates];
  if (Array.isArray(raw)) {
    return raw.map((template) => normalizeTemplate(template)).filter(Boolean).slice(0, 50);
  }
  return Config.DEFAULT_TEMPLATES.map((template) => normalizeTemplate(template));''',
)

test_path = Path("tests/background.test.js")
test_source = test_path.read_text(encoding="utf-8")
addition = r'''

test("an intentionally empty template library remains empty", async () => {
  const { invoke, storage } = loadBackground();
  storage.yoloTemplatesV1 = [];
  const response = await invoke({ type: "YOLO_TEMPLATES_GET" });
  assert.equal(response.ok, true);
  assert.deepEqual(response.templates, []);
});
'''
if "intentionally empty template library remains empty" not in test_source:
    test_path.write_text(test_source.rstrip() + addition, encoding="utf-8")

print("Template empty-state persistence fixed")
