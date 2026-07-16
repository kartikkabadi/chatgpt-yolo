(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  if (!Config) return;

  const els = {
    enabled: document.querySelector("#enabled"),
    profile: document.querySelector("#profile"),
    status: document.querySelector("#status"),
    scope: document.querySelector("#scope"),
    queueCount: document.querySelector("#queueCount"),
    message: document.querySelector("#message"),
    templateSelect: document.querySelector("#templateSelect"),
    manageTemplates: document.querySelector("#manageTemplates"),
    addQueue: document.querySelector("#addQueue"),
    addAndSend: document.querySelector("#addAndSend"),
    cancelEdit: document.querySelector("#cancelEdit"),
    composeStatus: document.querySelector("#composeStatus"),
    togglePause: document.querySelector("#togglePause"),
    sendNext: document.querySelector("#sendNext"),
    clearQueue: document.querySelector("#clearQueue"),
    emptyQueue: document.querySelector("#emptyQueue"),
    queueList: document.querySelector("#queueList"),
    lastAction: document.querySelector("#lastAction"),
    blockedReason: document.querySelector("#blockedReason"),
    blockedText: document.querySelector("#blockedText"),
    sessionActions: document.querySelector("#sessionActions"),
    hourlyActions: document.querySelector("#hourlyActions"),
    nextSend: document.querySelector("#nextSend"),
    eventList: document.querySelector("#eventList"),
    advanced: document.querySelector("#advanced"),
    version: document.querySelector("#version")
  };

  let activeTab = null;
  let contentState = null;
  let queueState = { paused: false, items: [], events: [] };
  let templates = [];
  let editingId = "";
  let busy = false;
  let pollTimer = null;
  let clearArmedUntil = 0;
  let draggedId = "";

  const queryActiveTab = () => new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab || null));
  });

  const sendContent = (message) => new Promise((resolve) => {
    if (!activeTab?.id) return resolve(null);
    chrome.tabs.sendMessage(activeTab.id, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response || null);
    });
  });

  const injectContent = () => new Promise((resolve) => {
    if (!activeTab?.id) return resolve(false);
    try {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["config.js", "platforms.js", "content.js"]
      }, () => resolve(!chrome.runtime.lastError));
    } catch {
      resolve(false);
    }
  });

  async function sendContentWithInject(message) {
    const first = await sendContent(message);
    if (first) return first;
    if (!await injectContent()) return null;
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    return sendContent(message);
  }

  const sendBackground = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response || null);
    });
  });

  function setComposeStatus(message = "", level = "info") {
    els.composeStatus.textContent = message;
    els.composeStatus.dataset.level = level;
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    for (const element of [
      els.enabled, els.profile, els.message, els.templateSelect, els.manageTemplates,
      els.addQueue, els.addAndSend, els.cancelEdit, els.togglePause, els.sendNext,
      els.clearQueue, els.advanced
    ]) element.disabled = nextBusy;
    for (const button of els.queueList.querySelectorAll("button")) {
      const locked = button.closest?.(".queue-item")?.dataset?.state === "sending";
      button.disabled = nextBusy || locked;
    }
  }

  function formatRelative(timestamp) {
    if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "—";
    const delta = Number(timestamp) - Date.now();
    return delta <= 0 ? "ready" : Config.formatDuration(delta);
  }

  function formatAgo(timestamp) {
    if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return "";
    const delta = Date.now() - Number(timestamp);
    if (delta < 5000) return "now";
    return `${Config.formatDuration(delta)} ago`;
  }

  function compactText(text, max = 180) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
  }

  function renderTemplates() {
    const selected = els.templateSelect.value;
    els.templateSelect.replaceChildren(new Option("Template…", ""));
    for (const template of templates) els.templateSelect.add(new Option(template.name, template.id));
    if (templates.some((template) => template.id === selected)) els.templateSelect.value = selected;
  }

  function renderEvents() {
    els.eventList.replaceChildren();
    const events = Array.isArray(queueState.events) ? queueState.events.slice(-8).reverse() : [];
    for (const event of events) {
      const li = document.createElement("li");
      li.dataset.level = event.level || "info";
      const message = document.createElement("span");
      message.textContent = event.message;
      const time = document.createElement("time");
      time.textContent = formatAgo(event.at);
      li.append(message, time);
      els.eventList.append(li);
    }
    if (!events.length) {
      const li = document.createElement("li");
      const message = document.createElement("span");
      message.textContent = "No queue activity yet.";
      const time = document.createElement("time");
      li.append(message, time);
      els.eventList.append(li);
    }
  }

  function moveOrder(itemId, direction) {
    const ids = queueState.items.map((item) => item.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return null;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    return ids;
  }

  async function reorderQueue(orderedIds) {
    if (!orderedIds || busy) return;
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_QUEUE_REORDER", pageId: contentState.pageId, orderedIds });
      if (response?.ok) {
        queueState = response.state;
        renderQueue();
      } else setComposeStatus(response?.reason || "Could not reorder the queue.", "error");
    } finally {
      setBusy(false);
    }
  }

  function itemButton(label, title, handler, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.className = className;
    button.addEventListener("click", handler);
    return button;
  }

  function renderQueue() {
    const items = Array.isArray(queueState.items) ? queueState.items : [];
    els.queueCount.textContent = `${items.length} queued`;
    els.emptyQueue.hidden = items.length > 0;
    els.queueList.replaceChildren();
    els.togglePause.textContent = queueState.paused ? "Resume" : "Pause";
    els.togglePause.classList.toggle("danger", queueState.paused);

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "queue-item";
      li.dataset.id = item.id;
      li.dataset.state = item.state;
      li.draggable = item.state !== "sending" && !busy;

      const drag = itemButton("⋮⋮", "Drag to reorder", () => {}, "drag-handle");
      drag.setAttribute("aria-label", "Drag queued message");

      const copy = document.createElement("div");
      copy.className = "queue-copy";
      const strong = document.createElement("strong");
      strong.textContent = compactText(item.text);
      const meta = document.createElement("div");
      meta.className = "queue-meta";
      const position = document.createElement("span");
      position.textContent = `#${index + 1}`;
      const status = document.createElement("span");
      status.textContent = item.state === "failed"
        ? `failed${item.attempts ? ` · ${item.attempts} attempts` : ""}`
        : item.state;
      status.className = item.state;
      meta.append(position, status);
      if (item.nextAttemptAt > Date.now()) {
        const retry = document.createElement("span");
        retry.textContent = `retry ${formatRelative(item.nextAttemptAt)}`;
        meta.append(retry);
      }
      copy.append(strong, meta);
      if (item.error) {
        const error = document.createElement("small");
        error.className = "queue-error";
        error.textContent = compactText(item.error, 140);
        error.title = item.error;
        copy.append(error);
      }

      const actions = document.createElement("div");
      actions.className = "item-actions";
      if (item.state === "failed") {
        actions.append(itemButton("↻", "Retry message", () => retryItem(item.id)));
      }
      const moveUp = itemButton("↑", "Move up", () => reorderQueue(moveOrder(item.id, -1)));
      const moveDown = itemButton("↓", "Move down", () => reorderQueue(moveOrder(item.id, 1)));
      const edit = itemButton("Edit", "Edit message", () => beginEdit(item));
      const remove = itemButton("×", "Remove message", () => removeItem(item.id), "danger");
      moveUp.disabled = index === 0;
      moveDown.disabled = index === items.length - 1;
      actions.append(moveUp, moveDown, edit, remove);
      if (busy || item.state === "sending") {
        for (const button of actions.querySelectorAll("button")) button.disabled = true;
        drag.disabled = true;
      }

      li.append(drag, copy, actions);
      li.addEventListener("dragstart", (event) => {
        draggedId = item.id;
        li.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      });
      li.addEventListener("dragend", () => {
        draggedId = "";
        for (const entry of els.queueList.children) entry.classList.remove("dragging", "drop-target");
      });
      li.addEventListener("dragover", (event) => {
        if (!draggedId || draggedId === item.id) return;
        event.preventDefault();
        li.classList.add("drop-target");
      });
      li.addEventListener("dragleave", () => li.classList.remove("drop-target"));
      li.addEventListener("drop", (event) => {
        event.preventDefault();
        li.classList.remove("drop-target");
        const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
        const ids = items.map((entry) => entry.id).filter((id) => id !== sourceId);
        const targetIndex = ids.indexOf(item.id);
        const rect = li.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        ids.splice(targetIndex + (after ? 1 : 0), 0, sourceId);
        reorderQueue(ids);
      });
      els.queueList.append(li);
    });
    renderEvents();
  }

  function renderContentState() {
    const settings = contentState?.settings || Config.DEFAULT_SETTINGS;
    const runtime = contentState?.runtime || {};
    els.enabled.checked = Boolean(settings.enabled);
    els.profile.value = settings.profile || "custom";
    els.status.textContent = settings.enabled ? "Running" : "Paused";
    els.status.dataset.on = String(Boolean(settings.enabled));
    els.scope.textContent = `${contentState?.platform || "Chat"} · current conversation`;
    els.lastAction.textContent = contentState?.lastAction?.message || "No activity yet";
    els.sessionActions.textContent = String(runtime.sessionActionCount || 0);
    els.hourlyActions.textContent = String(
      (runtime.approvalCountLastHour || 0)
      + (runtime.recoveryCountLastHour || 0)
      + (runtime.nudgeCountLastHour || 0)
      + (runtime.refreshCountLastHour || 0)
      + (runtime.queueCountLastHour || 0)
    );
    els.nextSend.textContent = settings.queueAutoRunEnabled ? formatRelative(runtime.nextQueueAt) : "off";
    els.blockedReason.hidden = !runtime.blockedReason;
    els.blockedText.hidden = !runtime.blockedReason;
    els.blockedText.textContent = runtime.blockedReason || "";
    els.version.textContent = `v${contentState?.version || Config.VERSION}`;
  }

  async function refreshAll({ includeTemplates = false, force = false } = {}) {
    if (!activeTab?.id || (busy && !force)) return false;
    const nextContent = await sendContentWithInject({ type: "YOLO_GET_STATE" });
    if (!nextContent?.pageId) return false;
    const tasks = [sendBackground({ type: "YOLO_QUEUE_GET", pageId: nextContent.pageId })];
    if (includeTemplates) tasks.push(sendBackground({ type: "YOLO_TEMPLATES_GET" }));
    const [queueResponse, templateResponse] = await Promise.all(tasks);
    if (!queueResponse?.ok) return false;
    contentState = nextContent;
    queueState = queueResponse.state;
    if (templateResponse?.ok) templates = templateResponse.templates;
    renderContentState();
    renderQueue();
    if (includeTemplates) renderTemplates();
    return true;
  }

  async function saveCoreSettings(next) {
    if (!contentState || busy) return false;
    const previousState = contentState;
    const requested = Config.mergeSettings(contentState.settings, next);
    contentState = { ...contentState, settings: requested };
    renderContentState();
    setBusy(true);
    try {
      const response = await sendContentWithInject({ type: "YOLO_SET_SETTINGS", settings: requested });
      if (!response?.ok) {
        contentState = previousState;
        renderContentState();
        setComposeStatus("Could not save settings.", "error");
        return false;
      }
      contentState = response.state;
      renderContentState();
      setComposeStatus("Settings saved.", "success");
      return true;
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(item) {
    editingId = item.id;
    els.message.value = item.text;
    els.addQueue.textContent = "Save message";
    els.addAndSend.hidden = true;
    els.cancelEdit.hidden = false;
    els.message.focus();
    setComposeStatus("Editing queued message.");
  }

  function cancelEdit() {
    editingId = "";
    els.message.value = "";
    els.addQueue.textContent = "Add to queue";
    els.addAndSend.hidden = false;
    els.cancelEdit.hidden = true;
    setComposeStatus("");
  }

  async function addOrUpdate({ send = false } = {}) {
    const text = els.message.value.trim();
    if (!text) {
      setComposeStatus("Enter a message first.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = editingId
        ? await sendBackground({ type: "YOLO_QUEUE_UPDATE", pageId: contentState.pageId, itemId: editingId, text })
        : await sendBackground({ type: "YOLO_QUEUE_ADD", pageId: contentState.pageId, item: { text, templateId: els.templateSelect.value }, front: send });
      if (!response?.ok) {
        setComposeStatus(response?.reason || "Could not update the queue.", "error");
        return;
      }
      const wasEditing = Boolean(editingId);
      queueState = response.state;
      cancelEdit();
      renderQueue();
      setComposeStatus(wasEditing ? "Message updated." : "Message queued.", "success");
      if (send) {
        const result = await sendContentWithInject({ type: "YOLO_RUN_ACTION", action: "queue-next" });
        if (result?.state) contentState = result.state;
        await refreshAll({ force: true });
        setComposeStatus(result?.ok ? "Message sent." : "Message queued; chat is not ready to send yet.", result?.ok ? "success" : "info");
      } else {
        sendContentWithInject({ type: "YOLO_RUN_ACTION", action: "scan" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_QUEUE_REMOVE", pageId: contentState.pageId, itemId });
      if (response?.ok) {
        queueState = response.state;
        if (editingId === itemId) cancelEdit();
        renderQueue();
      } else setComposeStatus(response?.reason || "Could not remove the message.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function retryItem(itemId) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_QUEUE_RETRY", pageId: contentState.pageId, itemId });
      if (response?.ok) {
        queueState = response.state;
        renderQueue();
        sendContentWithInject({ type: "YOLO_RUN_ACTION", action: "scan" });
      } else setComposeStatus(response?.reason || "Could not retry the message.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_QUEUE_PAUSE", pageId: contentState.pageId, paused: !queueState.paused });
      if (response?.ok) {
        queueState = response.state;
        renderQueue();
        if (!queueState.paused) sendContentWithInject({ type: "YOLO_RUN_ACTION", action: "scan" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendNext() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await sendContentWithInject({ type: "YOLO_RUN_ACTION", action: "queue-next" });
      if (response?.state) contentState = response.state;
      await refreshAll({ force: true });
      setComposeStatus(response?.ok ? "Next message sent." : "The chat is busy, paused, or limited.", response?.ok ? "success" : "info");
    } finally {
      setBusy(false);
    }
  }

  async function clearQueue() {
    if (busy) return;
    if (Date.now() > clearArmedUntil) {
      clearArmedUntil = Date.now() + 3000;
      els.clearQueue.textContent = "Confirm clear";
      window.setTimeout(() => {
        if (Date.now() > clearArmedUntil) els.clearQueue.textContent = "Clear";
      }, 3100);
      return;
    }
    clearArmedUntil = 0;
    els.clearQueue.textContent = "Clear";
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_QUEUE_CLEAR", pageId: contentState.pageId });
      if (response?.ok) {
        queueState = response.state;
        cancelEdit();
        renderQueue();
      }
    } finally {
      setBusy(false);
    }
  }

  function openAdvanced(section = "") {
    const params = new URLSearchParams({ tabId: String(activeTab?.id || ""), pageId: contentState?.pageId || "" });
    if (section) params.set("section", section);
    chrome.tabs.create({ url: chrome.runtime.getURL(`options.html?${params}`) });
  }

  async function init() {
    setBusy(true);
    els.version.textContent = `v${Config.VERSION}`;
    activeTab = await queryActiveTab();
    if (!Config.isSupportedUrl(activeTab?.url)) {
      els.status.textContent = "Unavailable";
      els.scope.textContent = "Open ChatGPT to use YOLO.";
      return;
    }
    if (!await refreshAll({ includeTemplates: true, force: true })) {
      els.status.textContent = "Unavailable";
      els.scope.textContent = "Could not start YOLO in this tab.";
      return;
    }
    pollTimer = window.setInterval(() => refreshAll(), 1800);
    setBusy(false);
  }

  els.enabled.addEventListener("change", () => saveCoreSettings({ enabled: els.enabled.checked, profile: contentState.settings.profile }));
  els.profile.addEventListener("change", () => {
    const next = Config.applyPreset(contentState.settings, els.profile.value);
    saveCoreSettings(next);
  });
  els.templateSelect.addEventListener("change", () => {
    const template = templates.find((entry) => entry.id === els.templateSelect.value);
    if (!template) return;
    els.message.value = Config.renderTemplate(template.text, {
      platform: contentState?.platform,
      conversation: contentState?.pageId
    });
    els.message.focus();
  });
  els.manageTemplates.addEventListener("click", () => openAdvanced("templates"));
  els.addQueue.addEventListener("click", () => addOrUpdate());
  els.addAndSend.addEventListener("click", () => addOrUpdate({ send: true }));
  els.cancelEdit.addEventListener("click", cancelEdit);
  els.togglePause.addEventListener("click", togglePause);
  els.sendNext.addEventListener("click", sendNext);
  els.clearQueue.addEventListener("click", clearQueue);
  els.advanced.addEventListener("click", () => openAdvanced());
  els.message.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      addOrUpdate({ send: event.shiftKey && !editingId });
    }
  });

  window.addEventListener("pagehide", () => window.clearInterval(pollTimer));
  init().catch((error) => {
    els.status.textContent = "Unavailable";
    els.scope.textContent = `Startup failed: ${String(error?.message || error)}`;
    setBusy(true);
  });
})();
