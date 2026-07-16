((root, factory) => {
  const api = factory(root.YOLOPortability);
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (typeof document !== "undefined") api.mount(document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, (Portability) => {
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

  function mount(doc = document, win = window) {
    if (!Portability) return { destroy() {} };
    const exportButton = doc.querySelector("#exportBackup");
    const importButton = doc.querySelector("#importBackup");
    const importInput = doc.querySelector("#importBackupFile");
    const diagnosticsButton = doc.querySelector("#copyDiagnostics");
    const status = doc.querySelector("#dataPortabilityStatus");
    if (!exportButton || !importButton || !importInput || !diagnosticsButton || !status) return { destroy() {} };

    let busy = false;
    const params = new URLSearchParams(win.location?.search || "");
    const sourceTabId = Number(params.get("tabId")) || 0;
    const pageId = String(params.get("pageId") || "");

    const backgroundSend = (message) => new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response || null);
      });
    });

    const contentSend = (message) => new Promise((resolve) => {
      if (!sourceTabId) return resolve(null);
      chrome.tabs.sendMessage(sourceTabId, message, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response || null);
      });
    });

    function setStatus(message = "", level = "info") {
      status.textContent = message;
      status.dataset.level = level;
    }

    function setBusy(next) {
      busy = next;
      exportButton.disabled = next;
      importButton.disabled = next;
      diagnosticsButton.disabled = next;
    }

    function downloadJson(value) {
      const text = JSON.stringify(value, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = doc.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `yolo-backup-${date}.json`;
      link.click();
      win.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    async function copyText(text) {
      if (win.navigator?.clipboard?.writeText) {
        await win.navigator.clipboard.writeText(text);
        return true;
      }
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
      return true;
    }

    async function exportBackup() {
      if (busy) return;
      setBusy(true);
      setStatus("Preparing backup…");
      try {
        const response = await backgroundSend({ type: "YOLO_DATA_EXPORT" });
        if (!response?.ok) throw new Error(response?.reason || "Could not export YOLO data");
        downloadJson(response.backup);
        setStatus(`Backup downloaded · ${response.summary.conversations} conversations · ${response.summary.templates} templates`, "success");
      } catch (error) {
        setStatus(String(error?.message || error), "error");
      } finally {
        setBusy(false);
      }
    }

    async function importBackup(file) {
      if (!file || busy) return;
      if (file.size > Portability.MAX_BACKUP_BYTES) {
        setStatus("Backup file exceeds 1 MiB", "error");
        return;
      }
      setBusy(true);
      setStatus("Validating backup…");
      try {
        const text = await file.text();
        const preview = await backgroundSend({ type: "YOLO_DATA_IMPORT_PREVIEW", backup: text });
        if (!preview?.ok) throw new Error(preview?.reason || "Backup validation failed");
        if (!win.confirm(importConfirmation(preview.summary))) {
          setStatus("Import cancelled");
          return;
        }
        const response = await backgroundSend({ type: "YOLO_DATA_IMPORT_APPLY", backup: text });
        if (!response?.ok) throw new Error(response?.reason || "Could not import YOLO data");
        setStatus(`Imported ${response.summary.conversations} conversations and ${response.summary.templates} templates`, "success");
        win.setTimeout(() => win.location.reload(), 650);
      } catch (error) {
        setStatus(String(error?.message || error), "error");
      } finally {
        importInput.value = "";
        setBusy(false);
      }
    }

    async function copyDiagnostics() {
      if (busy) return;
      setBusy(true);
      setStatus("Preparing privacy-safe diagnostics…");
      try {
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
      } catch (error) {
        setStatus(String(error?.message || error), "error");
      } finally {
        setBusy(false);
      }
    }

    exportButton.addEventListener("click", exportBackup);
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => importBackup(importInput.files?.[0]));
    diagnosticsButton.addEventListener("click", copyDiagnostics);

    return {
      destroy() {},
      exportBackup,
      importBackup,
      copyDiagnostics
    };
  }

  return Object.freeze({ importConfirmation, mount });
});
