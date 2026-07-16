(() => {
  "use strict";

  for (const key of ["__YOLO_COMMAND_RUNTIME__", "__YOLO_EXTENSION__"]) {
    const runtime = window[key];
    try { runtime?.destroy?.(); } catch { /* Recovery must continue even if stale cleanup fails. */ }
    try { delete window[key]; } catch { window[key] = undefined; }
  }
})();
