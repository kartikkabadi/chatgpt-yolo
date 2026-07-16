from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new))


replace_once(
    "popup.js",
    '''    button.textContent = label;
    button.title = title;
    button.className = className;''',
    '''    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.className = className;'''
)

replace_once(
    "popup.js",
    '''      actions.append(
        itemButton("↑", "Move up", () => reorderQueue(moveOrder(item.id, -1))),
        itemButton("↓", "Move down", () => reorderQueue(moveOrder(item.id, 1))),
        itemButton("Edit", "Edit message", () => beginEdit(item)),
        itemButton("×", "Remove message", () => removeItem(item.id), "danger")
      );
      if (busy || item.state === "sending") {
        for (const button of actions.querySelectorAll("button")) button.disabled = true;
        drag.disabled = true;
      }''',
    '''      const moveUp = itemButton("↑", "Move up", () => reorderQueue(moveOrder(item.id, -1)));
      const moveDown = itemButton("↓", "Move down", () => reorderQueue(moveOrder(item.id, 1)));
      const edit = itemButton("Edit", "Edit message", () => beginEdit(item));
      const remove = itemButton("×", "Remove message", () => removeItem(item.id), "danger");
      moveUp.disabled = index === 0;
      moveDown.disabled = index === items.length - 1;
      actions.append(moveUp, moveDown, edit, remove);
      if (busy || item.state === "sending") {
        for (const button of actions.querySelectorAll("button")) button.disabled = true;
        drag.disabled = true;
      }'''
)

replace_once(
    "popup.html",
    '<span id="queueCount" class="queue-count">0 queued</span>',
    '<span id="queueCount" class="queue-count" aria-live="polite">0 queued</span>'
)
replace_once(
    "popup.html",
    '<div id="emptyQueue" class="empty-state">',
    '<div id="emptyQueue" class="empty-state" role="status">'
)

replace_once(
    "options-ui.js",
    '''    const saveState = doc.querySelector(".save-state");
    const links = Array.from(doc.querySelectorAll("[data-section-link]"));''',
    '''    const saveState = doc.querySelector(".save-state");
    const reducedMotion = Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const links = Array.from(doc.querySelectorAll("[data-section-link]"));'''
)
replace_once(
    "options-ui.js",
    '''      setActive(id);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      if (updateHash && win.history?.replaceState) win.history.replaceState(null, "", `#${id}`);''',
    '''      setActive(id);
      section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      if (updateHash && win.history?.replaceState) {
        const path = win.location?.pathname || "options.html";
        const query = win.location?.search || "";
        win.history.replaceState(null, "", `${path}${query}#${id}`);
      }'''
)

replace_once(
    "options.css",
    '''.save-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 13%, transparent); }
.save-state[data-state="saving"] .save-dot { background: var(--warning); }
.save-state[data-state="error"] .save-dot { background: var(--danger); }''',
    '''.save-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-faint) 13%, transparent); }
.save-state[data-state="saved"] .save-dot { background: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 13%, transparent); }
.save-state[data-state="saving"] .save-dot { background: var(--warning); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 13%, transparent); }
.save-state[data-state="error"] .save-dot { background: var(--danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 13%, transparent); }'''
)

ui_append = r'''

test("queue item controls are explicitly named and respect reorder boundaries", () => {
  const source = read("popup.js");
  assert.match(source, /button\.setAttribute\("aria-label", title\)/);
  assert.match(source, /moveUp\.disabled = index === 0/);
  assert.match(source, /moveDown\.disabled = index === items\.length - 1/);
});

test("settings navigation preserves scope and respects reduced motion", () => {
  const source = read("options-ui.js");
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /win\.location\?\.search/);
  assert.match(source, /behavior: reducedMotion \? "auto" : "smooth"/);
});
'''
ui = read("tests/ui.test.js")
if "respect reorder boundaries" not in ui:
    write("tests/ui.test.js", ui.rstrip() + ui_append)

print("First premium UI review fixes applied")
