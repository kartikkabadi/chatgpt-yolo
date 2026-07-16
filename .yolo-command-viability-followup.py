from pathlib import Path

path = Path("tests/ui.test.js")
text = path.read_text(encoding="utf-8")
old = '  assert.match(commands, /Goal response omitted the required terminal control marker/);'
new = '  assert.match(commands, /response omitted the required terminal control marker/);'
if text.count(old) != 1:
    raise RuntimeError(f"Expected one stale goal-only marker assertion, found {text.count(old)}")
path.write_text(text.replace(old, new), encoding="utf-8")
print("Shared workflow marker regression aligned")
