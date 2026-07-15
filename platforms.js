((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOPlatforms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const NEGATIVE_RE = /\b(deny|decline|reject|cancel|stop|no|disallow|do not|don't|dismiss)\b/i;
  const DETAILS_RE = /\b(details?|learn more|view)\b/i;
  const SAFE_APPROVAL_RE = /\b(allow|approve|accept|continue|run|grant|authorize|confirm)\b/i;
  const WRITE_APPROVAL_RE = /\b(create|update|edit|commit|push|open|apply|write)\b/i;
  const DESTRUCTIVE_APPROVAL_RE = /\b(merge|delete|remove|close|force|overwrite|reset|revert|discard)\b/i;
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
    }),
    grok: Object.freeze({
      id: "grok",
      label: "Grok",
      supportsApprovals: false,
      composerSelectors: [
        "textarea[placeholder*='Ask' i]",
        "textarea[placeholder*='Message' i]",
        "textarea[aria-label*='Ask' i]",
        "textarea[aria-label*='Message' i]",
        "form textarea",
        "form div[contenteditable='true'][role='textbox']",
        "div[contenteditable='true'][aria-label*='Ask' i]",
        "div[contenteditable='true'][aria-label*='Message' i]"
      ],
      sendSelectors: [
        "button[data-testid*='send' i]",
        "button[aria-label*='Send' i]",
        "button[aria-label*='Submit' i]",
        "button[title*='Send' i]",
        "button[type='submit']"
      ],
      generationSelectors: [
        "button[aria-label*='Stop' i]",
        "button[title*='Stop' i]",
        "button[data-testid*='stop' i]"
      ],
      errorSelectors: [
        "[role='alert']",
        "[data-testid*='error' i]",
        "[class*='error' i]"
      ]
    })
  });

  function adapterForLocation(locationLike = globalThis.location) {
    const host = String(locationLike?.hostname || "").toLowerCase();
    if (host === "chatgpt.com" || host.endsWith(".chatgpt.com")) return ADAPTERS.chatgpt;
    if (host === "grok.com" || host.endsWith(".grok.com")) return ADAPTERS.grok;
    return null;
  }

  function visible(element) {
    if (!element || typeof Element === "undefined" || !(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = globalThis.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
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

  function findSendButton(adapter, composer, documentLike = document) {
    if (!adapter || !composer) return null;
    const form = composer.closest?.("form");
    const scoped = form ? Array.from(form.querySelectorAll("button")) : [];
    const explicit = adapter.sendSelectors.flatMap((selector) => Array.from(documentLike.querySelectorAll(selector)));
    const candidates = uniqueElements([...scoped, ...explicit]);

    return candidates.find((button) => {
      if (!visible(button) || isDisabled(button)) return false;
      const text = buttonText(button);
      const testId = String(button.getAttribute?.("data-testid") || "");
      const signal = /\b(send|submit)\b/i.test(text) || /send|submit/i.test(testId) || (form && button.type === "submit");
      return signal && !NEGATIVE_RE.test(text);
    }) || null;
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

  function composerText(composer) {
    if (!composer) return "";
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) return composer.value || "";
    return normalizedText(composer);
  }

  function setNativeValue(input, value) {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
  }

  function setComposerValue(composer, value) {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      setNativeValue(composer, value);
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      composer.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const selection = globalThis.getSelection?.();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection?.removeAllRanges();
    selection?.addRange(range);

    if (document.execCommand) document.execCommand("insertText", false, value);
    else composer.textContent = value;
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  function submitComposer(adapter, composer, documentLike = document) {
    const sendButton = findSendButton(adapter, composer, documentLike);
    if (sendButton) {
      sendButton.click();
      return true;
    }

    const options = { key: "Enter", code: "Enter", bubbles: true, cancelable: true };
    composer.dispatchEvent(new KeyboardEvent("keydown", options));
    composer.dispatchEvent(new KeyboardEvent("keyup", options));
    return true;
  }

  function approvalVerbAllowed(text, policy) {
    if (NEGATIVE_RE.test(text) || DETAILS_RE.test(text)) return false;
    if (SAFE_APPROVAL_RE.test(text)) return true;
    if (policy === "writes" && WRITE_APPROVAL_RE.test(text)) return true;
    if (policy === "all" && (WRITE_APPROVAL_RE.test(text) || DESTRUCTIVE_APPROVAL_RE.test(text))) return true;
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
        const hasAllowed = localButtons.some((candidate) => approvalVerbAllowed(buttonText(candidate), policy));
        if (hasNegative && hasAllowed) {
          cards.add(node);
          break;
        }
      }
    }

    return Array.from(cards).map((card) => {
      const buttons = Array.from(card.querySelectorAll("button")).filter((button) => visible(button) && !isDisabled(button));
      const candidates = [];

      for (const negative of buttons.filter((button) => NEGATIVE_RE.test(buttonText(button)))) {
        const negativeRect = negative.getBoundingClientRect();
        const rowCandidates = buttons
          .filter((button) => {
            if (button === negative || !approvalVerbAllowed(buttonText(button), policy)) return false;
            const rect = button.getBoundingClientRect();
            const sameRow = Math.abs(rect.top - negativeRect.top) <= 20 || Math.abs(rect.bottom - negativeRect.bottom) <= 20;
            return sameRow && rect.left > negativeRect.right;
          })
          .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
        if (rowCandidates[0]) candidates.push(rowCandidates[0]);
      }

      const approvalButton = candidates.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0] || null;
      return approvalButton ? { card, button: approvalButton, signature: approvalSignature(card, approvalButton) } : null;
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
    findApprovalCards,
    approvalSignature
  });
});
