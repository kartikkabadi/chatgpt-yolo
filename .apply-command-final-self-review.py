from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one match in {path}, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new))


replace_once(
    'command-runtime.js',
    '''      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.promptFingerprint = Commands.fingerprint(prompt);
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;''',
    '''      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.promptFingerprint = Commands.fingerprint(prompt);'''
)

post_send = '''      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.reason = "Waiting for ChatGPT";'''
post_send_fixed = '''      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.reason = "Waiting for ChatGPT";'''
replace_once('command-runtime.js', post_send, post_send_fixed)

pending_transition = '''          next.pendingItemId = "";
          next.awaitingResponse = true;
          next.sawGeneration = false;
          next.responseCandidateFingerprint = "";
          next.responseCandidateSince = 0;
          next.baselineFingerprint = latestAssistantFingerprint();
          next.lastAssistantFingerprint = next.baselineFingerprint;
          next.reason = "Waiting for ChatGPT";'''
pending_fixed = '''          next.pendingItemId = "";
          next.awaitingResponse = true;
          next.sawGeneration = false;
          next.responseCandidateFingerprint = "";
          next.responseCandidateSince = 0;
          next.reason = "Waiting for ChatGPT";'''
replace_once('command-runtime.js', pending_transition, pending_fixed)

completion_transition = '''      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();
      next.lastAssistantFingerprint = next.baselineFingerprint;
      next.reason = "Waiting for ChatGPT";'''
completion_fixed = '''      next.pendingItemId = "";
      next.awaitingResponse = true;
      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.reason = "Waiting for ChatGPT";'''
replace_once('command-runtime.js', completion_transition, completion_fixed)

append = r'''

test("workflow response baseline is captured only before prompt delivery", () => {
  const runtime = read("command-runtime.js");
  const captures = runtime.match(/next\.baselineFingerprint = latestAssistantFingerprint\(\)/g) || [];
  assert.equal(captures.length, 1);
  const capture = runtime.indexOf("next.baselineFingerprint = latestAssistantFingerprint()");
  const enqueue = runtime.indexOf('type: "YOLO_WORKFLOW_QUEUE_ADD"');
  assert.ok(capture >= 0 && capture < enqueue);
});
'''
ui = read('tests/ui.test.js')
if 'workflow response baseline is captured only before prompt delivery' not in ui:
    write('tests/ui.test.js', ui.rstrip() + append)

print('Final self-review baseline race fixed')
