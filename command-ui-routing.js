((root, factory) => {
  const Base = typeof module === "object" && module.exports ? require("./command-ui.js") : root.YOLOCommandUI;
  const api = factory(Base);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOCommandUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Base) => {
  "use strict";

  const INTERNAL_NAMES = Object.freeze({ handoff: "compact", stop: "clear" });
  const routeName = (name) => INTERNAL_NAMES[name] || name;

  function relabelWorkflowAction() {
    const host = document?.querySelector?.("#yolo-command-host");
    const buttons = Array.from(host?.shadowRoot?.querySelectorAll?.(".workflow .action") || []);
    const button = buttons.find((entry) => entry.textContent?.trim() === "Clear");
    if (button) {
      button.textContent = "Stop";
      button.setAttribute("aria-label", "Stop workflow");
    }
  }

  function mount(options = {}) {
    if (!Base?.mount) return { destroy() {}, update() {}, open() {}, showStatus() {} };
    const execute = typeof options.execute === "function" ? options.execute : async () => ({ ok: false });
    const mounted = Base.mount({
      ...options,
      execute: (name, args) => execute(routeName(name), args)
    });
    relabelWorkflowAction();
    return mounted;
  }

  return Object.freeze({ ...Base, routeName, mount });
});
