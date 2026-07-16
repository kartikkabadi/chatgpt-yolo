from pathlib import Path
import hashlib
import subprocess

parts = sorted(Path(".").glob(".reliability-patch.*"))
if not parts:
    raise RuntimeError("Reliability patch parts are missing")

patch = b"".join(part.read_bytes() for part in parts)
expected_size = 69_998
expected_sha256 = "9d8cc13926f99ab3c0ee06be318d296fe0b67d03c7c7370528761b1667002643"
actual_sha256 = hashlib.sha256(patch).hexdigest()
if len(patch) != expected_size or actual_sha256 != expected_sha256:
    raise RuntimeError(
        f"Reliability patch integrity failure: {len(patch)} bytes, sha256={actual_sha256}"
    )

subprocess.run(
    ["git", "apply", "--whitespace=error-all", "-"],
    input=patch,
    check=True,
)
