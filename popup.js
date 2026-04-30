(() => {
  "use strict";

  const DEFAULTS = {
    enabled: false,
    approvals: true,
    errorContinue: true,
    autoRefresh: true,
    deepNudges: false
  };
  const SUPPORTED_URLS = ["https://chatgpt.com/", "https://grok.com/", "https://www.grok.com/"];

  const els = {
    enabled: document.querySelector("#enabled"),
    approvals: document.querySelector("#approvals"),
    errorContinue: document.querySelector("#errorContinue"),
    autoRefresh: document.querySelector("#autoRefresh"),
    deepNudges: document.querySelector("#deepNudges"),
    status: document.querySelector("#status"),
    scope: document.querySelector("#scope"),
    lastAction: document.querySelector("#lastAction"),
    approvalsClicked: document.querySelector("#approvalsClicked"),
    continuesSent: document.querySelector("#continuesSent"),
    deepNudgesSent: document.querySelector("#deepNudgesSent")
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

  const injectContentScript = (tabId) => new Promise((resolve) => {
    if (!chrome.scripting?.executeScript) {
      resolve(false);
      return;
    }

    try {
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
        resolve(!chrome.runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });

  async function sendMessageWithInject(tabId, message) {
    const first = await sendMessage(tabId, message);
    if (first) return first;

    const injected = await injectContentScript(tabId);
    if (!injected) return null;

    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    return sendMessage(tabId, message);
  }

  function render(state = {}) {
    settings = { ...settings, ...(state.settings || {}) };
    els.enabled.checked = Boolean(settings.enabled);
    els.approvals.checked = Boolean(settings.approvals);
    els.errorContinue.checked = Boolean(settings.errorContinue);
    els.autoRefresh.checked = Boolean(settings.autoRefresh);
    els.deepNudges.checked = Boolean(settings.deepNudges);
    els.lastAction.textContent = state.lastAction || "Idle";
    els.approvalsClicked.textContent = String(state.approvalsClicked || 0);
    els.continuesSent.textContent = String(state.continuesSent || 0);
    els.deepNudgesSent.textContent = String(state.deepNudgesSent || 0);
    els.status.textContent = settings.enabled ? "On" : "Off";
    els.status.dataset.on = String(Boolean(settings.enabled));
  }

  function disabled(message) {
    els.status.textContent = "Unavailable";
    els.scope.textContent = message;
    for (const input of [els.enabled, els.approvals, els.errorContinue, els.autoRefresh, els.deepNudges]) {
      input.disabled = true;
    }
  }

  async function updateSetting(key, value) {
    settings = { ...settings, [key]: value };
    render({ settings });

    if (!activeTab?.id) return;
    await sendMessageWithInject(activeTab.id, {
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

    if (!SUPPORTED_URLS.some((url) => activeTab?.url?.startsWith(url))) {
      disabled("Open chatgpt.com or grok.com to use this tab.");
      return;
    }

    const state = await sendMessageWithInject(activeTab.id, { type: "YOLO_GET_STATE" });
    if (!state) {
      disabled("Cannot inject into this pane yet.");
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
  els.autoRefresh.addEventListener("change", () => updateSetting("autoRefresh", els.autoRefresh.checked));
  els.deepNudges.addEventListener("change", () => updateSetting("deepNudges", els.deepNudges.checked));

  init();
})();
