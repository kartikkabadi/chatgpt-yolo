(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  if (!Config) return;

  const controls = Array.from(document.querySelectorAll("[data-setting]"));
  const els = {
    status: document.querySelector("#status"),
    scope: document.querySelector("#scope"),
    lastAction: document.querySelector("#lastAction"),
    lastActionTime: document.querySelector("#lastActionTime"),
    sessionActions: document.querySelector("#sessionActions"),
    hourlyActions: document.querySelector("#hourlyActions"),
    nextRefresh: document.querySelector("#nextRefresh"),
    blockedReason: document.querySelector("#blockedReason"),
    saveStatus: document.querySelector("#saveStatus"),
    version: document.querySelector("#version"),
    resetRuntime: document.querySelector("#resetRuntime"),
    actionButtons: Array.from(document.querySelectorAll("[data-action]"))
  };

  let activeTab = null;
  let settings = { ...Config.DEFAULT_SETTINGS };
  let pollTimer = null;
  let saveTimer = null;
  let busy = false;
  let unavailable = false;

  const queryActiveTab = () => new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab || null));
  });

  const sendMessage = (tabId, message) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response || null);
    });
  });

  const injectContentScripts = (tabId) => new Promise((resolve) => {
    try {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["config.js", "platforms.js", "content.js"]
      }, () => resolve(!chrome.runtime.lastError));
    } catch {
      resolve(false);
    }
  });

  async function sendMessageWithInject(tabId, message) {
    const first = await sendMessage(tabId, message);
    if (first) return first;
    const injected = await injectContentScripts(tabId);
    if (!injected) return null;
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    return sendMessage(tabId, message);
  }

  function valueFromControl(control) {
    const kind = control.dataset.kind;
    if (kind === "boolean") return control.checked;
    if (kind === "number") return control.value === "" ? undefined : Number(control.value);
    return control.value;
  }

  function collectSettings() {
    const next = { ...settings };
    for (const control of controls) {
      const value = valueFromControl(control);
      if (value !== undefined) next[control.dataset.setting] = value;
    }
    return Config.normalizeSettings(next);
  }

  function renderControls(nextSettings) {
    settings = Config.normalizeSettings(nextSettings);
    for (const control of controls) {
      if (document.activeElement === control) continue;
      const value = settings[control.dataset.setting];
      if (control.dataset.kind === "boolean") control.checked = Boolean(value);
      else control.value = String(value ?? "");
    }
  }

  function formatRelative(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "—";
    const delta = timestamp - Date.now();
    return delta <= 0 ? "due" : Config.formatDuration(delta);
  }

  function formatActionTime(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "No activity yet";
    const delta = Date.now() - timestamp;
    if (delta < 5000) return "just now";
    return `${Config.formatDuration(delta)} ago`;
  }

  function renderState(state = {}, includeControls = true) {
    if (includeControls && state.settings) renderControls(state.settings);
    const runtime = state.runtime || {};
    const lastAction = typeof state.lastAction === "string"
      ? { message: state.lastAction, at: 0, level: "info" }
      : (state.lastAction || { message: "Idle", at: 0, level: "info" });

    els.status.textContent = settings.enabled ? "Running" : "Paused";
    els.status.dataset.on = String(Boolean(settings.enabled));
    els.scope.textContent = `${state.platform || "Chat"} · current conversation`;
    els.lastAction.textContent = lastAction.message || lastAction.action || "Idle";
    els.lastAction.dataset.level = lastAction.level || "info";
    els.lastActionTime.textContent = formatActionTime(lastAction.at);
    els.sessionActions.textContent = String(runtime.sessionActionCount || 0);
    const hourlyTotal = (runtime.approvalCountLastHour || 0)
      + (runtime.recoveryCountLastHour || 0)
      + (runtime.nudgeCountLastHour || 0)
      + (runtime.refreshCountLastHour || 0);
    els.hourlyActions.textContent = String(hourlyTotal);
    els.nextRefresh.textContent = settings.autoRefreshEnabled ? formatRelative(runtime.nextRefreshAt) : "off";
    els.blockedReason.hidden = !runtime.blockedReason;
    els.blockedReason.textContent = runtime.blockedReason || "";
    els.version.textContent = `v${state.version || Config.VERSION}`;
  }

  function applyDisabledState() {
    const disabled = busy || unavailable;
    for (const control of controls) control.disabled = disabled;
    for (const button of [...els.actionButtons, els.resetRuntime]) button.disabled = disabled;
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    applyDisabledState();
  }

  function disable(message) {
    unavailable = true;
    els.status.textContent = "Unavailable";
    els.status.dataset.on = "false";
    els.scope.textContent = message;
    applyDisabledState();
  }

  async function saveSettings({ force = false } = {}) {
    if (!activeTab?.id) return false;
    if (busy && !force) {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveSettings(), 150);
      return false;
    }

    settings = collectSettings();
    renderControls(settings);
    els.saveStatus.textContent = "Saving…";

    const response = await sendMessageWithInject(activeTab.id, {
      type: "YOLO_SET_SETTINGS",
      settings
    });

    if (!response?.ok) {
      els.saveStatus.textContent = "Could not save settings.";
      return false;
    }

    renderState(response.state || { settings: response.settings });
    els.saveStatus.textContent = "Saved for this conversation.";
    return true;
  }

  function scheduleSave(event) {
    if (event?.target?.closest("summary")) event.stopPropagation();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveSettings(), event?.type === "input" ? 350 : 0);
  }

  async function flushScheduledSave() {
    if (!saveTimer) return true;
    window.clearTimeout(saveTimer);
    saveTimer = null;
    return saveSettings({ force: true });
  }

  async function runAction(action) {
    if (!activeTab?.id || busy) return;
    await flushScheduledSave();
    setBusy(true);
    els.saveStatus.textContent = `Running ${action}…`;
    try {
      const response = await sendMessageWithInject(activeTab.id, { type: "YOLO_RUN_ACTION", action });
      if (response?.state) renderState(response.state);
      els.saveStatus.textContent = response?.ok ? `${action} triggered.` : `${action} was blocked by safety or limits.`;
    } finally {
      setBusy(false);
    }
  }

  async function resetRuntime() {
    if (!activeTab?.id || busy) return;
    await flushScheduledSave();
    setBusy(true);
    try {
      const response = await sendMessageWithInject(activeTab.id, { type: "YOLO_RESET_RUNTIME" });
      if (response?.state) renderState(response.state);
      els.saveStatus.textContent = response?.ok ? "Session limits reset." : "Could not reset this session.";
    } finally {
      setBusy(false);
    }
  }

  async function refreshState() {
    if (!activeTab?.id || busy || document.visibilityState === "hidden") return;
    const state = await sendMessage(activeTab.id, { type: "YOLO_GET_STATE" });
    if (state) renderState(state, document.activeElement?.dataset?.setting == null);
  }

  async function init() {
    els.version.textContent = `v${Config.VERSION}`;
    activeTab = await queryActiveTab();
    if (!Config.isSupportedUrl(activeTab?.url)) {
      disable("Open chatgpt.com or grok.com to use YOLO.");
      return;
    }

    const state = await sendMessageWithInject(activeTab.id, { type: "YOLO_GET_STATE" });
    if (!state) {
      disable("Could not start automation in this tab.");
      return;
    }

    renderState(state);
    pollTimer = window.setInterval(refreshState, 1500);
  }

  for (const control of controls) {
    control.addEventListener("change", scheduleSave);
    if (control.matches("input[type='number'], textarea")) control.addEventListener("input", scheduleSave);
    if (control.closest("summary")) control.addEventListener("click", (event) => event.stopPropagation());
  }

  for (const button of els.actionButtons) {
    button.addEventListener("click", () => runAction(button.dataset.action));
  }
  els.resetRuntime.addEventListener("click", resetRuntime);

  window.addEventListener("pagehide", () => {
    window.clearInterval(pollTimer);
    window.clearTimeout(saveTimer);
  });

  init().catch((error) => {
    disable(`Popup startup failed: ${String(error?.message || error)}`);
  });
})();
