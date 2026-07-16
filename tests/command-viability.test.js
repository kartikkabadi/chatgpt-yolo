const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Commands = require("../command-viability.js");
const Routing = require("../command-ui-routing.js");

const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("public catalog exposes only viable and accurately named commands", () => {
  const names = Commands.COMMANDS.map((entry) => entry.name);
  assert.deepEqual(names, [
    "goal", "loop", "plan", "review", "fix", "handoff", "continue",
    "status", "pause", "resume", "stop", "settings", "help"
  ]);
  assert.equal(Commands.parseInvocation("/compact"), null);
  assert.equal(Commands.parseInvocation("/queue"), null);
  assert.equal(Commands.parseInvocation("/clear"), null);
  assert.equal(Commands.parseInvocation("/handoff deployment").args, "deployment");
});

test("prompt shortcuts are honest about their capabilities", () => {
  for (const name of ["plan", "review", "fix", "handoff", "continue"]) {
    assert.equal(Commands.command(name).group, "Prompt shortcuts");
    assert.match(Commands.command(name).description, /prompt|summary/i);
  }
  assert.match(Commands.oneShotPrompt("compact", "deployment"), /Handoff focus: deployment/);
  assert.match(Commands.oneShotPrompt("compact"), /does not compact, delete, or alter ChatGPT's context/);
  assert.match(Commands.oneShotPrompt("continue", "tests"), /Continue with this emphasis: tests/);
});

test("both automated workflows fail closed when ChatGPT omits the marker", () => {
  for (const kind of ["goal", "loop"]) {
    const workflow = Commands.normalizeWorkflow({
      kind,
      objective: "ship",
      status: "running",
      awaitingResponse: true,
      promptFingerprint: "owned"
    }, 1000);
    const result = Commands.decideWorkflowResponse(workflow, "work without marker", {
      userFingerprint: "owned",
      at: 1100
    });
    assert.equal(result.action, "paused");
    assert.equal(result.code, `command.${kind}.marker_missing`);
  }
  const loop = Commands.startWorkflow("loop", "2 test").workflow;
  assert.match(Commands.workflowPrompt(loop), /missing or malformed marker pauses/i);
});

test("public semantic names route to stable internal actions", () => {
  assert.equal(Routing.routeName("handoff"), "compact");
  assert.equal(Routing.routeName("stop"), "clear");
  assert.equal(Routing.routeName("status"), "status");
});

test("every injection path loads the viability layers before the runtime", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const scripts = manifest.content_scripts[0].js;
  const expected = [
    "commands.js", "command-viability.js", "command-ui.js",
    "command-ui-routing.js", "content.js", "command-runtime.js"
  ];
  for (let index = 0; index < expected.length - 1; index += 1) {
    assert.ok(scripts.indexOf(expected[index]) < scripts.indexOf(expected[index + 1]));
  }
  assert.match(read("popup.html"), /command-injection-routing\.js/);
  assert.match(read("options-ui.js"), /installInjectionRouting/);
  assert.match(read("command-injection-routing.js"), /command-viability\.js/);
  assert.match(read("command-injection-routing.js"), /command-ui-routing\.js/);
});

test("release validation and packaging include every viability module", () => {
  const pkg = JSON.parse(read("package.json"));
  for (const file of ["command-viability.js", "command-ui-routing.js", "command-injection-routing.js"]) {
    assert.match(pkg.scripts.check, new RegExp(file.replace(".", "\\.")));
    assert.match(read("scripts/package.mjs"), new RegExp(`"${file.replace(".", "\\.")}"`));
  }
});
