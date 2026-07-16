from pathlib import Path
import hashlib
import json
import subprocess

parts = sorted(Path(".").glob(".reliability-patch.*"))
if not parts:
    raise RuntimeError("Reliability patch parts are missing")

patch = b"".join(part.read_bytes() for part in parts)
expected_size = 72_013
expected_sha256 = "b822c469bef7b51951ecf19ef0fd796a2f270665f1812e2a1691f484db506134"
actual_sha256 = hashlib.sha256(patch).hexdigest()
if len(patch) != expected_size or actual_sha256 != expected_sha256:
    raise RuntimeError(
        f"Reliability patch integrity failure: {len(patch)} bytes, sha256={actual_sha256}"
    )

# The artifact snapshot predated repository metadata added to package.json. Apply
# every product hunk unchanged, then update the current JSON structurally.
package_start = patch.index(b"diff --git a/package.json b/package.json\n")
package_end = patch.index(b"diff --git a/platforms.js b/platforms.js\n", package_start)
product_patch = patch[:package_start] + patch[package_end:]
subprocess.run(
    ["git", "apply", "--whitespace=error-all", "-"],
    input=product_patch,
    check=True,
)

package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
check = package["scripts"]["check"]
needle = "node --check config.js && "
if "node --check coordinator.js" not in check:
    if needle not in check:
        raise RuntimeError("Could not locate the runtime syntax-check insertion point")
    package["scripts"]["check"] = check.replace(
        needle,
        needle + "node --check coordinator.js && ",
        1,
    )
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
