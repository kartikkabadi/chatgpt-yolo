(() => {
  "use strict";

  const scripting = globalThis.chrome?.scripting;
  if (!scripting?.executeScript || scripting.__YOLO_COMMAND_ROUTING__) return;
  const executeScript = scripting.executeScript.bind(scripting);
  const after = (files, target, additions) => {
    const index = files.indexOf(target);
    if (index < 0) return files;
    files.splice(index + 1, 0, ...additions.filter((file) => !files.includes(file)));
    return files;
  };

  scripting.executeScript = (details, callback) => {
    if (!Array.isArray(details?.files)) return executeScript(details, callback);
    const files = [...details.files];
    after(files, "commands.js", ["command-viability.js"]);
    after(files, "command-ui.js", ["command-ui-routing.js"]);
    return executeScript({ ...details, files }, callback);
  };
  Object.defineProperty(scripting, "__YOLO_COMMAND_ROUTING__", { value: true });
})();
