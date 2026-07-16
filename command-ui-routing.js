((root, factory) => {
  const Base = typeof module === "object" && module.exports ? require("./command-ui.js") : root.YOLOCommandUI;
  const api = factory(Base);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YOLOCommandUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (Base) => {
  "use strict";

  return Object.freeze({ ...Base });
});
