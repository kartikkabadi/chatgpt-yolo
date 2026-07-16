from pathlib import Path
import hashlib
import subprocess

parts = sorted(Path(".").glob(".reliability-patch.*"))
if not parts:
    raise RuntimeError("Reliability patch parts are missing")

patch = b"".join(part.read_bytes() for part in parts)
expected_size = 69_998
expected_sha256 = "912ba5d71d5c0012dd9d3694a578d15ebb73c519f6e437ab66c0b17cb914f962"
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
