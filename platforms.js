((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOPlatforms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const NEGATIVE_RE = /\b(deny|decline|reject|cancel|stop|no|disallow|do not|don't|dismiss)\b/i;
  const DETAILS_RE = /\b(details?|learn more|view)\b/i;
  const SAFE_APPROVAL_RE = /\b(allow|approve|accept|continue|run|grant|authorize|confirm)\b/i;
  const WRITE_APPROVAL_RE = /\b(create|update|edit|commit|push|open|apply|write|modify|change)\b/i;
  const DESTRUCTIVE_APPROVAL_RE = /\b(merge|delete|remove|close|force|overwrite|reset|revert|discard|drop|destroy)\b/i;
  const GITHUB_CONTEXT_RE = /\b(github|repository|pull request|issue|branch|commit|workflow|workspace|permission|tool call)\b/i;

  const ADAPTERS = Object.freeze({
    chatgpt: Object.freeze({
      id: "chatgpt",
      label: "ChatGPT",
      supportsApprovals: true,
      composerSelectors: [
        "#prompt-textarea",
        "textarea[data-testid='prompt-textarea']",
        "div[contenteditable='true'][data-testid='prompt-textarea']",
        "form textarea",
        "form div[contenteditable='true'][role='textbox']"
      ],
      sendSelectors: [
        "button[data-testid='send-button']",
        "button[aria-label*='Send' i]",
        "button[title*='Send' i]"
      ],
      generationSelectors: [
        "button[data-testid='stop-button']",
        "button[aria-label*='Stop generating' i]",
        "button[title*='Stop generating' i]"
      ],
      errorSelectors: [
        "[role='alert']",
        "[data-testid*='error' i]",
        ".text-red-500",
        ".text-red-600",
        ".border-red-500",
        ".border-red-600"
      ]
    })
  });

  function adapterForLocation(locationLike = globalThis.location) {
    const host = String(locationLike?.hostname || "").toLowerCase();
    if (host === "chatgpt.com" || host.endsWith(".chatgpt.com")) return ADAPTERS.chatgpt;
    return null;
  }

  function visible(element) {
    if (!element || element.nodeType !== 1 || typeof element.getBoundingClientRect !== "function") return false;
    const rect = element.getBoundingClientRect();
    const view = element.ownerDocument?.defaultView || globalThis;
    const style = view.getComputedStyle?.(element);
    if (!style) return rect.width > 0 && rect.height > 0;
    return rect.width > 0
      && rect.height > 0
      && style.visibility !== "hidden"
      && style.display !== "none"
      && Number(style.opacity || 1) !== 0;
  }

  function normalizedText(element) {
    return String(element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function buttonText(button) {
    return String(button?.getAttribute?.("aria-label") || button?.getAttribute?.("title") || normalizedText(button)).trim().toLowerCase();
  }

  function isDisabled(element) {
    return Boolean(element?.disabled || element?.getAttribute?.("aria-disabled") === "true");
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function findComposer(adapter, documentLike = document) {
    if (!adapter) return null;
    const candidates = uniqueElements(adapter.composerSelectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return candidates
      .filter((element) => visible(element) && !isDisabled(element))
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }

  function sendSignal(button, form) {
    if (!visible(button) || isDisabled(button)) return false;
    const text = buttonText(button);
    const testId = String(button.getAttribute?.("data-testid") || "");
    const signal = /\b(send|submit)\b/i.test(text) || /send|submit/i.test(testId) || (form && button.type === "submit");
    return signal && !NEGATIVE_RE.test(text);
  }

  function distanceBetween(element, target) {
    const rect = element.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const x = (rect.left + rect.right) / 2 - (targetRect.left + targetRect.right) / 2;
    const y = (rect.top + rect.bottom) / 2 - (targetRect.top + targetRect.bottom) / 2;
    return Math.hypot(x, y);
  }

  function findSendButton(adapter, composer, documentLike = document) {
    if (!adapter || !composer) return null;
    const form = composer.closest?.("form");
    const scoped = form ? Array.from(form.querySelectorAll("button")) : [];
    const scopedMatch = scoped.find((button) => sendSignal(button, form));
    if (scopedMatch) return scopedMatch;

    const explicit = uniqueElements(adapter.sendSelectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector))));
    return explicit
      .filter((button) => sendSignal(button, form))
      .sort((a, b) => distanceBetween(a, composer) - distanceBetween(b, composer))[0] || null;
  }

  function isGenerating(adapter, documentLike = document) {
    if (!adapter) return false;
    const explicit = adapter.generationSelectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector)));
    if (explicit.some((element) => visible(element) && !isDisabled(element))) return true;

    return Array.from(documentLike.querySelectorAll("button")).some((button) => {
      if (!visible(button) || isDisabled(button)) return false;
      return /\b(stop generating|interrupt response|cancel generation)\b/i.test(buttonText(button));
    });
  }

  function findErrorState(adapter, documentLike = document) {
    if (!adapter) return null;
    const explicit = adapter.errorSelectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector)));
    const error = explicit.find((element) => visible(element) && /\b(error|went wrong|try again|retry|failed|network error)\b/i.test(normalizedText(element)));
    if (error) return error;

    return Array.from(documentLike.querySelectorAll("button")).find((button) => {
      if (!visible(button)) return false;
      const context = normalizedText(button.closest?.("[role='alert']") || button.parentElement || button);
      return /\bretry\b/i.test(buttonText(button)) && /\b(error|went wrong|try again|retry|failed)\b/i.test(context);
    }) || null;
  }

  function isTextControl(element) {
    const tag = String(element?.tagName || "").toUpperCase();
    return tag === "TEXTAREA" || tag === "INPUT";
  }

  function composerText(composer) {
    if (!composer) return "";
    if (isTextControl(composer)) return composer.value || "";
    return normalizedText(composer);
  }

  function setNativeValue(input, value) {
    const view = input.ownerDocument?.defaultView || globalThis;
    const prototype = String(input.tagName || "").toUpperCase() === "TEXTAREA"
      ? view.HTMLTextAreaElement?.prototype
      : view.HTMLInputElement?.prototype;
    const setter = prototype ? Object.getOwnPropertyDescriptor(prototype, "value")?.set : null;
    if (setter) setter.call(input, value);
    else input.value = value;
  }

  function setComposerValue(composer, value) {
    composer.focus();
    const ownerDocument = composer.ownerDocument || document;
    const view = ownerDocument.defaultView || globalThis;

    if (isTextControl(composer)) {
      setNativeValue(composer, value);
      composer.dispatchEvent(new view.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      composer.dispatchEvent(new view.Event("change", { bubbles: true }));
      return;
    }

    const selection = view.getSelection?.();
    const range = ownerDocument.createRange();
    range.selectNodeContents(composer);
    selection?.removeAllRanges();
    selection?.addRange(range);

    if (ownerDocument.execCommand) ownerDocument.execCommand("insertText", false, value);
    else composer.textContent = value;
    composer.dispatchEvent(new view.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  function submitComposer(adapter, composer, documentLike = document) {
    const sendButton = findSendButton(adapter, composer, documentLike);
    if (sendButton) {
      sendButton.click();
      return true;
    }

    const form = composer.closest?.("form");
    if (form?.requestSubmit) {
      form.requestSubmit();
      return true;
    }

    const view = composer.ownerDocument?.defaultView || globalThis;
    const options = { key: "Enter", code: "Enter", bubbles: true, cancelable: true };
    composer.dispatchEvent(new view.KeyboardEvent("keydown", options));
    composer.dispatchEvent(new view.KeyboardEvent("keyup", options));
    return true;
  }

  function approvalRisk(text, contextText = "") {
    const button = String(text || "");
    const context = String(contextText || "");
    if (NEGATIVE_RE.test(button) || DETAILS_RE.test(button)) return "blocked";
    const riskText = `${button} ${context}`;
    if (DESTRUCTIVE_APPROVAL_RE.test(riskText)) return "destructive";
    if (WRITE_APPROVAL_RE.test(riskText)) return "write";
    if (SAFE_APPROVAL_RE.test(button)) return "safe";
    return "unknown";
  }


  function submissionObserved(adapter, documentLike = document) {
    if (!adapter) return false;
    if (isGenerating(adapter, documentLike)) return true;
    const composer = findComposer(adapter, documentLike);
    return Boolean(composer) && composerText(composer).trim() === "";
  }

  function approvalVerbAllowed(text, policy, contextText = "") {
    const risk = approvalRisk(text, contextText);
    if (risk === "safe") return true;
    if (risk === "write") return policy === "writes" || policy === "all";
    if (risk === "destructive") return policy === "all";
    return false;
  }

  function approvalSignature(card, button) {
    const text = normalizedText(card)
      .replace(/\b(details?|learn more|view)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    return `${buttonText(button)}::${text}`;
  }

  function findApprovalCards(adapter, policy = "safe", documentLike = document) {
    if (!adapter?.supportsApprovals) return [];
    const visibleButtons = Array.from(documentLike.querySelectorAll("button")).filter(visible);
    const cards = new Set();

    for (const button of visibleButtons) {
      let node = button.parentElement;
      for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.width > 1000 || rect.height > 720) continue;
        const text = normalizedText(node);
        if (!GITHUB_CONTEXT_RE.test(text)) continue;

        const localButtons = Array.from(node.querySelectorAll("button")).filter((candidate) => visible(candidate) && !isDisabled(candidate));
        const hasNegative = localButtons.some((candidate) => NEGATIVE_RE.test(buttonText(candidate)));
        const hasAllowed = localButtons.some((candidate) => approvalVerbAllowed(buttonText(candidate), policy, text));
        if (hasNegative && hasAllowed) {
          cards.add(node);
          break;
        }
      }
    }

    return Array.from(cards).map((card) => {
      const cardText = normalizedText(card);
      const buttons = Array.from(card.querySelectorAll("button")).filter((button) => visible(button) && !isDisabled(button));
      const candidates = [];

      for (const negative of buttons.filter((button) => NEGATIVE_RE.test(buttonText(button)))) {
        const negativeRect = negative.getBoundingClientRect();
        const rowCandidates = buttons
          .filter((button) => {
            if (button === negative || !approvalVerbAllowed(buttonText(button), policy, cardText)) return false;
            const rect = button.getBoundingClientRect();
            const sameRow = Math.abs(rect.top - negativeRect.top) <= 20 || Math.abs(rect.bottom - negativeRect.bottom) <= 20;
            return sameRow && rect.left > negativeRect.right;
          })
          .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
        if (rowCandidates[0]) candidates.push(rowCandidates[0]);
      }

      const approvalButton = candidates.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0] || null;
      return approvalButton ? {
        card,
        button: approvalButton,
        signature: approvalSignature(card, approvalButton),
        risk: approvalRisk(buttonText(approvalButton), cardText)
      } : null;
    }).filter(Boolean);
  }

  return Object.freeze({
    ADAPTERS,
    adapterForLocation,
    visible,
    normalizedText,
    buttonText,
    isDisabled,
    findComposer,
    findSendButton,
    isGenerating,
    findErrorState,
    composerText,
    setComposerValue,
    submitComposer,
    submissionObserved,
    approvalRisk,
    approvalVerbAllowed,
    findApprovalCards,
    approvalSignature
  });
});
