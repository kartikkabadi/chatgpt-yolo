from pathlib import Path

root = Path(__file__).resolve().parents[1]
patcher = root / "scripts/apply-queue-readiness-fix.py"
text = patcher.read_text()

replacements = [
    (
        "  function checkSafeForInput() {",
        "  function checkSafeForInput(workflow = workflowHealth()) {",
    ),
    (
        "    const workflow = workflowHealth();\n    return Lifecycle.inputSafety({",
        "    return Lifecycle.inputSafety({",
    ),
    (
        "  function safeForInput() {\n    return checkSafeForInput().safe;\n  }",
        "  function safeForInput() {\n    const workflow = workflowHealth();\n    if (workflow.awaitingResponse) return false;\n    return checkSafeForInput(workflow).safe;\n  }",
    ),
    (
        "  assert.match(source, /function checkSafeForInput\\(\\)/);",
        "  assert.match(source, /function checkSafeForInput\\(workflow = workflowHealth\\(\\)\\)/);",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"expected exactly one patch-script match, found {count}: {old[:80]}")
    text = text.replace(old, new, 1)

patcher.write_text(text)
Path(__file__).unlink()
