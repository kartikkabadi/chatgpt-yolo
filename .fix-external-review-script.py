from pathlib import Path

path = Path('.apply-command-external-review.py')
text = path.read_text(encoding='utf-8')
replacements = {
    "    '''  const MARKER_RE = /\\[YOLO:(CONTINUE|DONE|BLOCKED)\\]\\s*$/i;''',": "    r'''  const MARKER_RE = /\\[YOLO:(CONTINUE|DONE|BLOCKED)\\]\\s*$/i;''',",
    "    '''  const MARKER_RE = /(?:^|\\n)\\[YOLO:(CONTINUE|DONE|BLOCKED)\\][ \\t]*$/i;''',": "    r'''  const MARKER_RE = /(?:^|\\n)\\[YOLO:(CONTINUE|DONE|BLOCKED)\\][ \\t]*$/i;''',",
    "    '''  function normalizedMultilineText(element) {": "    r'''  function normalizedMultilineText(element) {",
    "    '''  assert.equal(Commands.evaluateResponse(\"[YOLO:DONE]\\nbut actually keep going\"), \"missing\");": "    r'''  assert.equal(Commands.evaluateResponse(\"[YOLO:DONE]\\nbut actually keep going\"), \"missing\");",
    "    '''  const adapter = { assistantSelectors: [\"assistant\"] };\n  assert.equal(Platforms.latestAssistantText(adapter, documentLike), \"latest response\\n[YOLO:CONTINUE]\");''',": "    r'''  const adapter = { assistantSelectors: [\"assistant\"] };\n  assert.equal(Platforms.latestAssistantText(adapter, documentLike), \"latest response\\n[YOLO:CONTINUE]\");''',",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one raw-string conversion, found {count}: {old[:80]!r}')
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
print('External review patch now preserves JavaScript escape sequences')
