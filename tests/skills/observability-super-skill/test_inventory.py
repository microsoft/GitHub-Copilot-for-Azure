"""Current-layout snapshots stay scoped and never overwrite source provenance."""

import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


REPOSITORY = Path(__file__).resolve().parents[3]
SCRIPT = REPOSITORY / "plugins/observability-super-skill/scripts/update_inventory.py"
SPEC = importlib.util.spec_from_file_location("observability_inventory", SCRIPT)
inventory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory)


class InventoryTests(unittest.TestCase):
    def setUp(self):
        scratch = REPOSITORY / "tmp/observability-super-skill"
        scratch.mkdir(parents=True, exist_ok=True)
        temporary = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "plugin"
        self.root.mkdir()
        self.write("plugin.json", '{"version": "0.0.0-placeholder"}\n')
        self.write("skills/example/SKILL.md", "# Example\n")

    def write(self, relative, text):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        return path

    def test_inventory_hashes_only_this_plugin_and_preserves_input(self):
        outside = self.root.parent / "private.txt"
        outside.write_text("not a plugin asset", encoding="utf-8")
        original = self.root.parent / "candidate-inventory.json"
        original.write_text("historical inventory", encoding="utf-8")
        snapshot = inventory.build_inventory(self.root)
        self.assertEqual(snapshot["inventory_role"], "current-plugin-snapshot")
        self.assertEqual(snapshot["layout"], "github-copilot-for-azure-plugin")
        self.assertEqual(snapshot["version"], "0.0.0-placeholder")
        self.assertEqual(snapshot["skill_count"], 1)
        self.assertEqual(snapshot["skill_asset_count"], 1)
        self.assertEqual(snapshot["plugin_file_count"], 2)
        self.assertEqual(set(snapshot["sha256"]), {"plugin.json", "skills/example/SKILL.md"})
        self.assertEqual(snapshot["sha256"]["skills/example/SKILL.md"],
                         hashlib.sha256(b"# Example\n").hexdigest())
        self.assertEqual(original.read_text("utf-8"), "historical inventory")
        self.assertIn("Not original ZIP", snapshot["verification_boundary"])
        self.assertIn("build stamps", snapshot["verification_boundary"])

    def test_generated_secrets_and_runtime_state_are_excluded_but_mcp_is_public(self):
        for directory in inventory.EXCLUDED:
            self.write(directory + "/private.json", "{}")
        for suffix in inventory.GENERATED_SUFFIXES:
            self.write("generated" + suffix, "private output")
        self.write(".env", "secret")
        self.write(".env.local", "secret")
        self.write(".mcp.json", '{"mcpServers": {}}')
        hashes = inventory.collect_hashes(self.root)
        self.assertEqual(list(hashes), sorted(hashes))
        self.assertEqual(set(hashes), {
            ".mcp.json", "plugin.json", "skills/example/SKILL.md",
        })

    def test_file_symlinks_are_rejected_without_reading_targets(self):
        original = Path.is_symlink
        with patch.object(Path, "is_symlink",
                          lambda path: path.name == "SKILL.md" or original(path)):
            with self.assertRaisesRegex(ValueError, "symlink"):
                inventory.build_inventory(self.root)

    def test_directory_symlinks_are_rejected_without_traversal(self):
        original = Path.is_symlink
        with patch.object(Path, "is_symlink",
                          lambda path: path.name == "skills" or original(path)):
            with self.assertRaisesRegex(ValueError, "symlink"):
                inventory.build_inventory(self.root)

    def test_symlink_root_is_rejected(self):
        with patch.object(Path, "is_symlink", return_value=True):
            with self.assertRaisesRegex(ValueError, "root cannot be a symlink"):
                inventory.build_inventory(self.root)

    def test_missing_or_invalid_manifest_fails_explicitly(self):
        manifest = self.root / "plugin.json"
        manifest.unlink()
        with self.assertRaises(FileNotFoundError):
            inventory.build_inventory(self.root)
        manifest.write_text("{", encoding="utf-8")
        with self.assertRaises(json.JSONDecodeError):
            inventory.build_inventory(self.root)

    def test_cli_prints_reviewable_json_without_writing_files(self):
        before = inventory.collect_hashes(self.root)
        output = io.StringIO()
        with patch.object(inventory, "build_inventory", return_value={"sha256": before}):
            with contextlib.redirect_stdout(output):
                inventory.main()
        self.assertEqual(json.loads(output.getvalue()), {"sha256": before})
        self.assertEqual(inventory.collect_hashes(self.root), before)


if __name__ == "__main__":
    unittest.main()
