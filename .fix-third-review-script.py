from pathlib import Path

path = Path('.apply-command-third-review.py')
text = path.read_text(encoding='utf-8')
old = '''replace_once(
    "command-runtime.js",
    ''' + "'''" + '''      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();''' + "'''" + ''',
    ''' + "'''" + '''      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();''' + "'''" + ''',
)'''
new = '''runtime_path = ROOT / "command-runtime.js"
runtime_text = runtime_path.read_text(encoding="utf-8")
old_transition = ''' + "'''" + '''      next.sawGeneration = false;
      next.baselineFingerprint = latestAssistantFingerprint();''' + "'''" + '''
new_transition = ''' + "'''" + '''      next.sawGeneration = false;
      next.responseCandidateFingerprint = "";
      next.responseCandidateSince = 0;
      next.baselineFingerprint = latestAssistantFingerprint();''' + "'''" + '''
transition_count = runtime_text.count(old_transition)
if transition_count != 3:
    raise RuntimeError(f"Expected three awaiting-response transitions, found {transition_count}")
runtime_path.write_text(runtime_text.replace(old_transition, new_transition), encoding="utf-8")'''
if text.count(old) != 1:
    raise RuntimeError('Expected one problematic cardinality block')
path.write_text(text.replace(old, new), encoding='utf-8')
print('Third review script now updates all awaiting-response transitions')
