((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.YOLOOptionsUI = api;
    if (typeof document !== "undefined") {
      api.mount(document, root);
      api.loadPortability(document, root).catch((error) => console.error("YOLO portability failed to load", error));
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function normalizeSearch(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function sectionMatches(searchText, visibleText, query) {
    const needle = normalizeSearch(query);
    if (!needle) return true;
    const haystack = normalizeSearch(`${searchText || ""} ${visibleText || ""}`);
    return needle.split(" ").every((token) => haystack.includes(token));
  }

  function saveStateFor(message) {
    const text = normalizeSearch(message);
    if (!text || text.includes("loading")) return "loading";
    if (text.includes("saving")) return "saving";
    if (text.includes("no conversation")) return "limited";
    if (text.includes("could not") || text.includes("failed") || text.includes("unavailable")) return "error";
    return "saved";
  }

  function loadScript(doc, win, file) {
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.src = win.chrome.runtime.getURL(file);
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${file}`)), { once: true });
      doc.head.append(script);
    });
  }

  async function loadPortability(doc = document, win = window) {
    if (!win.chrome?.runtime?.getURL) return false;
    if (!win.YOLOPortability) await loadScript(doc, win, "portability.js");
    if (!win.YOLOOptionsPortability) await loadScript(doc, win, "options-portability.js");
    return true;
  }

  function mount(doc = document, win = window) {
    const search = doc.querySelector("#settingsSearch");
    const clearSearch = doc.querySelector("#clearSearch");
    const searchEmpty = doc.querySelector("#searchEmpty");
    const sectionCount = doc.querySelector("#sectionCount");
    const saveStatus = doc.querySelector("#saveStatus");
    const saveState = doc.querySelector(".save-state");
    const reducedMotion = Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const links = Array.from(doc.querySelectorAll("[data-section-link]"));
    const sections = Array.from(doc.querySelectorAll("[data-settings-section]"));
    if (!search || !clearSearch || !searchEmpty || !links.length || !sections.length) return { destroy() {} };

    let activeId = links.find((link) => link.getAttribute("aria-current") === "page")?.dataset.sectionLink || sections[0].id;
    let observer = null;
    let saveObserver = null;

    function visibleSections() {
      return sections.filter((section) => !section.hidden);
    }

    function setActive(id) {
      if (!id || !sections.some((section) => section.id === id && !section.hidden)) return;
      activeId = id;
      for (const link of links) {
        if (link.dataset.sectionLink === id) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    }

    function updateSaveState() {
      if (!saveState || !saveStatus) return;
      saveState.dataset.state = saveStateFor(saveStatus.textContent);
    }

    function applySearch() {
      const query = normalizeSearch(search.value);
      let visibleCount = 0;
      for (const section of sections) {
        const visible = sectionMatches(section.dataset.searchText, section.textContent, query);
        section.hidden = !visible;
        if (visible) visibleCount += 1;
      }
      for (const link of links) {
        const section = sections.find((entry) => entry.id === link.dataset.sectionLink);
        link.hidden = Boolean(section?.hidden);
      }
      clearSearch.hidden = !query;
      searchEmpty.hidden = visibleCount > 0;
      sectionCount.textContent = `${visibleCount} section${visibleCount === 1 ? "" : "s"}`;
      if (!visibleSections().some((section) => section.id === activeId)) setActive(visibleSections()[0]?.id);
    }

    function navigateTo(id, { updateHash = true } = {}) {
      const section = sections.find((entry) => entry.id === id && !entry.hidden);
      if (!section) return false;
      setActive(id);
      section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      if (updateHash && win.history?.replaceState) {
        const path = win.location?.pathname || "options.html";
        const query = win.location?.search || "";
        win.history.replaceState(null, "", `${path}${query}#${id}`);
      }
      return true;
    }

    function handleSearchKeydown(event) {
      if (event.key === "Escape" && search.value) {
        event.preventDefault();
        search.value = "";
        applySearch();
      } else if (event.key === "Enter") {
        const first = visibleSections()[0];
        if (first) {
          event.preventDefault();
          navigateTo(first.id);
        }
      }
    }

    function focusSearchShortcut(event) {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const editing = target?.matches?.("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !editing) {
        event.preventDefault();
        search.focus();
      }
    }

    for (const link of links) link.addEventListener("click", () => navigateTo(link.dataset.sectionLink));
    search.addEventListener("input", applySearch);
    search.addEventListener("keydown", handleSearchKeydown);
    clearSearch.addEventListener("click", () => {
      search.value = "";
      applySearch();
      search.focus();
    });
    doc.addEventListener("keydown", focusSearchShortcut);

    const Observer = win.IntersectionObserver;
    if (typeof Observer === "function") {
      observer = new Observer((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && !entry.target.hidden)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      }, { rootMargin: "-16% 0px -68% 0px", threshold: [0.05, 0.25, 0.6] });
      for (const section of sections) observer.observe(section);
    }

    const MutationObserverCtor = win.MutationObserver;
    if (saveStatus && typeof MutationObserverCtor === "function") {
      saveObserver = new MutationObserverCtor(updateSaveState);
      saveObserver.observe(saveStatus, { childList: true, characterData: true, subtree: true });
    }

    applySearch();
    updateSaveState();
    const requested = String(win.location?.hash || "").replace(/^#/, "");
    if (requested) win.setTimeout(() => navigateTo(requested, { updateHash: false }), 0);

    return {
      destroy() {
        observer?.disconnect();
        saveObserver?.disconnect();
        doc.removeEventListener("keydown", focusSearchShortcut);
      },
      applySearch,
      navigateTo,
      setActive
    };
  }

  return Object.freeze({ normalizeSearch, sectionMatches, saveStateFor, loadPortability, mount });
});
