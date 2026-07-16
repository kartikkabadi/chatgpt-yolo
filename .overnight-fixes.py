from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:180]!r}")
    write(path, content.replace(old, new))


replace_once(
    "content.js",
    '''  const Config = globalThis.YOConfig || globalThis.YOLOConfig;''',
    '''  const Config = globalThis.YOLOConfig;'''
)

for path in ["popup.js", "options.js"]:
    replace_once(
        path,
        '''files: ["config.js", "platforms.js", "commands.js", "command-ui.js", "content.js", "command-runtime.js"]''',
        '''files: ["config.js", "lifecycle.js", "platforms.js", "commands.js", "command-ui.js", "content.js", "command-runtime.js"]'''
    )

replace_once(
    "tests/ui.test.js",
    '''  assert.match(runtime, /RESPONSE_STABLE_MS/);''',
    '''  assert.match(runtime, /Lifecycle\.responseStableMs\(outcome\)/);'''
)
replace_once(
    "tests/ui.test.js",
    '''  const expected = '["config.js", "platforms.js", "commands.js", "command-ui.js", "content.js", "command-runtime.js"]';''',
    '''  const expected = '["config.js", "lifecycle.js", "platforms.js", "commands.js", "command-ui.js", "content.js", "command-runtime.js"]';'''
)
