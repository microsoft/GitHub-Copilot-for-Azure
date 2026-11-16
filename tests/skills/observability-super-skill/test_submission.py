"""Offline source-composition and public-payload gates; no Azure or model jobs."""

import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from urllib.parse import unquote, urlsplit


REPOSITORY = Path(__file__).resolve().parents[3]
ROOT = REPOSITORY / "plugins" / "observability-super-skill"
SKILLS_ROOT = ROOT / "skills"
PLUGIN = ROOT
VERSION = "0.0.0-placeholder"
SKILLS = {
    "troubleshoot-observability", "connect-observability",
    "assess-observability-health", "verify-observability-fix",
    "azure-diagnostics", "microsoft-foundry",
}
EXCLUDED = {".git", ".test-work", ".local-context"}


def public_files():
    files = {}
    for directory, names, filenames in ROOT.walk():
        names[:] = sorted(name for name in names if name not in EXCLUDED)
        for name in sorted(filenames):
            path = directory / name
            files[path.relative_to(ROOT).as_posix()] = path
    return files


def lint_entry_frontmatter(text):
    """Validate the required single-line YAML scalars, not arbitrary YAML."""
    lines = text.splitlines()
    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        raise ValueError("missing frontmatter delimiters")
    frontmatter = lines[1:lines[1:].index("---") + 1]
    required = {}
    for key in ("name", "description"):
        values = [line[len(key) + 1:].strip()
                  for line in frontmatter if line.startswith(key + ":")]
        if len(values) != 1 or not values[0]:
            raise ValueError("missing or duplicate required scalar: " + key)
        value = values[0]
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as error:
                raise ValueError("malformed quoted scalar: " + key) from error
        elif value.startswith("'"):
            if not re.fullmatch(r"'(?:[^']|'')*'", value):
                raise ValueError("malformed quoted scalar: " + key)
            value = value[1:-1].replace("''", "'")
        elif (re.search(r":(?:\s|$)|(?:^|\s)#", value)
              or value[0] in "-?:,[]{}&*!|>@`%"):
            raise ValueError("ambiguous plain scalar; quote " + key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError("required scalar must be nonempty text: " + key)
        required[key] = value
    return required


def asset_problem(relative):
    parts = Path(relative).parts
    names = {part.casefold() for part in parts}
    filename = parts[-1].casefold()
    if names & {
        ".obs", ".foundry", ".local-context", ".venv", "venv", "__pycache__",
        "labs", "lab", ".azure", ".azd", ".vscode", ".test-work",
        "test-results", "results", "dist", "node_modules",
    }:
        return "private, runtime, or generated directory"
    if filename.startswith(".env") or filename == ".lab-context.json":
        return "machine integration or private configuration"
    if Path(filename).suffix in {
        ".pyc", ".pyo", ".pem", ".key", ".pfx", ".p12", ".log", ".zip",
        ".db", ".sqlite",
    }:
        return "secret, cache, or generated output"
    return None


class SubmissionTests(unittest.TestCase):
    def test_exact_manifest_and_six_entry_names(self):
        manifest = json.loads((PLUGIN / "plugin.json").read_text("utf-8"))
        self.assertEqual(manifest["name"], PLUGIN.name)
        self.assertEqual(manifest["version"], VERSION)
        self.assertEqual(manifest["$schema"],
                         "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json")
        self.assertEqual(manifest["repository"],
                         "https://github.com/microsoft/GitHub-Copilot-for-Azure")
        self.assertEqual(manifest["license"], "MIT")
        self.assertEqual({path.name for path in SKILLS_ROOT.iterdir()}, SKILLS)
        self.assertTrue((PLUGIN / "skills").is_dir())

    def test_composition_is_sorted_complete_and_resolvable(self):
        manifest = json.loads((PLUGIN / "plugin.json").read_text("utf-8"))
        self.assertLessEqual(len(manifest["description"]), 500)
        self.assertNotIn("<Provide", manifest["description"])
        self.assertTrue(manifest["author"]["name"])
        for keyword in manifest["keywords"]:
            self.assertRegex(keyword, r"^[a-z0-9-]{1,30}$")
        for directory in (".plugin", ".claude-plugin", ".cursor-plugin"):
            with self.subTest(host=directory):
                host = json.loads((PLUGIN / directory / "plugin.json").read_text("utf-8"))
                for field in ("name", "description", "version", "license"):
                    self.assertEqual(host[field], manifest[field])
                self.assertEqual(host["skills"], "./skills/")
                self.assertEqual(host["mcpServers"], "./.mcp.json")
                # The build merges shared hook manifests with plugin-local scripts.
                self.assertTrue((REPOSITORY / host["hooks"]).is_file())
        for name in ("pluginPathAllowPattern.ps1", "pluginPathAllowPattern.sh"):
            self.assertTrue((PLUGIN / "hooks/scripts" / name).is_file())
        self.assertEqual(json.loads((PLUGIN / ".mcp.json").read_text("utf-8")),
                         {"mcpServers": {}})
        self.assertEqual(json.loads((PLUGIN / "mcp.json").read_text("utf-8"))["mcpServers"], {})
        for name in SKILLS:
            self.assertTrue((SKILLS_ROOT / name / "SKILL.md").is_file())

    def test_repository_registration_and_build_time_versions(self):
        registration = json.loads((REPOSITORY / "tests/skills.json").read_text("utf-8"))
        entries = [item for item in registration["plugins"] if item["name"] == PLUGIN.name]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["dirname"], PLUGIN.name)
        self.assertEqual(set(entries[0]["skills"]), SKILLS)
        for directory in (PLUGIN, *(SKILLS_ROOT / name for name in sorted(SKILLS))):
            with self.subTest(directory=directory):
                version = json.loads((directory / "version.json").read_text("utf-8"))
                self.assertRegex(version["version"], r"^\d+\.\d+(?:\.\d+)?$")
                self.assertIn(".", version["pathFilters"])
        for name in SKILLS:
            self.assertRegex((SKILLS_ROOT / name / "SKILL.md").read_text("utf-8"),
                             r'(?m)^  version: "0\.0\.0-placeholder"$')

    def test_six_required_frontmatter_scalars_are_lexically_safe(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                metadata = lint_entry_frontmatter(
                    (SKILLS_ROOT / name / "SKILL.md").read_text("utf-8"))
                self.assertEqual(metadata["name"], name)
                self.assertRegex(name, r"^[a-z0-9-]{1,64}$")
                self.assertTrue(10 <= len(metadata["description"]) <= 200)

    def test_frontmatter_rejects_ambiguous_scalars(self):
        for value in ("Health: assess application", "'unterminated", '"unterminated',
                      "health # accidental comment"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    lint_entry_frontmatter(
                        "---\nname: health\ndescription: " + value + "\n---\n")
        for value in ('"Health: assess application"', "'Health: assess application'"):
            self.assertEqual(lint_entry_frontmatter(
                "---\nname: health\ndescription: " + value + "\n---\n"
            )["description"], "Health: assess application")

    def test_original_inventory_preserves_source_provenance_not_current_byte_parity(self):
        candidate = json.loads(
            (Path(__file__).parent / "candidate-inventory.json").read_text("utf-8"))
        self.assertEqual(candidate["schema_version"], 2)
        self.assertEqual(candidate["version"], "0.3.38")
        self.assertEqual(candidate["layout"], "awesome-copilot-in-repository")
        self.assertEqual(candidate["skill_count"], 6)
        self.assertEqual(candidate["inventory_role"], "original-import-source")
        self.assertIn("not current", candidate["verification_boundary"])
        self.assertEqual(candidate["upstream_specialist_commit"],
                         "fbda857c484a85c7ce644f56809b7f204471fb69")
        self.assertEqual(candidate["reviewed_layout_commit"],
                         "222eba62d518c27317e917c92e3ec1a7e6729455")
        self.assertEqual(candidate["repository_file_count"], len(candidate["sha256"]))
        self.assertEqual(
            hashlib.sha256(json.dumps(candidate["sha256"], sort_keys=True,
                                      separators=(",", ":")).encode("utf-8")).hexdigest(),
            "1c6208b9dd954d11419467dbf3dfa6d44410c65484a93b2506f5781531e9e132",
            "Original import hashes must not be regenerated for the adapted layout.",
        )
        for relative, digest in candidate["sha256"].items():
            with self.subTest(file=relative):
                self.assertFalse(Path(relative).is_absolute())
                self.assertNotIn("..", Path(relative).parts)
                self.assertRegex(digest, r"^[a-f0-9]{64}$")
        self.assertEqual(candidate["skill_asset_count"],
                         sum(name.startswith("skills/") for name in candidate["sha256"]))

    def test_git_checkout_filters_normalize_text_to_lf(self):
        paths = list(public_files().values())
        result = subprocess.run(
            ["git", "-C", str(REPOSITORY), "hash-object", "--stdin-paths"],
            input="".join(path.relative_to(REPOSITORY).as_posix() + "\n" for path in paths),
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = []
        for path in paths:
            data = path.read_bytes().replace(b"\r\n", b"\n")
            expected.append(hashlib.sha1(
                b"blob " + str(len(data)).encode("ascii") + b"\0" + data
            ).hexdigest())
        self.assertEqual(result.stdout.splitlines(), expected)

    def test_customer_docs_use_current_name_layout_and_limits(self):
        for path in [PLUGIN / "README.md", *(PLUGIN / "docs").glob("*.md")]:
            content = path.read_text("utf-8")
            with self.subTest(path=path):
                self.assertNotRegex(content, r"(?i)Start-Lab|labs[/\\]|run_lab|setup_lab")
                self.assertNotRegex(content, r"(?i)[A-Z]:[\\/]+Users[\\/]|AppData[\\/]|session-state")
        for path in (PLUGIN / "README.md",):
            content = path.read_text("utf-8")
            self.assertTrue(content.startswith("# Azure Observability Skill Plugin\n"))
            self.assertIn("## Prerequisites", content)
            self.assertIn("## Permissions and", content)
            self.assertIn("INCONCLUSIVE", content)
            self.assertIn("Contributor information", content)
            self.assertIn("npm run build", content)
            self.assertIn("copilot --plugin-dir", content)
            self.assertNotIn("observability-super-skill@awesome-copilot", content)

    def test_no_forbidden_assets_or_symlinks(self):
        for relative, path in public_files().items():
            with self.subTest(path=relative):
                self.assertFalse(path.is_symlink())
                self.assertIsNone(asset_problem(relative))
                self.assertLessEqual(path.stat().st_size, 5 * 1024 * 1024)
        self.assertTrue((PLUGIN / "LICENSE").is_file())
        self.assertTrue((PLUGIN / "NOTICE.md").is_file())

    def test_readme_scenarios_are_collapsible_and_bounded(self):
        for path in (PLUGIN / "README.md",):
            content = path.read_text("utf-8")
            section = content.split("## Scenarios to try\n", 1)[1].split("</details>", 1)[0]
            with self.subTest(path=path):
                self.assertIn("<details>", section)
                self.assertIn("<summary>", section)
                prompts = re.findall(r"```text\n(.*?)\n```", section, re.DOTALL)
                self.assertEqual(len(prompts), 6)
                for prompt in prompts:
                    self.assertNotIn("\n", prompt)
                    self.assertNotIn("<", prompt)
                    self.assertLessEqual(len(prompt), 110)
                for required in (
                    "alert", "customer impact", "OOMKilled", "calls slow",
                    "Don't query Azure", "before-and-after evidence",
                    "asks for missing details", "applicable approval",
                    "bounded source/time window", "coverage gaps",
                    "actual effective change and comparable evidence",
                ):
                    self.assertIn(required, section)
                self.assertNotIn("experimental review candidate", content)

    def test_exclusion_check_rejects_representative_contamination(self):
        for relative in (
            "labs/example/azure.yaml", "skills/example/.env",
            "skills/example/__pycache__/x.pyc", ".local-context/private.md",
            ".obs/application.json", "results/raw.log", "credentials/client.pem",
        ):
            self.assertIsNotNone(asset_problem(relative), relative)
        self.assertIsNone(asset_problem(
            "skills/microsoft-foundry/resource/private-network/template.bicep"))

    def test_all_markdown_local_resources_resolve(self):
        for path in public_files().values():
            if path.suffix != ".md":
                continue
            for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)",
                                     path.read_text("utf-8-sig")):
                target = target.split(' "')[0]
                parsed = urlsplit(target)
                if parsed.scheme or target.startswith("#"):
                    continue
                destination = (path.parent / unquote(parsed.path)).resolve()
                with self.subTest(path=path.relative_to(ROOT), target=target):
                    self.assertTrue(destination.is_relative_to(ROOT))
                    self.assertTrue(destination.is_file())
                    self.assertFalse(EXCLUDED & set(destination.relative_to(ROOT).parts))
                    if path.is_relative_to(SKILLS_ROOT):
                        skill = SKILLS_ROOT / path.relative_to(SKILLS_ROOT).parts[0]
                        self.assertTrue(destination.is_relative_to(skill))

    def test_no_machine_paths_in_skill_payload(self):
        for path in SKILLS_ROOT.rglob("*"):
            if path.is_file():
                with self.subTest(path=path):
                    self.assertNotRegex(path.read_text("utf-8-sig"),
                                        r"(?i)[A-Z]:[\\/]+Users[\\/]")

    def test_license_notices_and_readonly_boundaries_remain(self):
        for name in ("azure-diagnostics", "microsoft-foundry"):
            directory = SKILLS_ROOT / name
            self.assertTrue((directory / "LICENSE.md").is_file())
            self.assertIn("fbda857c484a85c7ce644f56809b7f204471fb69",
                          (directory / "references/provenance.md").read_text("utf-8"))
        self.assertIn("permission to ship", " ".join(
            (SKILLS_ROOT / "assess-observability-health/references/provenance.md")
            .read_text("utf-8").split()))
        for name in SKILLS:
            self.assertRegex((SKILLS_ROOT / name / "SKILL.md").read_text("utf-8"),
                             r"(?i)read.only|supplied.{0,30}evidence")

    def test_private_and_generated_state_is_ignored(self):
        for relative in ("tmp/observability-super-skill/evidence.json",
                         "tests/skills/observability-super-skill/__pycache__/x.pyc",
                         ".venv/pyvenv.cfg"):
            with self.subTest(path=relative):
                result = subprocess.run(
                    ["git", "-C", str(REPOSITORY), "check-ignore", "--no-index", relative],
                    capture_output=True, text=True, timeout=20,
                )
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_owned_python_helpers_parse_and_offer_offline_help(self):
        scripts = [
            "connect-observability/scripts/onboarding.py",
            "verify-observability-fix/scripts/recovery.py",
            "assess-observability-health/scripts/render_inline_health_visual.py",
            "assess-observability-health/scripts/build_appinsights_trace_link.py",
            "azure-diagnostics/investigation/scripts/query_prometheus.py",
        ]
        for relative in scripts:
            path = SKILLS_ROOT / relative
            with self.subTest(helper=relative):
                ast.parse(path.read_text("utf-8"), filename=path.name)
                result = subprocess.run(
                    [sys.executable, "-B", str(path), "--help"], cwd=ROOT,
                    capture_output=True, text=True, timeout=20,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("usage", result.stdout.lower())

    def test_mit_authorization_preserves_notices_and_release_boundaries(self):
        content = (ROOT / "NOTICE.md").read_text("utf-8")
        self.assertIn("earlier Git", content)
        self.assertIn("2026-11-16", content)
        self.assertIn("confirmed authority or contributors' permission", content)
        self.assertIn("does not alter the receiving repository's license", content)
        self.assertIn("or a published product", content)
        license_text = (PLUGIN / "LICENSE").read_text("utf-8")
        self.assertTrue(license_text.startswith("MIT License\n"))
        self.assertIn("Permission is hereby granted, free of charge", license_text)
        self.assertIn("THE SOFTWARE IS PROVIDED \"AS IS\"", license_text)
        for name in SKILLS:
            with self.subTest(skill=name):
                entry = (SKILLS_ROOT / name / "SKILL.md").read_text("utf-8")
                self.assertRegex(entry, r"(?m)^license: MIT$")


if __name__ == "__main__":
    unittest.main()
