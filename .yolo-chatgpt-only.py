from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old!r}")
    write(path, content.replace(old, new))


# Manifest: least privilege, ChatGPT hosts only.
manifest_path = ROOT / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
chatgpt_hosts = ["https://chatgpt.com/*", "https://*.chatgpt.com/*"]
manifest["description"] = "Reliable message queues and configurable automation controls for ChatGPT."
manifest["host_permissions"] = chatgpt_hosts
if len(manifest.get("content_scripts", [])) != 1:
    raise RuntimeError("Expected exactly one content-script declaration")
manifest["content_scripts"][0]["matches"] = chatgpt_hosts
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

# Package metadata.
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["description"] = "Reliable Chromium message queues and automation controls for ChatGPT."
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

# Runtime URL support: ChatGPT only.
replace_once(
    "config.js",
    '      return host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "grok.com" || host.endsWith(".grok.com");',
    '      return host === "chatgpt.com" || host.endsWith(".chatgpt.com");',
)

# Remove the entire Grok DOM adapter and host branch.
platforms = read("platforms.js")
platforms, count = re.subn(
    r',\n    grok: Object\.freeze\(\{.*?\n    \}\)\n  \}\);',
    '\n  });',
    platforms,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"Expected to remove one Grok adapter, removed {count}")
old_host_branch = '    if (host === "grok.com" || host.endsWith(".grok.com")) return ADAPTERS.grok;\n'
if platforms.count(old_host_branch) != 1:
    raise RuntimeError("Expected exactly one Grok host branch")
platforms = platforms.replace(old_host_branch, "")
write("platforms.js", platforms)

# User-facing popup copy.
replace_once("popup.js", "Open ChatGPT or Grok to use YOLO.", "Open ChatGPT to use YOLO.")

# Product documentation: ChatGPT-only positioning and release checklist.
readme = read("README.md")
readme = readme.replace(
    "YOLO is a personal Chromium extension for reliably continuing long-running ChatGPT and Grok work.",
    "YOLO is a personal Chromium extension for reliably continuing long-running ChatGPT work.",
)
readme = readme.replace("Open a ChatGPT or Grok conversation.", "Open a ChatGPT conversation.")
readme = readme.replace("`platforms.js` — ChatGPT/Grok DOM adapters and approval risk classification", "`platforms.js` — ChatGPT DOM adapter and approval risk classification")
readme = readme.replace("Open or refresh a ChatGPT or Grok conversation.", "Open or refresh a ChatGPT conversation.")
readme = readme.replace("Popup opens on ChatGPT and Grok and stays unavailable elsewhere.", "Popup opens on ChatGPT and stays unavailable elsewhere.")
readme = readme.replace(
    "ChatGPT and Grok do not provide a stable public DOM contract for browser extensions. The adapters are isolated and fixture-tested, but every release still requires one unpacked-extension smoke pass against the current live interfaces.",
    "ChatGPT does not provide a stable public DOM contract for browser extensions. The adapter is isolated and fixture-tested, but every release still requires one unpacked-extension smoke pass against the current live interface.",
)
if re.search(r"\bgrok\b", readme, flags=re.I):
    raise RuntimeError("README still contains a Grok reference")
write("README.md", readme)

# Adapter tests prove ChatGPT support and explicit rejection of Grok.
replace_once(
    "tests/platforms.test.js",
    '  assert.equal(Platforms.adapterForLocation({ hostname: "www.grok.com" }).id, "grok");',
    '  assert.equal(Platforms.adapterForLocation({ hostname: "www.grok.com" }), null);',
)

# Config tests use ChatGPT examples and explicitly enforce the support boundary.
replace_once(
    "tests/config.test.js",
    '  assert.equal(Config.pageId("https://grok.com/"), "https://grok.com/");',
    '  assert.equal(Config.pageId("https://chatgpt.com/"), "https://chatgpt.com/");',
)
replace_once(
    "tests/config.test.js",
    '  assert.match(Config.lastActionKey("https://grok.com/c/one"), /^yoloLastAction:/);',
    '  assert.match(Config.lastActionKey("https://chatgpt.com/c/one"), /^yoloLastAction:/);',
)
config_tests = read("tests/config.test.js")
anchor = 'test("enforces hourly and session action limits with reason codes", () => {'
if anchor not in config_tests:
    raise RuntimeError("Could not locate config-test insertion point")
config_tests = config_tests.replace(
    anchor,
    'test("supports only ChatGPT URLs", () => {\n'
    '  assert.equal(Config.isSupportedUrl("https://chatgpt.com/c/one"), true);\n'
    '  assert.equal(Config.isSupportedUrl("https://team.chatgpt.com/c/one"), true);\n'
    '  assert.equal(Config.isSupportedUrl("https://grok.com/"), false);\n'
    '  assert.equal(Config.isSupportedUrl("https://example.com/"), false);\n'
    '});\n\n' + anchor,
    1,
)
write("tests/config.test.js", config_tests)

# Manifest tests pin least-privilege host access and ChatGPT-only metadata.
manifest_tests = read("tests/manifest.test.js")
append = '''\n\ntest("manifest grants host access only to ChatGPT", () => {\n  const hosts = ["https://chatgpt.com/*", "https://*.chatgpt.com/*"];\n  assert.deepEqual(manifest.host_permissions, hosts);\n  assert.deepEqual(manifest.content_scripts[0].matches, hosts);\n  assert.doesNotMatch(manifest.description, /grok/i);\n  assert.doesNotMatch(pkg.description, /grok/i);\n});\n'''
if 'manifest grants host access only to ChatGPT' in manifest_tests:
    raise RuntimeError("ChatGPT-only manifest test already exists")
write("tests/manifest.test.js", manifest_tests.rstrip() + append)

# Production invariant: no Grok references in shipped source, metadata, or docs.
for path in [
    "manifest.json",
    "package.json",
    "config.js",
    "platforms.js",
    "content.js",
    "popup.html",
    "popup.js",
    "options.html",
    "options.js",
    "README.md",
    "SECURITY.md",
]:
    if re.search(r"\bgrok\b", read(path), flags=re.I):
        raise RuntimeError(f"Shipped file still contains Grok reference: {path}")

print("ChatGPT-only production scope applied successfully")
