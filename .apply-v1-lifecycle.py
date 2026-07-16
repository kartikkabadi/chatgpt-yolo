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


replace_once("config.js", '  const VERSION = "0.7.0";', '  const VERSION = "1.0.0";')

replace_once(
    "background.js",
    '''chrome.runtime.onInstalled.addListener(() => {
  withLock(templateLock, async () => writeTemplates(await readTemplates())).catch(() => {});
});''',
    '''chrome.runtime.onInstalled.addListener((details) => {
  withLock(templateLock, async () => writeTemplates(await readTemplates())).catch(() => {});
  if (details?.reason === "install") {
    chrome.tabs?.create?.({ url: chrome.runtime.getURL("onboarding.html") });
  }
});''',
)

background_test = r'''

test("fresh installs open only the local onboarding page", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  assert.match(source, /details\?\.reason === "install"/);
  assert.match(source, /chrome\.runtime\.getURL\("onboarding\.html"\)/);
  assert.doesNotMatch(source, /reason === "update"[^\n]*tabs/);
});
'''
if 'fresh installs open only the local onboarding page' not in read('tests/background.test.js'):
    write('tests/background.test.js', read('tests/background.test.js').rstrip() + background_test)

manifest_test = r'''

test("public v1 metadata and permissions stay intentionally narrow", () => {
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.homepage_url, "https://github.com/kartikkabadi/chatgpt-yolo");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  assert.equal(manifest.minimum_chrome_version, "114");
});
'''
if 'public v1 metadata and permissions stay intentionally narrow' not in read('tests/manifest.test.js'):
    write('tests/manifest.test.js', read('tests/manifest.test.js').rstrip() + manifest_test)

print('v1 version and first-install lifecycle wired')
