(() => {
  "use strict";

  const Config = globalThis.YOLOConfig;
  if (!Config) return;

  const controls = Array.from(document.querySelectorAll("[data-setting]"));
  const els = {
    scope: document.querySelector("#scope"),
    saveStatus: document.querySelector("#saveStatus"),
    resetDefaults: document.querySelector("#resetDefaults"),
    resetRuntime: document.querySelector("#resetRuntime"),
    profile: document.querySelector("#profile"),
    templateName: document.querySelector("#templateName"),
    templateText: document.querySelector("#templateText"),
    saveTemplate: document.querySelector("#saveTemplate"),
    cancelTemplate: document.querySelector("#cancelTemplate"),
    resetTemplates: document.querySelector("#resetTemplates"),
    templateStatus: document.querySelector("#templateStatus"),
    templateList: document.querySelector("#templateList")
  };

  const params = new URLSearchParams(location.search);
  let sourceTabId = Number(params.get("tabId")) || 0;
  let contentState = null;
  let settings = { ...Config.DEFAULT_SETTINGS };
  let templates = [];
  let editingTemplateId = "";
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let saveRevision = 0;
  let busy = false;

  const sendBackground = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response || null);
    });
  });

  const sendContent = (message) => new Promise((resolve) => {
    if (!sourceTabId) return resolve(null);
    chrome.tabs.sendMessage(sourceTabId, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response || null);
    });
  });

  const injectContent = () => new Promise((resolve) => {
    if (!sourceTabId) return resolve(false);
    try {
      chrome.scripting.executeScript({
        target: { tabId: sourceTabId },
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

  async function resolveSourceTab() {
    if (sourceTabId) {
      const state = await sendContentWithInject({ type: "YOLO_GET_STATE" });
      if (state) return state;
    }
    const tabs = await new Promise((resolve) => chrome.tabs.query({
      url: ["https://chatgpt.com/*", "https://*.chatgpt.com/*"]
    }, resolve));
    const candidate = [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    if (!candidate?.id) return null;
    sourceTabId = candidate.id;
    return sendContentWithInject({ type: "YOLO_GET_STATE" });
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    for (const control of controls) control.disabled = nextBusy || !contentState;
    for (const button of document.querySelectorAll("button:not([data-section-link]):not(#clearSearch)")) {
      button.disabled = nextBusy;
    }
    els.resetDefaults.disabled = nextBusy || !contentState;
    els.resetRuntime.disabled = nextBusy || !contentState;
  }

  function valueFromControl(control) {
    if (control.dataset.kind === "boolean") return control.checked;
    if (control.dataset.kind === "number") return control.value === "" ? undefined : Number(control.value);
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

  function saveSettings(nextSettings = collectSettings()) {
    if (!sourceTabId) return Promise.resolve(false);
    const requested = Config.normalizeSettings(nextSettings);
    const revision = ++saveRevision;
    settings = requested;
    els.saveStatus.textContent = "Saving…";

    const task = async () => {
      const response = await sendContentWithInject({ type: "YOLO_SET_SETTINGS", settings: requested });
      if (!response?.ok) {
        if (revision === saveRevision) els.saveStatus.textContent = "Could not save settings.";
        return false;
      }
      contentState = response.state;
      if (revision === saveRevision) {
        renderControls(response.settings);
        els.scope.textContent = `${contentState.platform} · ${contentState.pageId}`;
        els.saveStatus.textContent = "Saved";
      }
      return true;
    };

    const result = saveChain.catch(() => {}).then(task);
    saveChain = result.catch(() => {});
    return result;
  }

  function scheduleSave(event) {
    const setting = event.target?.dataset?.setting;
    if (event.target !== els.profile && setting !== "enabled") {
      settings = { ...collectSettings(), profile: "custom" };
      els.profile.value = "custom";
    }
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      saveSettings();
    }, event.type === "input" ? 350 : 0);
  }

  async function flushScheduledSave() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
      await saveSettings();
    }
    await saveChain.catch(() => {});
  }

  function setTemplateStatus(message = "", error = false) {
    els.templateStatus.textContent = message;
    els.templateStatus.dataset.level = error ? "error" : "info";
  }

  function compact(text, max = 180) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
  }

  function renderTemplates() {
    els.templateList.replaceChildren();
    if (!templates.length) {
      const empty = document.createElement("li");
      empty.className = "template-empty";
      empty.textContent = "No templates yet. Create one from the editor.";
      els.templateList.append(empty);
      return;
    }
    for (const template of templates) {
      const li = document.createElement("li");
      const copy = document.createElement("div");
      copy.className = "template-copy";
      const name = document.createElement("strong");
      name.textContent = template.name;
      const text = document.createElement("p");
      text.textContent = compact(template.text);
      copy.append(name, text);
      const actions = document.createElement("div");
      actions.className = "template-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => beginTemplateEdit(template));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.className = "danger";
      remove.addEventListener("click", () => removeTemplate(template.id));
      actions.append(edit, remove);
      li.append(copy, actions);
      els.templateList.append(li);
    }
  }

  function beginTemplateEdit(template) {
    editingTemplateId = template.id;
    els.templateName.value = template.name;
    els.templateText.value = template.text;
    els.saveTemplate.textContent = "Save template";
    els.cancelTemplate.hidden = false;
    els.templateName.focus();
    setTemplateStatus("Editing template.");
  }

  function cancelTemplateEdit() {
    editingTemplateId = "";
    els.templateName.value = "";
    els.templateText.value = "";
    els.saveTemplate.textContent = "Add template";
    els.cancelTemplate.hidden = true;
    setTemplateStatus("");
  }

  async function saveTemplate() {
    const name = els.templateName.value.trim();
    const text = els.templateText.value.trim();
    if (!name || !text) {
      setTemplateStatus("Template name and message are required.", true);
      return;
    }
    setBusy(true);
    try {
      const response = await sendBackground(editingTemplateId
        ? { type: "YOLO_TEMPLATE_UPDATE", template: { id: editingTemplateId, name, text } }
        : { type: "YOLO_TEMPLATE_ADD", template: { name, text } });
      if (!response?.ok) {
        setTemplateStatus(response?.reason || "Could not save template.", true);
        return;
      }
      templates = response.templates;
      cancelTemplateEdit();
      renderTemplates();
      setTemplateStatus("Template saved.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate(templateId) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_TEMPLATE_REMOVE", templateId });
      if (response?.ok) {
        templates = response.templates;
        if (editingTemplateId === templateId) cancelTemplateEdit();
        renderTemplates();
        setTemplateStatus("Template deleted.");
      } else setTemplateStatus(response?.reason || "Could not delete template.", true);
    } finally {
      setBusy(false);
    }
  }

  async function resetTemplates() {
    if (!window.confirm("Replace all templates with the built-in defaults?")) return;
    setBusy(true);
    try {
      const response = await sendBackground({ type: "YOLO_TEMPLATES_RESET" });
      if (response?.ok) {
        templates = response.templates;
        cancelTemplateEdit();
        renderTemplates();
        setTemplateStatus("Default templates restored.");
      } else {
        setTemplateStatus(response?.reason || "Could not restore default templates.", true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function init() {
    setBusy(true);
    contentState = await resolveSourceTab();
    if (!contentState) {
      els.scope.textContent = "Open a ChatGPT conversation to configure automation. Templates remain available below.";
      els.saveStatus.textContent = "No conversation selected";
    } else {
      settings = contentState.settings;
      renderControls(settings);
      els.scope.textContent = `${contentState.platform} · ${contentState.pageId}`;
      els.saveStatus.textContent = "Saved";
    }

    const templateResponse = await sendBackground({ type: "YOLO_TEMPLATES_GET" });
    if (templateResponse?.ok) templates = templateResponse.templates;
    renderTemplates();

    const section = params.get("section");
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
    setBusy(false);
  }

  for (const control of controls) {
    control.addEventListener("change", (event) => {
      if (control === els.profile && ["safe", "balanced", "fast"].includes(control.value)) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
        const next = Config.applyPreset(collectSettings(), control.value);
        renderControls(next);
        saveSettings(next);
      } else scheduleSave(event);
    });
    if (control.matches("input[type='number'], textarea")) control.addEventListener("input", scheduleSave);
  }

  els.resetDefaults.addEventListener("click", () => {
    if (!window.confirm("Restore every automation setting to its default value?")) return;
    const next = Config.normalizeSettings({ ...Config.DEFAULT_SETTINGS, enabled: settings.enabled });
    renderControls(next);
    saveSettings(next);
  });
  els.resetRuntime.addEventListener("click", async () => {
    await flushScheduledSave();
    setBusy(true);
    const response = await sendContentWithInject({ type: "YOLO_RESET_RUNTIME" });
    els.saveStatus.textContent = response?.ok ? "Session history reset" : "Could not reset session history";
    setBusy(false);
  });
  els.saveTemplate.addEventListener("click", saveTemplate);
  els.cancelTemplate.addEventListener("click", cancelTemplateEdit);
  els.resetTemplates.addEventListener("click", resetTemplates);

  window.addEventListener("pagehide", () => window.clearTimeout(saveTimer));
  init().catch((error) => {
    els.scope.textContent = `Startup failed: ${String(error?.message || error)}`;
    els.saveStatus.textContent = "Unavailable";
    setBusy(true);
  });
})();
