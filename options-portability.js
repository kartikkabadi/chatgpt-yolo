((root, factory) => {
  const Shared = typeof module === "object" && module.exports ? require("./shared.js") : root.YOLOShared;
  const api = factory(root.YOLOPortability, Shared);
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.YOLOOptionsPortability = api;
    if (typeof document !== "undefined" && !document.querySelector("#exportBackup")) api.mount(document, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (Portability,Shared) => {
  "use strict";

  function importConfirmation(summary) {
    return [
      "Import this YOLO backup?",
      "",
      `${summary.conversations} conversation setting${summary.conversations === 1 ? "" : "s"}`,
      `${summary.templates} template${summary.templates === 1 ? "" : "s"}`,
      "",
      "Active queues and goals will not be changed."
    ].join("\n");
  }

  function existingControls(doc) {
    const exportButton = doc.querySelector("#exportBackup");
    if (!exportButton) return null;
    return {
      exportButton,
      importButton: doc.querySelector("#importBackup"),
      importInput: doc.querySelector("#importBackupFile"),
      diagnosticsButton: doc.querySelector("#copyDiagnostics"),
      status: doc.querySelector("#dataPortabilityStatus")
    };
  }

  function buildControls(doc) {
    const existing = existingControls(doc);
    if (existing) return existing;
    const section = doc.querySelector("#data");
    if (!section) return null;
    section.dataset.searchText = `${section.dataset.searchText || ""} backup export import diagnostics privacy`.trim();

    const card = doc.createElement("div");
    card.className = "settings-card";
    const rows = [
      ["Export backup", "Download settings and templates. Active queues and goals are excluded.", "exportBackup", "Export JSON"],
      ["Import backup", "Validate and restore settings and templates without touching live automation.", "importBackup", "Choose file"],
      ["Copy diagnostics", "Copy versions, feature state, counts, and error codes—never prompt or conversation text.", "copyDiagnostics", "Copy diagnostics"]
    ];

    for (const [title, description, id, label] of rows) {
      const row = doc.createElement("div");
      row.className = "setting-row";
      const copy = doc.createElement("span");
      copy.className = "control-copy";
      const strong = doc.createElement("strong");
      strong.textContent = title;
      const small = doc.createElement("small");
      small.textContent = description;
      copy.append(strong, small);
      const button = doc.createElement("button");
      button.id = id;
      button.className = "secondary-button";
      button.type = "button";
      button.textContent = label;
      row.append(copy, button);
      card.append(row);
    }

    const input = doc.createElement("input");
    input.id = "importBackupFile";
    input.type = "file";
    input.accept = "application/json,.json";
    input.hidden = true;
    const status = doc.createElement("p");
    status.id = "dataPortabilityStatus";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.style.minHeight = "20px";
    status.style.margin = "0";
    status.style.padding = "10px 16px";
    card.append(input, status);

    const danger = section.querySelector(".danger-card");
    section.insertBefore(card, danger || null);
    const SearchEvent = doc.defaultView?.Event;
    if (SearchEvent) doc.querySelector("#settingsSearch")?.dispatchEvent(new SearchEvent("input", { bubbles: true }));
    return existingControls(doc);
  }

  function mount(doc = document, win = window) {
    if (!Portability) return { destroy() {} };
    const controls = buildControls(doc);
    if (!controls || Object.values(controls).some((value) => !value)) return { destroy() {} };
    const { exportButton, importButton, importInput, diagnosticsButton, status } = controls;
    let busy = false;
    const params = new URLSearchParams(win.location?.search || "");
    const initialSourceTabId = Number(params.get("tabId")) || 0;
    const initialPageId = String(params.get("pageId") || "");

    function currentContext() {
      const shared = win.YOLOOptionsController?.getContext?.() || {};
      return {
        sourceTabId: Number(shared.sourceTabId) || initialSourceTabId,
        pageId: String(shared.pageId || initialPageId || "")
      };
    }

    const backgroundSend = (message) => Shared.sendMessage(message, { soft: true });
    const contentSend = (message) => new Promise((resolve) => {
      const { sourceTabId } = currentContext();
      if (!sourceTabId) return resolve(null);
      chrome.tabs.sendMessage(sourceTabId, message, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response || null);
      });
    });

    function setStatus(message = "", level = "info") {
      status.textContent = message;
      status.dataset.level = level;
      status.style.color = level === "error"
        ? "var(--danger)"
        : level === "success"
          ? "var(--success)"
          : level === "warning"
            ? "var(--warning)"
            : "var(--muted)";
    }
    async function setBusy(next) {
      busy = next;
      exportButton.disabled = next;
      importButton.disabled = next;
      diagnosticsButton.disabled = next;
      const controller = win.YOLOOptionsController;
      if (next) await controller?.beginExternalMutation?.();
      else controller?.endExternalMutation?.();
    }
    function downloadJson(value) {
      const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = `yolo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      win.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    async function copyText(text) {
      if (win.navigator?.clipboard?.writeText) return win.navigator.clipboard.writeText(text);
      const textarea = doc.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      doc.body.append(textarea);
      textarea.select();
      const copied = Boolean(doc.execCommand?.("copy"));
      textarea.remove();
      if (!copied) throw new Error("Clipboard access is unavailable");
    }

    async function exportBackup() {
      if (busy) return;
      await setBusy(true);
      setStatus("Preparing backup…");
      try {
        const response = await backgroundSend({ type: "YOLODATA_EXPORT" });
        if (!response?.ok) throw new Error(response?.reason || "Could not export YOLO data");
        downloadJson(response.backup);
        setStatus(`Backup downloaded · ${response.summary.conversations} conversations · ${response.summary.templates} templates`, "success");
      } catch (error) { setStatus(Shared.errorMessage(error), "error"); }
      finally { await setBusy(false); }
    }

    async function importBackup(file) {
      if (!file || busy) return;
      if (file.size > Portability.MAX_BACKUP_BYTES) return setStatus("Backup file exceeds 1 MiB", "error");
      let applied = false;
      await setBusy(true);
      setStatus("Validating backup…");
      try {
        const text = await file.text();
        const normalized = Portability.normalizeBackup(text);
        const preview = await backgroundSend({ type: "YOLODATA_IMPORT_PREVIEW", backup: text });
        if (!preview?.ok) throw new Error(preview?.reason || "Backup validation failed");
        if (!win.confirm(importConfirmation(preview.summary))) return setStatus("Import cancelled");
        const response = await backgroundSend({
          type: "YOLODATA_IMPORT_APPLY",
          backup: text,
          previewToken: preview.previewToken
        });
        if (!response?.ok) throw new Error(response?.reason || "Could not import YOLO data");
        applied = true;

        const { sourceTabId, pageId } = currentContext();
        if (sourceTabId) {
          const currentState = await contentSend({ type: "YOLO_GET_STATE" });
          const currentPageId = currentState?.pageId || pageId;
          const effectiveSettings = Portability.effectiveSettings(normalized, currentPageId);
          const synced = await contentSend({ type: "YOLO_APPLY_IMPORTED_SETTINGS", settings: effectiveSettings });
          if (!synced?.ok) {
            setStatus("Backup imported. Refresh the ChatGPT tab if its restored settings do not appear. This page will reload.", "warning");
            win.setTimeout(() => win.location.reload(), 1400);
            return;
          }
        }
        setStatus(`Imported ${response.summary.conversations} conversations and ${response.summary.templates} templates`, "success");
        win.setTimeout(() => win.location.reload(), 650);
      } catch (error) { setStatus(Shared.errorMessage(error), "error"); }
      finally {
        importInput.value = "";
        if (!applied) await setBusy(false);
      }
    }

    async function copyDiagnostics() {
      if (busy) return;
      await setBusy(true);
      setStatus("Preparing privacy-safe diagnostics…");
      try {
        const { pageId } = currentContext();
        const [contentState, queueResponse] = await Promise.all([
          contentSend({ type: "YOLO_GET_STATE" }),
          pageId ? backgroundSend({ type: "YOLO_QUEUE_GET", pageId }) : Promise.resolve(null)
        ]);
        const diagnostics = Portability.buildDiagnostics({
          contentState: contentState || {},
          queueState: queueResponse?.state || {},
          browser: win.navigator?.userAgent || "unknown"
        });
        await copyText(JSON.stringify(diagnostics, null, 2));
        setStatus("Privacy-safe diagnostics copied", "success");
      } catch (error) { setStatus(Shared.errorMessage(error), "error"); }
      finally { await setBusy(false); }
    }

    exportButton.addEventListener("click", exportBackup);
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => importBackup(importInput.files?.[0]));
    diagnosticsButton.addEventListener("click", copyDiagnostics);
    return { destroy() {}, exportBackup, importBackup, copyDiagnostics, currentContext };
  }

  return Object.freeze({ importConfirmation, buildControls, mount });
});
