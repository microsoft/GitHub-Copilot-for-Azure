"""Check the package rename without renaming its independently routed skills."""

import fnmatch
import json
from pathlib import Path
import re
import shlex
import unittest


ROOT = Path(__file__).resolve().parents[3]
NAME = "azure-observability"
LEGACY = "observability-super-skill"
PLUGIN = ROOT / "plugins" / NAME
SKILLS = {
    "assess-observability-health", "connect-observability",
    "troubleshoot-observability", "verify-observability-fix",
}


class PluginIdentityTests(unittest.TestCase):
    def test_all_manifest_names_change_but_skill_identifiers_remain_stable(self):
        for directory in ("", ".plugin", ".claude-plugin", ".cursor-plugin"):
            manifest = json.loads((PLUGIN / directory / "plugin.json").read_text("utf-8"))
            with self.subTest(directory=directory):
                self.assertEqual(manifest["name"], NAME)
                self.assertEqual(manifest["version"], "0.0.0-placeholder")
                self.assertEqual(manifest["author"]["name"], "Microsoft")
        self.assertEqual({path.name for path in (PLUGIN / "skills").iterdir()}, SKILLS)
        for name in SKILLS:
            text = (PLUGIN / "skills" / name / "SKILL.md").read_text("utf-8")
            self.assertIn(f"\nname: {name}\n", text)
        self.assertTrue((PLUGIN / "README.md").read_text("utf-8").startswith(
            "# Azure Observability skill plugin\n"))

    def test_registrations_evaluations_and_owners_use_the_new_package(self):
        registry = json.loads((ROOT / "tests" / "skills.json").read_text("utf-8"))
        entries = [item for item in registry["plugins"] if item["name"] == NAME]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["dirname"], NAME)
        self.assertEqual(set(entries[0]["skills"]), SKILLS)
        scheduled = {
            name for value in entries[0]["integrationTestSchedule"].values()
            for name in value.split(",")
        }
        self.assertEqual(scheduled, SKILLS)
        self.assertFalse(any(item["name"] == LEGACY for item in registry["plugins"]))
        self.assertEqual(
            {path.parent.name for path in (ROOT / "evals" / NAME).glob("*/eval.yaml")},
            SKILLS,
        )
        owners = (ROOT / ".github" / "CODEOWNERS").read_text("utf-8")
        for name in SKILLS:
            for parent in ("plugins", "evals"):
                middle = "/skills" if parent == "plugins" else ""
                self.assertIn(f"/{parent}/{NAME}{middle}/{name}/ ", owners)
        for parent in ("plugins", "evals", "eng", "tests/skills"):
            self.assertTrue((ROOT / parent / NAME).is_dir())
            self.assertFalse((ROOT / parent / LEGACY).exists())

    def test_host_cache_patterns_accept_new_paths_and_reject_old_identity(self):
        scripts = PLUGIN / "hooks" / "scripts"
        powershell = (scripts / "pluginPathAllowPattern.ps1").read_text("utf-8")
        ps_patterns = re.findall(r"^\s*'([^']+)'[,]?$", powershell, re.MULTILINE)
        shell = (scripts / "pluginPathAllowPattern.sh").read_text("utf-8")
        shell_patterns = [
            shlex.split(pattern)[0]
            for pattern in re.findall(
                r'^\[\[ "\$p" == (.*?) \]\] && return 0$', shell, re.MULTILINE)
        ]
        self.assertEqual(len(ps_patterns), 4)
        self.assertEqual(len(shell_patterns), 4)
        paths = (
            f"C:/Users/dev/.copilot/installed-plugins/azure/{NAME}/skills/connect-observability/SKILL.md",
            f"C:/Users/dev/.claude/plugins/cache/azure-skills/{NAME}/1.0.2/skills/connect-observability/SKILL.md",
            f"C:/Users/dev/.cursor/plugins/cache/azure-skills/{NAME}/1.0.2/skills/connect-observability/SKILL.md",
            f"C:/agent-plugins/github.com/microsoft/azure-skills/.github/plugins/{NAME}/skills/connect-observability/SKILL.md",
        )
        for path in paths:
            for candidate, expected in (
                (path, True), (path.replace(NAME, LEGACY), False),
                (path.replace(NAME, NAME + "-extra"), False),
            ):
                with self.subTest(path=candidate):
                    self.assertEqual(any(re.search(pattern, candidate, re.IGNORECASE)
                                         for pattern in ps_patterns), expected)
                    self.assertEqual(any(fnmatch.fnmatchcase(candidate, pattern)
                                         for pattern in shell_patterns), expected)

    def test_active_files_have_no_stale_names_except_real_branch_history(self):
        roots = [PLUGIN, ROOT / "eng" / NAME, ROOT / "evals" / NAME,
                 Path(__file__).parent]
        files = [path for root in roots for path in root.rglob("*") if path.is_file()]
        files += list((ROOT / "docs").glob(NAME + "*.md"))
        files += [ROOT / ".github" / "CODEOWNERS", ROOT / "tests" / "skills.json"]
        for path in files:
            if (path == Path(__file__) or path.name in {"LICENSE", "candidate-inventory.json"}
                    or {".test-work", "__pycache__"} & set(path.parts)):
                continue
            with self.subTest(path=path.relative_to(ROOT)):
                text = path.read_text("utf-8")
                text = text.replace("scaffold-" + LEGACY, "actual-pr-branch")
                self.assertNotIn(LEGACY, text)
                self.assertNotRegex(
                    text, r"(?i)Azure Monitor Super Skill|Azure Observability skills plugin")

    def test_original_copyright_and_historical_inventory_are_preserved(self):
        license_text = (PLUGIN / "LICENSE").read_text("utf-8")
        self.assertIn(f"Copyright (c) 2026 {LEGACY} contributors", license_text)
        inventory = json.loads(
            (Path(__file__).parent / "candidate-inventory.json").read_text("utf-8"))
        self.assertTrue(any(path.startswith(f"plugins/{LEGACY}/")
                            for path in inventory["sha256"]))


if __name__ == "__main__":
    unittest.main()
