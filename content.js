(() => {
  "use strict";

  const SCRIPT_VERSION = "0.2.0";
  if (window.__YOLO_EXTENSION__?.version === SCRIPT_VERSION) return;
  window.__YOLO_EXTENSION__?.destroy?.();

  const STORAGE_KEY = "yoloGlobal";
  const TAB_KEY = "yoloTabSettings";
  const PAGE_KEY = "yoloPageSettings";
  const COUNTERS_KEY = "yoloCounters";
  const LAST_ACTION_KEY = "yoloLastAction";

  const DEFAULT_SETTINGS = {
    enabled: false,
    approvals: true,
    errorContinue: true,
    autoRefresh: true
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    approvalsClicked: 0,
    continuesSent: 0,
    lastAction: "Idle",
    pageLoadedAt: Date.now(),
    lastErrorSignature: "",
    lastApprovalSignature: "",
    lastContinueAt: 0,
    lastApprovalAt: 0,
    lastRefreshAt: 0,
    nextScheduledRefreshAt: 0,
    clickedApprovalSignatures: new Set(),
    lastActivityAt: Date.now(),
    lastGenerationAt: Date.now(),
    approvalInFlight: false,
    continueInFlight: false,
    refreshInFlight: false,
    clickedApprovals: new WeakSet(),
    scanQueued: false,
    observer: null,
    scanTimer: null,
    idleTimer: null,
    refreshTimer: null,
    loaded: false
  };

  const MIN_DELAY_MS = 4000;
  const MAX_DELAY_MS = 8500;
  const LOAD_GRACE_MS = 40000;
  const APPROVAL_COOLDOWN_MS = 12000;
  const CONTINUE_COOLDOWN_MS = 90000;
  const REFRESH_COOLDOWN_MS = 90000;
  const ERROR_REFRESH_DELAY_MIN_MS = 12000;
  const ERROR_REFRESH_DELAY_MAX_MS = 26000;
  const PERIODIC_REFRESH_MIN_MS = 180000;
  const PERIODIC_REFRESH_MAX_MS = 300000;
  const IDLE_CONTINUE_AFTER_MS = 150000;
  const MAX_CARD_WIDTH = 900;
  const MAX_CARD_HEIGHT = 640;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomDelay = () => MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  const visible = (el) => {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const normalizedText = (el) => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  const now = () => Date.now();

  const buttonText = (button) => {
    const label = button.getAttribute("aria-label") || button.getAttribute("title") || normalizedText(button);
    return label.toLowerCase();
  };

  const looksNegative = (button) => {
    const text = buttonText(button);
    return /\b(deny|decline|reject|cancel|stop|no|disallow|do not|don't)\b/i.test(text);
  };

  const looksRetry = (el) => /\bretry\b/i.test(buttonText(el) || normalizedText(el));
  const isDisabled = (el) => el?.disabled || el?.getAttribute("aria-disabled") === "true";
  const looksDetails = (button) => /\bdetails?\b/i.test(buttonText(button));
  const looksAffirmative = (button) => {
    const text = buttonText(button);
    return /\b(allow|approve|accept|create|update|delete|merge|confirm|run|grant|authorize)\b/i.test(text);
  };

  const elementSignature = (el) => {
    const rect = el.getBoundingClientRect();
    return `${Math.round(rect.top)}:${Math.round(rect.left)}:${normalizedText(el).slice(0, 180)}`;
  };
  const approvalSignature = (card, button) => {
    const text = normalizedText(card)
      .replace(/\bDetails\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260);
    return `${buttonText(button)}::${text}`;
  };

  const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  const storageSet = (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve));
  const pageId = () => location.href.split("#")[0];

  async function setLastAction(action) {
    state.lastAction = action;
    await storageSet({ [LAST_ACTION_KEY]: { action, at: Date.now(), url: location.href } });
  }

  async function incrementCounter(key) {
    const stored = await storageGet([COUNTERS_KEY]);
    const counters = stored[COUNTERS_KEY] || {};
    counters[key] = (counters[key] || 0) + 1;
    counters.updatedAt = Date.now();
    await storageSet({ [COUNTERS_KEY]: counters });
    state[key] = counters[key];
  }

  async function loadSettings() {
    const stored = await storageGet([STORAGE_KEY, PAGE_KEY, COUNTERS_KEY, LAST_ACTION_KEY]);
    const globalSettings = stored[STORAGE_KEY] || {};
    const pageSettings = stored[PAGE_KEY]?.[pageId()] || {};
    const tabSettings = readTabSettings();
    state.settings = { ...DEFAULT_SETTINGS, ...globalSettings, ...pageSettings, ...tabSettings };

    const counters = stored[COUNTERS_KEY] || {};
    state.approvalsClicked = counters.approvalsClicked || 0;
    state.continuesSent = counters.continuesSent || 0;
    state.lastAction = stored[LAST_ACTION_KEY]?.action || "Idle";
    state.loaded = true;
  }

  function readTabSettings() {
    try {
      return JSON.parse(sessionStorage.getItem(TAB_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeTabSettings(next) {
    state.settings = { ...state.settings, ...next };
    sessionStorage.setItem(TAB_KEY, JSON.stringify(state.settings));

    return storageGet([PAGE_KEY]).then((stored) => {
      const pageSettings = stored[PAGE_KEY] || {};
      pageSettings[pageId()] = {
        enabled: state.settings.enabled,
        approvals: state.settings.approvals,
        errorContinue: state.settings.errorContinue,
        autoRefresh: state.settings.autoRefresh
      };

      return storageSet({
        [PAGE_KEY]: pageSettings,
        [STORAGE_KEY]: {
          approvals: state.settings.approvals,
          errorContinue: state.settings.errorContinue,
          autoRefresh: state.settings.autoRefresh
        }
      });
    });
  }

  function scheduleNextPeriodicRefresh() {
    state.nextScheduledRefreshAt = now() + randomBetween(PERIODIC_REFRESH_MIN_MS, PERIODIC_REFRESH_MAX_MS);
  }

  function safeToRefresh() {
    if (!state.settings.enabled || !state.settings.autoRefresh) return false;
    if (state.refreshInFlight || state.approvalInFlight || state.continueInFlight) return false;
    if (now() - state.pageLoadedAt < LOAD_GRACE_MS) return false;
    if (now() - state.lastRefreshAt < REFRESH_COOLDOWN_MS) return false;
    if (hasActiveGeneration()) return false;
    return true;
  }

  async function refreshPage(reason, delayMs = randomDelay()) {
    if (!safeToRefresh()) return false;

    state.refreshInFlight = true;
    state.lastRefreshAt = now();
    try {
      await setLastAction(`Refreshing soon (${reason})`);
      await sleep(delayMs);
      if (!safeToRefresh()) return false;
      await setLastAction(`Refreshing (${reason})`);
      location.reload();
      return true;
    } finally {
      state.refreshInFlight = false;
    }
  }

  async function maybePeriodicRefresh() {
    if (!state.nextScheduledRefreshAt) scheduleNextPeriodicRefresh();
    if (now() < state.nextScheduledRefreshAt) return;

    const refreshed = await refreshPage("scheduled");
    if (!refreshed) scheduleNextPeriodicRefresh();
  }

  function queueScan() {
    if (state.scanQueued) return;
    state.scanQueued = true;
    window.setTimeout(() => {
      state.scanQueued = false;
      scan();
    }, 1000);
  }

  function destroy() {
    state.observer?.disconnect();
    window.clearInterval(state.scanTimer);
    window.clearInterval(state.idleTimer);
    window.clearInterval(state.refreshTimer);
  }

  window.__YOLO_EXTENSION__ = {
    destroy,
    version: SCRIPT_VERSION
  };

  function findComposer() {
    const selectors = [
      "#prompt-textarea",
      "textarea[data-testid='prompt-textarea']",
      "div[contenteditable='true'][data-testid='prompt-textarea']",
      "div[contenteditable='true'][role='textbox']",
      "textarea"
    ];

    return selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter(visible)
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }

  function findSendButton() {
    const composer = findComposer();
    const form = composer?.closest("form");
    const scoped = form ? Array.from(form.querySelectorAll("button")) : [];
    const candidates = [
      "button[data-testid='send-button']",
      "button[aria-label*='Send']",
      "button[title*='Send']"
    ].flatMap((selector) => Array.from(document.querySelectorAll(selector)));

    return [...scoped, ...candidates].find((button) => {
      const text = buttonText(button);
      const hasSendSignal = /send|submit/i.test(text) || button.getAttribute("data-testid") === "send-button";
      return hasSendSignal && visible(button) && !isDisabled(button);
    }) || null;
  }

  function hasActiveGeneration() {
    const stopButton = Array.from(document.querySelectorAll("button")).find((button) => {
      const text = buttonText(button);
      return visible(button) && /\b(stop|interrupt|cancel generation)\b/i.test(text);
    });

    const busy = Array.from(document.querySelectorAll("[aria-busy='true'], [data-testid*='stop']")).some(visible);
    const active = Boolean(stopButton || busy);
    if (active) state.lastGenerationAt = now();
    return active;
  }

  function setComposerValue(composer, value) {
    composer.focus();

    if (composer.tagName === "TEXTAREA" || composer.tagName === "INPUT") {
      composer.value = value;
      composer.dispatchEvent(new Event("input", { bubbles: true }));
      composer.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand("insertText", false, value);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  async function sendContinue(reason) {
    if (!state.settings.enabled || !state.settings.errorContinue) return false;
    if (state.continueInFlight) return false;
    if (now() - state.lastContinueAt < CONTINUE_COOLDOWN_MS) return false;
    if (hasActiveGeneration()) return false;

    const composer = findComposer();
    if (!composer) return false;

    state.continueInFlight = true;
    state.lastContinueAt = now();
    try {
      await sleep(randomDelay());

      if (hasActiveGeneration()) return false;

      setComposerValue(composer, "Continue");
      await sleep(150);

      const sendButton = findSendButton();
      if (sendButton) {
        sendButton.click();
      } else {
        composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
        composer.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      }

      await incrementCounter("continuesSent");
      await setLastAction(`Sent Continue (${reason})`);
      return true;
    } finally {
      state.continueInFlight = false;
    }
  }

  function findErrorState() {
    const retryButton = Array.from(document.querySelectorAll("button")).find((button) => {
      const text = normalizedText(button.closest("[role='alert']") || button.parentElement || button);
      return visible(button) && looksRetry(button) && /error|went wrong|try again|retry/i.test(text);
    });
    const redBox = Array.from(document.querySelectorAll("[role='alert'], .text-red-500, .text-red-600, .border-red-500, .border-red-600, [class*='error']"))
      .find((el) => visible(el) && /error|went wrong|try again|retry/i.test(normalizedText(el)));

    return retryButton || redBox || null;
  }

  async function handleErrorState() {
    const errorEl = findErrorState();
    if (!errorEl) return;

    const signature = elementSignature(errorEl);
    if (signature === state.lastErrorSignature) return;

    await setLastAction("Detected error; refreshing soon");
    const refreshed = await refreshPage("error recovery", randomBetween(ERROR_REFRESH_DELAY_MIN_MS, ERROR_REFRESH_DELAY_MAX_MS));
    const sent = refreshed || await sendContinue("error recovery");
    if (sent) state.lastErrorSignature = signature;
  }

  function githubCardCandidates() {
    const buttons = Array.from(document.querySelectorAll("button")).filter(visible);
    const cards = new Set();

    for (const button of buttons) {
      let node = button.parentElement;
      for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
        const rect = node.getBoundingClientRect();
        if (rect.width > MAX_CARD_WIDTH || rect.height > MAX_CARD_HEIGHT) continue;

        const text = normalizedText(node);
        const localButtons = Array.from(node.querySelectorAll("button")).filter(visible);
        const hasGithubSignal = /github|repository|pull request|branch|commit|file|workspace|permissions?/i.test(text);
        const hasApprovalPair = localButtons.length >= 2 && localButtons.some(looksNegative);
        const hasAffirmativeSignal = localButtons.some((localButton) => looksAffirmative(localButton) && !looksDetails(localButton));

        if (hasGithubSignal && hasApprovalPair && hasAffirmativeSignal) {
          cards.add(node);
          break;
        }
      }
    }

    return Array.from(cards).filter(visible);
  }

  function rightmostAffirmativeButton(card) {
    const buttons = Array.from(card.querySelectorAll("button"))
      .filter((button) => visible(button) && !isDisabled(button) && !looksRetry(button) && !looksDetails(button));

    if (buttons.length < 2) return null;

    const pairs = [];
    for (const negativeButton of buttons.filter(looksNegative)) {
      const negativeRect = negativeButton.getBoundingClientRect();
      const rowButtons = buttons
        .filter((button) => {
          if (button === negativeButton || looksNegative(button) || !looksAffirmative(button)) return false;
          const rect = button.getBoundingClientRect();
          const sameRow = Math.abs(rect.top - negativeRect.top) <= 18 || Math.abs(rect.bottom - negativeRect.bottom) <= 18;
          return sameRow && rect.left > negativeRect.right;
        })
        .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);

      if (rowButtons[0]) pairs.push(rowButtons[0]);
    }

    return pairs.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0] || null;
  }

  async function handleApprovalCards() {
    if (!state.settings.enabled || !state.settings.approvals) return;
    if (state.approvalInFlight) return;
    if (now() - state.lastApprovalAt < APPROVAL_COOLDOWN_MS) return;
    if (now() - state.pageLoadedAt < LOAD_GRACE_MS) return;
    if (hasActiveGeneration()) return;

    for (const card of githubCardCandidates()) {
      const button = rightmostAffirmativeButton(card);
      if (!button) continue;
      if (state.clickedApprovals.has(button)) continue;

      const signature = approvalSignature(card, button);
      if (signature === state.lastApprovalSignature || state.clickedApprovalSignatures.has(signature)) continue;

      state.approvalInFlight = true;
      state.lastApprovalSignature = signature;
      state.lastApprovalAt = now();
      try {
        await setLastAction(`Approval found: ${normalizedText(button) || "right button"}`);
        await sleep(randomDelay());

        if (!visible(button) || isDisabled(button) || looksNegative(button) || hasActiveGeneration()) return;

        state.clickedApprovals.add(button);
        state.clickedApprovalSignatures.add(signature);
        button.click();
        await incrementCounter("approvalsClicked");
        await setLastAction(`Clicked approval: ${normalizedText(button) || "right button"}`);
        return;
      } finally {
        state.approvalInFlight = false;
      }
    }
  }

  async function handleIdleContinue() {
    if (!state.settings.enabled || !state.settings.errorContinue) return;
    if (hasActiveGeneration()) {
      state.lastActivityAt = now();
      return;
    }

    const recentlyGenerated = now() - state.lastGenerationAt < IDLE_CONTINUE_AFTER_MS;
    const idleLongEnough = now() - Math.max(state.lastGenerationAt, state.lastContinueAt, state.lastApprovalAt) > IDLE_CONTINUE_AFTER_MS;
    if (!recentlyGenerated && idleLongEnough) {
      state.lastGenerationAt = now();
      await sendContinue("idle");
    }
  }

  async function scan() {
    if (!state.loaded || !location.hostname.endsWith("chatgpt.com")) return;
    await handleErrorState();
    await handleApprovalCards();
  }

  function installObserver() {
    state.observer = new MutationObserver(() => {
      if (hasActiveGeneration()) state.lastActivityAt = now();
      queueScan();
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    state.scanTimer = window.setInterval(scan, 5000);
    state.idleTimer = window.setInterval(handleIdleContinue, 20000);
    state.refreshTimer = window.setInterval(maybePeriodicRefresh, 15000);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "YOLO_GET_STATE") {
      sendResponse({
        settings: state.settings,
        approvalsClicked: state.approvalsClicked,
        continuesSent: state.continuesSent,
        lastAction: state.lastAction,
        nextRefreshAt: state.nextScheduledRefreshAt
      });
      return true;
    }

    if (message?.type === "YOLO_SET_TAB_SETTINGS") {
      writeTabSettings(message.settings || {}).then(() => {
        sendResponse({ ok: true, settings: state.settings });
        scan();
      });
      return true;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[STORAGE_KEY]) {
      state.settings = { ...state.settings, ...(changes[STORAGE_KEY].newValue || {}), ...readTabSettings() };
    }
    if (changes[PAGE_KEY]) {
      const pageSettings = changes[PAGE_KEY].newValue?.[pageId()] || {};
      state.settings = { ...state.settings, ...pageSettings, ...readTabSettings() };
    }
    if (changes[COUNTERS_KEY]) {
      const counters = changes[COUNTERS_KEY].newValue || {};
      state.approvalsClicked = counters.approvalsClicked || 0;
      state.continuesSent = counters.continuesSent || 0;
    }
  });

  loadSettings().then(() => {
    scheduleNextPeriodicRefresh();
    installObserver();
    scan();
  });
})();
