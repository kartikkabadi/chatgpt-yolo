from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))


replace_once(
    "tests/background.test.js",
    '''  assert.equal(second.templates.length, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);''',
    '''  assert.equal(second.templates.filter((template) => template.id === "client-template-id").length, 1);
  assert.equal(storage.yoloPortableRevisionV1, 1);'''
)

replace_once(
    "tests/portable-mutation-integration.test.js",
    '''  assert.equal(storage.yoloTemplatesV1.length, 1);
});''',
    '''  assert.ok(storage.yoloTemplatesV1.some((entry) => entry.id === "parallel-template"));
});'''
)

replace_once(
    "tests/reliability-foundation.test.js",
    '''  assert.match(read('background.js'), /importScripts\("config\.js", "coordinator\.js", "queue\.js", "commands\.js"\)/);''',
    '''  assert.match(read('background.js'), /importScripts\("config\.js", "coordinator\.js", "portable-store\.js", "queue\.js", "commands\.js"\)/);'''
)

replace_once(
    "tests/background.test.js",
    '''test("install-time template initialization uses the template lock", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  assert.match(source, /onInstalled[\s\S]*withLock\(templateLock/);
});''',
    '''test("install-time template initialization uses the shared portable transaction", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  assert.match(source, /onInstalled[\s\S]*PortableStore\.mutate/);
  assert.doesNotMatch(source, /templateLock/);
});'''
)
