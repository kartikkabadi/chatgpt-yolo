from pathlib import Path

path = Path("tests/commands.test.js")
text = path.read_text(encoding="utf-8")
old = '  assert.match(Commands.oneShotPrompt("handoff"), /does not claim that ChatGPT context was compacted/i);'
new = '  assert.match(Commands.oneShotPrompt("handoff"), /do not claim that ChatGPT context was compacted/i);'
if text.count(old) != 1:
    raise RuntimeError(f"Expected one stale handoff wording assertion, found {text.count(old)}")
path.write_text(text.replace(old, new), encoding="utf-8")
print("Handoff wording regression corrected")
