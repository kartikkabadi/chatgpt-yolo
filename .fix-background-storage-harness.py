from pathlib import Path

path = Path("tests/background.test.js")
text = path.read_text(encoding="utf-8")
old = '''          get(keys, callback) {
            const list = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]])));
          },'''
new = '''          get(keys, callback) {
            if (keys === null) {
              callback({ ...storage });
              return;
            }
            const list = Array.isArray(keys) ? keys : [keys];
            callback(Object.fromEntries(list.filter((key) => key in storage).map((key) => [key, storage[key]])));
          },'''
if text.count(old) != 1:
    raise RuntimeError("Expected one fake storage get implementation")
path.write_text(text.replace(old, new), encoding="utf-8")
print("Background storage harness now supports get(null)")
