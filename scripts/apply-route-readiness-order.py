from pathlib import Path

root = Path(__file__).resolve().parents[1]

content_path = root / "content.js"
content = content_path.read_text()
old = '''    if (automatic && (!automationReady() || !state.settings.queueAutoRunEnabled)) return false;
    if (!automatic && (!state.loaded || !routeIsCurrent())) return false;
    if (!automatic) state.pendingManualQueueRetry = false;

    updateGenerationState();
    const safety = checkSafeForInput();
    if (!safety.safe) {
      if (!automatic) await setBlocked(safety.code, safety.reason);
      scheduleInputRetry(safety, automatic);
      return false;
    }
    if (!automatic) clearBlocked();'''
new = '''    if (automatic && (!automationReady() || !state.settings.queueAutoRunEnabled)) return false;
    if (!automatic) state.pendingManualQueueRetry = false;

    updateGenerationState();
    const safety = checkSafeForInput();
    if (!safety.safe) {
      if (!automatic) await setBlocked(safety.code, safety.reason);
      scheduleInputRetry(safety, automatic);
      return false;
    }
    if (!automatic && !state.loaded) return false;
    if (!automatic) clearBlocked();'''
if content.count(old) != 1:
    raise RuntimeError(f"content.js: expected one handleQueue match, found {content.count(old)}")
content_path.write_text(content.replace(old, new, 1))

test_path = root / "tests/content-queue-safety.test.js"
tests = test_path.read_text()
needle = '''  assert.match(source, /pendingManualQueueRetry && await handleQueue\\(false\\)/);
  assert.doesNotMatch('''
replacement = '''  assert.match(source, /pendingManualQueueRetry && await handleQueue\\(false\\)/);
  assert.doesNotMatch(source, /if \\(!automatic && \\(!state\\.loaded \\|\\| !routeIsCurrent\\(\\)\\)\\) return false/);
  assert.match(source, /if \\(!automatic && !state\\.loaded\\) return false/);
  assert.doesNotMatch('''
if tests.count(needle) != 1:
    raise RuntimeError(f"tests/content-queue-safety.test.js: expected one insertion point, found {tests.count(needle)}")
test_path.write_text(tests.replace(needle, replacement, 1))

Path(__file__).unlink()
