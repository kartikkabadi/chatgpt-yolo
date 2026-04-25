(() => {
  "use strict";

  const DEFAULTS = {
    enabled: false,
    approvals: true,
    errorContinue: true
  };

  const els = {
    enabled: document.querySelector("#enabled"),
    approvals: document.querySelector("#approvals"),
    errorContinue: document.querySelector("#errorContinue"),
    status: document.querySelector("#status"),
    scope: document.querySelector("#scope"),
    lastAction: document.querySelector("#lastAction"),
    approvalsClicked: document.querySelector("#approvalsClicked"),
    continuesSent: document.querySelector("#continuesSent")
  };

  let activeTab = null;
  let settings = { ...DEFAULTS };
  let pollTimer = null;

  const queryActiveTab = () => new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab));
  });

  const sendMessage = (tabId, message) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });

  function render(state = {}) {
    settings = { ...settings, ...(state.settings || {}) };
    els.enabled.checked = Boolean(settings.enabled);
    els.approvals.checked = Boolean(settings.approvals);
    els.errorContinue.checked = Boolean(settings.errorContinue);
    els.lastAction.textContent = state.lastAction || "Idle";
    els.approvalsClicked.textContent = String(state.approvalsClicked || 0);
    els.continuesSent.textContent = String(state.continuesSent || 0);
    els.status.textContent = settings.enabled ? "On" : "Off";
    els.status.dataset.on = String(Boolean(settings.enabled));
  }

  function disabled(message) {
    els.status.textContent = "Unavailable";
    els.scope.textContent = message;
    for (const input of [els.enabled, els.approvals, els.errorContinue]) {
      input.disabled = true;
    }
  }

  async function updateSetting(key, value) {
    settings = { ...settings, [key]: value };
    render({ settings });

    if (!activeTab?.id) return;
    await sendMessage(activeTab.id, {
      type: "YOLO_SET_TAB_SETTINGS",
      settings
    });
  }

  async function refreshState() {
    if (!activeTab?.id) return;
    const state = await sendMessage(activeTab.id, { type: "YOLO_GET_STATE" });
    if (state) render(state);
  }

  async function init() {
    activeTab = await queryActiveTab();

    if (!activeTab?.url?.startsWith("https://chatgpt.com/")) {
      disabled("Open chatgpt.com to use this tab.");
      return;
    }

    const state = await sendMessage(activeTab.id, { type: "YOLO_GET_STATE" });
    if (!state) {
      disabled("Refresh this ChatGPT tab once.");
      return;
    }

    render(state);
    pollTimer = window.setInterval(refreshState, 1500);
  }

  window.addEventListener("pagehide", () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });

  els.enabled.addEventListener("change", () => updateSetting("enabled", els.enabled.checked));
  els.approvals.addEventListener("change", () => updateSetting("approvals", els.approvals.checked));
  els.errorContinue.addEventListener("change", () => updateSetting("errorContinue", els.errorContinue.checked));

  init();
})();
