from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:160]!r}")
    write(path, content.replace(old, new))


replace_once(
    "options.js",
    '''  let templates = [];
  let editingTemplateId = "";
  let saveTimer = null;''',
    '''  let templates = [];
  let editingTemplateId = "";
  let pendingTemplateId = "";
  let saveTimer = null;'''
)

replace_once(
    "options.js",
    '''  function beginTemplateEdit(template) {
    editingTemplateId = template.id;
    els.templateName.value = template.name;''',
    '''  function beginTemplateEdit(template) {
    editingTemplateId = template.id;
    pendingTemplateId = "";
    els.templateName.value = template.name;'''
)

replace_once(
    "options.js",
    '''  function cancelTemplateEdit() {
    editingTemplateId = "";
    els.templateName.value = "";''',
    '''  function cancelTemplateEdit() {
    editingTemplateId = "";
    pendingTemplateId = "";
    els.templateName.value = "";'''
)

replace_once(
    "options.js",
    '''    setBusy(true);
    try {
      const response = await sendBackground(editingTemplateId
        ? { type: "YOLO_TEMPLATE_UPDATE", template: { id: editingTemplateId, name, text } }
        : { type: "YOLO_TEMPLATE_ADD", template: { id: crypto.randomUUID(), name, text } });
      if (!response?.ok) {
        setTemplateStatus(response?.reason || "Could not save template.", true);
        return;
      }
      templates = response.templates;''',
    '''    const adding = !editingTemplateId;
    if (adding && !pendingTemplateId) pendingTemplateId = crypto.randomUUID();
    setBusy(true);
    try {
      let response = await sendBackground(adding
        ? { type: "YOLO_TEMPLATE_ADD", template: { id: pendingTemplateId, name, text } }
        : { type: "YOLO_TEMPLATE_UPDATE", template: { id: editingTemplateId, name, text } });
      if (response?.ok && adding && response.deduplicated
        && (response.template?.name !== name || response.template?.text !== text)) {
        response = await sendBackground({
          type: "YOLO_TEMPLATE_UPDATE",
          template: { id: pendingTemplateId, name, text }
        });
      }
      if (!response?.ok) {
        setTemplateStatus(response?.reason || "Could not save template.", true);
        return;
      }
      templates = response.templates;'''
)

replace_once(
    "tests/portability-integration.test.js",
    '''test("template creation carries a stable client id for idempotency", () => {
  assert.match(read("options.js"), /YOLO_TEMPLATE_ADD[\s\S]*id: crypto\.randomUUID\(\)/);
});''',
    '''test("template creation carries a stable client id for idempotency", () => {
  const options = read("options.js");
  assert.match(options, /pendingTemplateId = crypto\.randomUUID\(\)/);
  assert.match(options, /YOLO_TEMPLATE_ADD[\s\S]*id: pendingTemplateId/);
});'''
)

write("tests/portability-integration.test.js", read("tests/portability-integration.test.js").rstrip() + r'''

test("template add retries preserve one mutation id and reconcile edited retries", () => {
  const options = read("options.js");
  assert.match(options, /let pendingTemplateId = ""/);
  assert.match(options, /if \(adding && !pendingTemplateId\) pendingTemplateId = crypto\.randomUUID\(\)/);
  assert.match(options, /YOLO_TEMPLATE_ADD[\s\S]*id: pendingTemplateId/);
  assert.match(options, /response\.deduplicated[\s\S]*YOLO_TEMPLATE_UPDATE[\s\S]*id: pendingTemplateId/);
});
''')
