((root, factory) => {
  const api = factory(root.YOLOCommands);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOCommandUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Commands) => {
  "use strict";

  const noop = () => {};

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function mount(options = {}) {
    if (!Commands || !document?.documentElement) return { destroy: noop, update: noop, open: noop, showStatus: noop };

    const callbacks = {
      execute: typeof options.execute === "function" ? options.execute : async () => ({ ok: false }),
      pause: typeof options.pause === "function" ? options.pause : noop,
      resume: typeof options.resume === "function" ? options.resume : noop,
      clear: typeof options.clear === "function" ? options.clear : noop,
      edit: typeof options.edit === "function" ? options.edit : noop,
      getComposer: typeof options.getComposer === "function" ? options.getComposer : () => null,
      getComposerText: typeof options.getComposerText === "function" ? options.getComposerText : () => "",
      setComposerText: typeof options.setComposerText === "function" ? options.setComposerText : noop
    };

    const host = document.createElement("div");
    host.id = "yolo-command-host";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483646";
    host.style.pointerEvents = "none";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      button, input { font: inherit; }
      .palette { position: fixed; width: min(560px, calc(100vw - 24px)); max-height: min(520px, calc(100vh - 32px)); overflow: hidden; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; background: rgba(24,24,27,.97); color: #f4f4f5; box-shadow: 0 24px 80px rgba(0,0,0,.45); backdrop-filter: blur(22px); pointer-events: auto; display: none; }
      .palette[data-open="true"] { display: block; }
      .search-row { display: flex; align-items: center; gap: 10px; padding: 13px 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
      .slash { color: #a1a1aa; font: 600 15px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .search { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: inherit; font: 500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .search::placeholder { color: #71717a; }
      .feedback { display: none; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,.08); color: #fca5a5; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .feedback[data-visible="true"] { display: block; }
      .escape { border: 1px solid rgba(255,255,255,.1); border-radius: 6px; padding: 2px 6px; color: #71717a; font: 600 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .list { max-height: 390px; overflow: auto; padding: 7px; }
      .empty { padding: 18px; color: #a1a1aa; text-align: center; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .item { width: 100%; display: grid; grid-template-columns: 114px minmax(0,1fr); gap: 12px; align-items: start; border: 0; border-radius: 10px; padding: 10px 11px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
      .item:hover, .item[data-active="true"] { background: rgba(255,255,255,.08); }
      .command { color: #fafafa; font: 600 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .meta { min-width: 0; }
      .title { font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .description { margin-top: 3px; color: #a1a1aa; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .footer { display: flex; justify-content: space-between; gap: 12px; padding: 9px 13px; border-top: 1px solid rgba(255,255,255,.08); color: #71717a; font: 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .workflow { position: fixed; display: none; width: min(720px, calc(100vw - 24px)); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: rgba(24,24,27,.95); color: #f4f4f5; box-shadow: 0 16px 48px rgba(0,0,0,.34); backdrop-filter: blur(18px); pointer-events: auto; padding: 10px 11px; }
      .workflow[data-visible="true"] { display: flex; align-items: center; gap: 10px; }
      .workflow-main { min-width: 0; flex: 1; }
      .workflow-top { display: flex; align-items: center; gap: 8px; }
      .badge { border-radius: 999px; padding: 3px 7px; background: rgba(255,255,255,.09); color: #d4d4d8; font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: .06em; }
      .workflow-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .workflow-sub { margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #a1a1aa; font: 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .actions { display: flex; align-items: center; gap: 5px; }
      .action { border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 6px 8px; background: rgba(255,255,255,.04); color: #e4e4e7; cursor: pointer; font: 600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .action:hover { background: rgba(255,255,255,.1); }
      .status { position: fixed; display: none; width: min(520px, calc(100vw - 24px)); border: 1px solid rgba(255,255,255,.12); border-radius: 15px; background: rgba(24,24,27,.98); color: #f4f4f5; box-shadow: 0 24px 80px rgba(0,0,0,.45); pointer-events: auto; padding: 14px; }
      .status[data-open="true"] { display: block; }
      .status-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .status-title { font: 700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .close { border: 0; background: transparent; color: #a1a1aa; cursor: pointer; font-size: 18px; line-height: 1; }
      .status-body { margin-top: 10px; display: grid; gap: 8px; }
      .status-row { display: grid; grid-template-columns: 120px minmax(0,1fr); gap: 12px; font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .status-key { color: #71717a; }
      .status-value { min-width: 0; overflow-wrap: anywhere; color: #d4d4d8; }
      @media (prefers-color-scheme: light) {
        .palette, .workflow, .status { border-color: rgba(0,0,0,.12); background: rgba(255,255,255,.97); color: #18181b; box-shadow: 0 24px 80px rgba(0,0,0,.18); }
        .item:hover, .item[data-active="true"] { background: rgba(0,0,0,.06); }
        .command, .workflow-title { color: #18181b; }
        .title, .status-value { color: #27272a; }
        .description, .workflow-sub, .status-key { color: #71717a; }
        .action { border-color: rgba(0,0,0,.1); background: rgba(0,0,0,.03); color: #27272a; }
      }
    `;
    shadow.appendChild(style);

    const palette = element("section", "palette");
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-label", "YOLO command palette");
    palette.dataset.open = "false";
    const searchRow = element("div", "search-row");
    searchRow.appendChild(element("span", "slash", "/"));
    const search = element("input", "search");
    search.type = "text";
    search.autocomplete = "off";
    search.spellcheck = false;
    search.setAttribute("aria-label", "Filter YOLO commands");
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-controls", "yolo-command-list");
    search.setAttribute("aria-expanded", "false");
    search.placeholder = "Type a command";
    searchRow.appendChild(search);
    searchRow.appendChild(element("span", "escape", "esc"));
    palette.appendChild(searchRow);
    const feedback = element("div", "feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.dataset.visible = "false";
    palette.appendChild(feedback);
    const list = element("div", "list");
    list.id = "yolo-command-list";
    list.setAttribute("role", "listbox");
    palette.appendChild(list);
    const footer = element("div", "footer");
    footer.appendChild(element("span", "", "↑↓ navigate · enter select"));
    footer.appendChild(element("span", "", "⌘⇧P commands"));
    palette.appendChild(footer);
    shadow.appendChild(palette);

    const workflow = element("section", "workflow");
    workflow.dataset.visible = "false";
    workflow.setAttribute("aria-live", "polite");
    const workflowMain = element("div", "workflow-main");
    const workflowTop = element("div", "workflow-top");
    const workflowBadge = element("span", "badge");
    const workflowTitle = element("div", "workflow-title");
    workflowTop.append(workflowBadge, workflowTitle);
    const workflowSub = element("div", "workflow-sub");
    workflowMain.append(workflowTop, workflowSub);
    const actions = element("div", "actions");
    const pauseButton = element("button", "action", "Pause");
    const editButton = element("button", "action", "Edit");
    const clearButton = element("button", "action", "Clear");
    pauseButton.type = editButton.type = clearButton.type = "button";
    actions.append(pauseButton, editButton, clearButton);
    workflow.append(workflowMain, actions);
    shadow.appendChild(workflow);

    const status = element("section", "status");
    status.dataset.open = "false";
    status.setAttribute("role", "dialog");
    status.setAttribute("aria-label", "YOLO status");
    const statusHead = element("div", "status-head");
    statusHead.appendChild(element("div", "status-title", "YOLO status"));
    const statusClose = element("button", "close", "×");
    statusClose.type = "button";
    statusClose.setAttribute("aria-label", "Close status");
    statusHead.appendChild(statusClose);
    const statusBody = element("div", "status-body");
    status.append(statusHead, statusBody);
    shadow.appendChild(status);

    let open = false;
    let selectedIndex = 0;
    let results = [...Commands.COMMANDS];
    let argumentCommand = null;
    let currentWorkflow = Commands.freshWorkflow();
    let workflowActionInFlight = false;
    let destroyed = false;

    function isComposerTarget(target) {
      const composer = callbacks.getComposer();
      return Boolean(composer && (target === composer || composer.contains?.(target)));
    }

    function position() {
      if (destroyed) return;
      const composer = callbacks.getComposer();
      const rect = composer?.getBoundingClientRect?.();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const width = Math.min(560, viewportWidth - 24);
      const left = rect ? Math.max(12, Math.min(rect.left, viewportWidth - width - 12)) : Math.max(12, (viewportWidth - width) / 2);
      const paletteHeight = Math.min(520, viewportHeight - 32);
      const preferredTop = rect ? rect.top - Math.min(430, paletteHeight) - 10 : Math.max(16, (viewportHeight - paletteHeight) / 2);
      palette.style.left = `${left}px`;
      palette.style.top = `${Math.max(12, preferredTop)}px`;

      const workflowWidth = Math.min(720, viewportWidth - 24);
      const workflowLeft = rect ? Math.max(12, Math.min(rect.left, viewportWidth - workflowWidth - 12)) : Math.max(12, (viewportWidth - workflowWidth) / 2);
      workflow.style.left = `${workflowLeft}px`;
      workflow.style.bottom = rect ? `${Math.max(12, viewportHeight - rect.top + 10)}px` : "96px";

      status.style.left = `${Math.max(12, (viewportWidth - Math.min(520, viewportWidth - 24)) / 2)}px`;
      status.style.top = `${Math.max(12, viewportHeight * 0.16)}px`;
    }

    function renderList() {
      list.replaceChildren();
      results = argumentCommand ? [argumentCommand] : Commands.filterCommands(search.value);
      selectedIndex = Math.max(0, Math.min(selectedIndex, results.length - 1));
      if (!results.length) {
        search.removeAttribute("aria-activedescendant");
        list.appendChild(element("div", "empty", "No matching YOLO command"));
        return;
      }
      const selectedId = `yolo-command-option-${results[selectedIndex].name}`;
      search.setAttribute("aria-activedescendant", selectedId);
      results.forEach((entry, index) => {
        const button = element("button", "item");
        button.id = `yolo-command-option-${entry.name}`;
        button.type = "button";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === selectedIndex));
        button.dataset.active = String(index === selectedIndex);
        const command = element("span", "command", `/${entry.name}`);
        const meta = element("span", "meta");
        const title = element("div", "title", entry.title);
        const description = element("div", "description", argumentCommand
          ? `${entry.description} ${entry.args ? `Expected: ${entry.args}` : ""}`.trim()
          : entry.description);
        meta.append(title, description);
        button.append(command, meta);
        button.addEventListener("mouseenter", () => {
          selectedIndex = index;
          renderList();
        });
        button.addEventListener("click", () => select(entry));
        list.appendChild(button);
      });
    }

    function resetPalette() {
      argumentCommand = null;
      feedback.textContent = "";
      feedback.dataset.visible = "false";
      search.value = "";
      search.placeholder = "Type a command";
      selectedIndex = 0;
      renderList();
    }

    function openPalette(initial = "") {
      if (destroyed) return;
      status.dataset.open = "false";
      open = true;
      palette.dataset.open = "true";
      search.setAttribute("aria-expanded", "true");
      argumentCommand = null;
      search.value = String(initial || "").replace(/^\//, "");
      search.placeholder = "Type a command";
      selectedIndex = 0;
      renderList();
      position();
      window.setTimeout(() => {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      }, 0);
    }

    function closePalette({ restoreComposer = true } = {}) {
      if (!open) return;
      open = false;
      palette.dataset.open = "false";
      search.setAttribute("aria-expanded", "false");
      resetPalette();
      search.removeAttribute("aria-activedescendant");
      if (restoreComposer) callbacks.getComposer()?.focus?.();
    }

    function showFeedback(message) {
      feedback.textContent = String(message || "");
      feedback.dataset.visible = String(Boolean(message));
    }

    async function run(entry, args = "", { originalComposerText = "" } = {}) {
      if (!entry || search.disabled) return { ok: false };
      search.disabled = true;
      showFeedback("");
      try {
        const result = await callbacks.execute(entry.name, args);
        if (!result?.ok) {
          showFeedback(result?.reason || `/${entry.name} could not run`);
          if (originalComposerText) {
            callbacks.setComposerText(originalComposerText);
            callbacks.getComposer()?.focus?.();
          }
          return result || { ok: false };
        }
        if (!result.keepOpen) closePalette({ restoreComposer: result.focusComposer !== false });
        return result;
      } catch (error) {
        const reason = String(error?.message || error || `/${entry.name} failed`);
        showFeedback(reason);
        if (originalComposerText) callbacks.setComposerText(originalComposerText);
        return { ok: false, reason };
      } finally {
        search.disabled = false;
      }
    }

    function select(entry) {
      if (!entry) return;
      if (Commands.requiresArgs(entry.name) && !argumentCommand) {
        argumentCommand = entry;
        search.value = "";
        search.placeholder = entry.args;
        selectedIndex = 0;
        renderList();
        search.focus();
        return;
      }
      run(entry, argumentCommand ? search.value : "");
    }

    function showStatus(data = {}) {
      closePalette({ restoreComposer: false });
      statusBody.replaceChildren();
      for (const [key, value] of Object.entries(data)) {
        const row = element("div", "status-row");
        row.append(element("div", "status-key", key), element("div", "status-value", String(value ?? "")));
        statusBody.appendChild(row);
      }
      status.dataset.open = "true";
      position();
      statusClose.focus();
    }

    function update(next = {}) {
      currentWorkflow = Commands.normalizeWorkflow(next.workflow);
      const visible = currentWorkflow.status !== "idle";
      workflow.dataset.visible = String(visible);
      if (!visible) return;
      workflowBadge.textContent = currentWorkflow.kind;
      workflowTitle.textContent = currentWorkflow.objective;
      const waiting = currentWorkflow.pendingItemId ? "queued" : (currentWorkflow.awaitingResponse ? "waiting for response" : currentWorkflow.status);
      workflowSub.textContent = `${waiting} · iteration ${currentWorkflow.iteration}/${currentWorkflow.maxIterations}${currentWorkflow.reason ? ` · ${currentWorkflow.reason}` : ""}`;
      pauseButton.textContent = ["paused", "blocked"].includes(currentWorkflow.status) ? "Resume" : "Pause";
      const actionable = ["running", "paused", "blocked"].includes(currentWorkflow.status);
      pauseButton.disabled = workflowActionInFlight || !actionable;
      editButton.disabled = workflowActionInFlight || !actionable;
      clearButton.disabled = workflowActionInFlight;
      position();
    }

    function keydown(event) {
      if (destroyed || event.isComposing) return;
      const composerTarget = isComposerTarget(event.target);
      const commandShortcut = (event.metaKey || event.ctrlKey)
        && ((event.shiftKey && event.key.toLowerCase() === "p") || (composerTarget && event.key.toLowerCase() === "k"));
      if (commandShortcut) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPalette();
        return;
      }

      if (composerTarget) {
        const composerText = callbacks.getComposerText();
        if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !composerText.trim()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openPalette();
          return;
        }
        if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const invocation = Commands.parseInvocation(composerText);
          if (invocation) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const originalComposerText = composerText;
            callbacks.setComposerText("");
            run(invocation.command, invocation.args, { originalComposerText });
            return;
          }
        }
      }

      if (!open) {
        if (event.key === "Escape" && status.dataset.open === "true") {
          event.preventDefault();
          status.dataset.open = "false";
          callbacks.getComposer()?.focus?.();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectedIndex = results.length ? (selectedIndex + 1) % results.length : 0;
        renderList();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selectedIndex = results.length ? (selectedIndex - 1 + results.length) % results.length : 0;
        renderList();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (argumentCommand) run(argumentCommand, search.value);
        else select(results[selectedIndex]);
      }
    }

    search.addEventListener("input", () => {
      selectedIndex = 0;
      renderList();
    });
    statusClose.addEventListener("click", () => {
      status.dataset.open = "false";
      callbacks.getComposer()?.focus?.();
    });
    async function runWorkflowAction(action) {
      if (workflowActionInFlight) return;
      workflowActionInFlight = true;
      pauseButton.disabled = true;
      editButton.disabled = true;
      clearButton.disabled = true;
      try {
        const result = await action();
        if (result && result.ok === false && result.reason) workflowSub.textContent = result.reason;
      } finally {
        workflowActionInFlight = false;
        update({ workflow: currentWorkflow });
      }
    }

    pauseButton.addEventListener("click", () => runWorkflowAction(() =>
      ["paused", "blocked"].includes(currentWorkflow.status) ? callbacks.resume() : callbacks.pause()));
    editButton.addEventListener("click", () => callbacks.edit(currentWorkflow));
    clearButton.addEventListener("click", () => runWorkflowAction(() => callbacks.clear(currentWorkflow)));

    document.addEventListener("keydown", keydown, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const positionTimer = window.setInterval(position, 1000);
    renderList();
    position();

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener("keydown", keydown, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.clearInterval(positionTimer);
      host.remove();
    }

    return Object.freeze({
      destroy,
      update,
      open: openPalette,
      close: closePalette,
      showStatus,
      reposition: position
    });
  }

  return Object.freeze({ mount });
});
