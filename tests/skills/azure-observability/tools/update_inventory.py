r"""Print an opt-in current plugin inventory, without replacing import provenance.

Run from any directory:
    python -B tests\skills\azure-observability\tools\update_inventory.py

Only this plugin's public payload is inventoried, never the surrounding repository,
offline tests, private scratch state, or installed dependencies. Output goes to
stdout for review. The sibling candidate-inventory.json is historical provenance.
"""

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4] / "plugins" / "azure-observability"
EXCLUDED = {
    ".git", ".test-work", ".local-context", ".obs", ".foundry", ".azure",
    ".azd", ".venv", "venv", "__pycache__", "node_modules", "results",
    "test-results", "tmp", "output", "dist",
}
GENERATED_SUFFIXES = {".pyc", ".pyo", ".log", ".pem", ".key", ".pfx", ".p12"}


def collect_hashes(root):
    """Hash public plugin files; reject links instead of traversing their targets."""
    hashes = {}
    for directory, names, files in root.walk():
        for name in sorted(names):
            if name in EXCLUDED:
                continue
            if (directory / name).is_symlink():
                raise ValueError("Source inventory cannot include a symlink: " + name)
        names[:] = sorted(name for name in names if name not in EXCLUDED)
        for name in sorted(files):
            path = directory / name
            if name.startswith(".env") or path.suffix in GENERATED_SUFFIXES:
                continue
            if path.is_symlink():
                raise ValueError("Source inventory cannot include a symlink: " + str(path))
            hashes[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return dict(sorted(hashes.items()))


def build_inventory(root=ROOT):
    """Return a current-layout snapshot, distinct from the original ZIP inventory."""
    root = Path(root)
    if root.is_symlink():
        raise ValueError("Source inventory root cannot be a symlink")
    hashes = collect_hashes(root)
    manifest = json.loads((root / "plugin.json").read_text("utf-8"))
    return {
        "schema_version": 3,
        "inventory_role": "current-plugin-snapshot",
        "version": manifest["version"],
        "layout": "github-copilot-for-azure-plugin",
        "scope": "plugins/azure-observability",
        "skill_count": len(list((root / "skills").glob("*/SKILL.md"))),
        "skill_asset_count": sum(name.startswith("skills/") for name in hashes),
        "plugin_file_count": len(hashes),
        "excluded_directories": sorted(EXCLUDED),
        "excluded_file_suffixes": sorted(GENERATED_SUFFIXES),
        "excluded_file_prefixes": [".env"],
        "original_inventory": "tests/skills/azure-observability/candidate-inventory.json",
        "original_inventory_role": "historical-0.3.38-import-not-current-source",
        "verification_boundary": (
            "Current plugin snapshot only. Not original ZIP or upstream byte parity, "
            "model evaluation, installed-host validation, or publication. "
            "Source versions are placeholders; the repository build stamps real versions."
        ),
        "sha256": hashes,
    }


def main():
    print(json.dumps(build_inventory(), indent=2))


if __name__ == "__main__":
    main()
