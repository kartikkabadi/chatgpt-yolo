const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const contentSource = fs.readFileSync(path.join(root, "content.js"), "utf8");

function extractFunctionBody(source, name) {
  const startMarker = `function ${name}(`;
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Function ${name} not found in content.js`);
  const protoEnd = source.indexOf(")", start) + 1;
  const braceStart = source.indexOf("{", protoEnd);
  if (braceStart === -1) throw new Error(`Function ${name} has no opening brace`);
  let depth = 0;
  let i = braceStart;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
    i += 1;
  }
  throw new Error(`Function ${name} has unbalanced braces`);
}

test("markUserActivity source references ContentState.saveRuntime, not a bare saveRuntime", () => {
  const body = extractFunctionBody(contentSource, "markUserActivity");
  assert.match(body, /ContentState\.saveRuntime/);
  assert.doesNotMatch(body, /(?<!ContentState\.)saveRuntime/);
});

test("markUserActivity schedules ContentState.saveRuntime on a 500 ms timer", (t, done) => {
  const body = extractFunctionBody(contentSource, "markUserActivity");
  let stubCallCount = 0;
  let lastDelayMs = null;
  const context = {
    state: {
      runtime: { lastUserActivityAt: 0 },
      activitySaveTimer: null
    },
    ContentState: {
      saveRuntime: () => { stubCallCount += 1; }
    },
    now: () => 12345,
    window: {
      clearTimeout: () => {},
      setTimeout: (fn, ms) => {
        lastDelayMs = ms;
        // Invoke synchronously to keep the test fast while still exercising the timer path.
        setImmediate(fn);
        return "activityTimer";
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(`function markUserActivity(event) { ${body} }`, context);
  context.markUserActivity({ isTrusted: true });

  assert.equal(context.state.runtime.lastUserActivityAt, 12345);
  assert.equal(lastDelayMs, 500);

  // Give the synchronous setImmediate a tick to fire the saved callback.
  setImmediate(() => {
    assert.equal(stubCallCount, 1, "ContentState.saveRuntime should be called after the timer fires");
    done();
  });
});
