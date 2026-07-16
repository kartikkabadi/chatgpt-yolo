from pathlib import Path

path = Path('tests/background.test.js')
text = path.read_text(encoding='utf-8')
old = '  assert.equal(cleared.workflow.revision, claimed.workflow.revision + 1);'
new = '''  assert.equal(cleared.workflow.revision, 0);
  const afterClear = await invoke({ type: "YOLO_WORKFLOW_GET", pageId }, sender);
  assert.equal(afterClear.workflow.status, "idle");
  assert.equal(afterClear.workflow.revision, 0);'''
if text.count(old) != 1:
    raise RuntimeError('Expected one tombstone revision assertion')
path.write_text(text.replace(old, new), encoding='utf-8')
print('Workflow clear regression now asserts key removal and fresh state')
