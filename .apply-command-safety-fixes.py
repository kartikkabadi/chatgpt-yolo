from pathlib import Path

ROOT = Path(__file__).resolve().parent


def replace_once(path, old, new):
    target = ROOT / path
    content = target.read_text(encoding="utf-8")
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    target.write_text(content.replace(old, new), encoding="utf-8")


# Document capture already receives palette key events; a second input listener
# would advance selection or execute commands twice.
replace_once(
    "command-ui.js",
    '    search.addEventListener("keydown", keydown);\n',
    "",
)

# Pending workflow prompts must be removed when the workflow is paused or
# cleared so they cannot send after the user has stopped the workflow.
replace_once(
    "command-runtime.js",
    '''  async function setStatus(status, reason) {
    if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop" };
    state.workflow = Commands.setWorkflowStatus(state.workflow, status, reason, now());''',
    '''  async function cancelPendingWorkflowPrompt(workflow = state.workflow) {
    if (!workflow.pendingItemId) return true;
    const response = await backgroundSend({
      type: "YOLO_QUEUE_REMOVE",
      pageId: state.pageId,
      itemId: workflow.pendingItemId
    });
    return Boolean(response?.ok || response?.code === "queue.sending" || response?.code === "queue.not_found");
  }

  async function setStatus(status, reason) {
    if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop" };
    if (status === "paused") await cancelPendingWorkflowPrompt(state.workflow);
    state.workflow = Commands.setWorkflowStatus(state.workflow, status, reason, now());''',
)
replace_once(
    "command-runtime.js",
    '''    if (name === "clear") {
      if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop" };
      if (!window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) return { ok: false, keepOpen: true };
      const ok = await clearWorkflow();''',
    '''    if (name === "clear") {
      if (state.workflow.status === "idle") return { ok: false, reason: "No active goal or loop" };
      if (!window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) return { ok: false, keepOpen: true };
      await cancelPendingWorkflowPrompt(state.workflow);
      const ok = await clearWorkflow();''',
)
replace_once(
    "command-runtime.js",
    '''      clear: async () => {
        if (state.workflow.status !== "idle" && window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) await clearWorkflow();
      },''',
    '''      clear: async () => {
        if (state.workflow.status !== "idle" && window.confirm(`Clear the active ${state.workflow.kind} workflow?`)) {
          await cancelPendingWorkflowPrompt(state.workflow);
          await clearWorkflow();
        }
      },''',
)

print("Command lifecycle safety fixes applied")
