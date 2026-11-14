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


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILLS_ROOT = ROOT / "skills"
# Receiving-layout adaptation: the source repository root maps to this plugin folder;
# the source root README/NOTICE are imported as docs/source-readme.md and docs/source-notice.md.
PLUGIN = ROOT
SOURCE_README = ROOT / "docs" / "source-readme.md"
SOURCE_NOTICE = ROOT / "docs" / "source-notice.md"
SPECIALISTS = ("azure-diagnostics", "microsoft-foundry")
# Receiving-repository scaffold files required by this repo, not source payload.
RECEIVING_SCAFFOLD = {".mcp.json", "LICENSE"}


def skill_dir(name):
    if name in SPECIALISTS:
        return SKILLS_ROOT / "troubleshoot-observability" / "references" / name
    return SKILLS_ROOT / name
VERSION = "0.3.38"
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
    if filename.startswith(".env") or filename in {".mcp.json", ".lab-context.json"}:
        return "machine integration or private configuration"
    if Path(filename).suffix in {
        ".pyc", ".pyo", ".pem", ".key", ".pfx", ".p12", ".log", ".zip",
        ".db", ".sqlite",
    }:
        return "secret, cache, or generated output"
    return None


class SubmissionTests(unittest.TestCase):
    @unittest.skip("Receiving-layout adaptation: the source Awesome Copilot six-skill manifest (plugins/observability-super-skill/plugin.json @ 18f482ad) is intentionally not imported; this plugin uses the receiving repository manifest.")
    def test_exact_manifest_and_six_entry_names(self):
        manifest = json.loads((PLUGIN / "plugin.json").read_text("utf-8"))
        self.assertEqual(manifest["name"], PLUGIN.name)
        self.assertEqual(manifest["version"], VERSION)
        self.assertEqual(manifest["$schema"],
                         "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json")
        self.assertEqual(manifest["repository"], "https://github.com/github/awesome-copilot")
        self.assertNotIn("license", manifest)
        self.assertEqual({path.name for path in SKILLS_ROOT.iterdir()}, SKILLS)
        self.assertFalse((ROOT / "plugin").exists())
        self.assertFalse((PLUGIN / "skills").exists())

    @unittest.skip("Receiving-layout adaptation: the source Awesome Copilot six-skill manifest (plugins/observability-super-skill/plugin.json @ 18f482ad) is intentionally not imported; this plugin uses the receiving repository manifest.")
    def test_composition_is_sorted_complete_and_resolvable(self):
        manifest = json.loads((PLUGIN / "plugin.json").read_text("utf-8"))
        refs = manifest["extensions"]["com.github.awesome-copilot"]["skills"]
        self.assertEqual(refs, sorted("./skills/" + name + "/" for name in SKILLS))
        self.assertEqual(len(refs), len(set(refs)))
        self.assertLessEqual(len(manifest["description"]), 500)
        self.assertTrue(manifest["author"]["name"])
        for keyword in manifest["keywords"]:
            self.assertRegex(keyword, r"^[a-z0-9-]{1,30}$")
        for reference in refs:
            self.assertTrue((ROOT / reference / "SKILL.md").is_file())

    def test_six_required_frontmatter_scalars_are_lexically_safe(self):
        for name in SKILLS:
            with self.subTest(skill=name):
                metadata = lint_entry_frontmatter(
                    (skill_dir(name) / "SKILL.md").read_text("utf-8"))
                self.assertEqual(metadata["name"], name)
                self.assertRegex(name, r"^[a-z0-9-]{1,64}$")
                self.assertTrue(10 <= len(metadata["description"]) <= 1024)

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

    @unittest.skip("Receiving-layout adaptation: tests/candidate-inventory.json records source-layout hashes and is intentionally not imported.")
    def test_exact_candidate_repository_hashes(self):
        candidate = json.loads((ROOT / "tests/candidate-inventory.json").read_text("utf-8"))
        self.assertEqual(candidate["schema_version"], 2)
        self.assertEqual(candidate["version"], VERSION)
        self.assertEqual(candidate["layout"], "awesome-copilot-in-repository")
        self.assertEqual(candidate["skill_count"], 6)
        actual = public_files()
        del actual["tests/candidate-inventory.json"]
        self.assertEqual(set(candidate["sha256"]), set(actual))
        self.assertEqual(candidate["repository_file_count"], len(actual))
        for relative, path in actual.items():
            with self.subTest(file=relative):
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),
                                 candidate["sha256"][relative])
        self.assertEqual(candidate["skill_asset_count"],
                         sum(path.is_file() for path in SKILLS_ROOT.rglob("*")))

    def test_git_checkout_filters_preserve_exact_bytes(self):
        paths = list(public_files().values())
        result = subprocess.run(
            ["git", "-C", str(ROOT), "hash-object", "--stdin-paths"],
            input="".join(str(path) + "\n" for path in paths),  # absolute: receiving plugin is not the git top level
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = []
        for path in paths:
            data = path.read_bytes()
            expected.append(hashlib.sha1(
                b"blob " + str(len(data)).encode("ascii") + b"\0" + data
            ).hexdigest())
        self.assertEqual(result.stdout.splitlines(), expected)

    def test_customer_docs_use_current_name_layout_and_limits(self):
        for path in [SOURCE_README, PLUGIN / "README.md",
                     *(ROOT / "docs").glob("*.md")]:
            content = path.read_text("utf-8")
            with self.subTest(path=path):
                self.assertNotRegex(content, r"(?i)Start-Lab|labs[/\\]|run_lab|setup_lab")
                self.assertNotRegex(content, r"(?i)[A-Z]:[\\/]+Users[\\/]|AppData[\\/]|session-state")
        for path in (SOURCE_README, PLUGIN / "README.md"):
            content = path.read_text("utf-8")
            self.assertTrue(content.startswith("# Azure Observability Skill Plugin\n"))
            self.assertIn(VERSION, content)
            self.assertIn("## Prerequisites", content)
            self.assertIn("## Permissions and", content)
            self.assertIn("INCONCLUSIVE", content)
            self.assertIn("Contributor information", content)
            self.assertIn("### Installation after marketplace publication", content)
            self.assertIn("It isn't listed yet.", content)
            self.assertIn(
                "copilot plugin install observability-super-skill@awesome-copilot",
                content,
            )
            self.assertIn("@agentPlugins", content)
            self.assertNotIn("approved distribution channel", content)

    def test_no_forbidden_assets_or_symlinks(self):
        for relative, path in public_files().items():
            with self.subTest(path=relative):
                self.assertFalse(path.is_symlink())
                if relative not in RECEIVING_SCAFFOLD:
                    self.assertIsNone(asset_problem(relative))
                self.assertLessEqual(path.stat().st_size, 5 * 1024 * 1024)
        # Receiving repository requires a plugin LICENSE; source asserted none at repo root.
        self.assertFalse((ROOT / "LICENSE.md").exists())
        self.assertFalse((ROOT / "tests/export-inventory.json").exists())

    def test_readme_scenarios_are_collapsible_and_bounded(self):
        for path in (SOURCE_README, PLUGIN / "README.md"):
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
            "skills/troubleshoot-observability/references/microsoft-foundry/resource/private-network/template.bicep"))

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
                        shared = SKILLS_ROOT / "troubleshoot-observability/references"
                        self.assertTrue(
                            destination.is_relative_to(skill)
                            or destination in {
                                (shared / name).resolve()
                                for name in (
                                    "trace-capabilities.md", "next-actions.md",
                                    "specialists.md", "host-tests.md",
                                )
                            }
                        )

    def test_no_machine_paths_in_skill_payload(self):
        for path in SKILLS_ROOT.rglob("*"):
            if path.is_file():
                with self.subTest(path=path):
                    self.assertNotRegex(path.read_text("utf-8-sig"),
                                        r"(?i)[A-Z]:[\\/]+Users[\\/]")

    def test_license_notices_and_readonly_boundaries_remain(self):
        for name in ("azure-diagnostics", "microsoft-foundry"):
            directory = skill_dir(name)
            self.assertTrue((directory / "LICENSE.md").is_file())
            self.assertIn("fbda857c484a85c7ce644f56809b7f204471fb69",
                          (directory / "references/provenance.md").read_text("utf-8"))
        self.assertIn("permission to ship", " ".join(
            (SKILLS_ROOT / "assess-observability-health/references/provenance.md")
            .read_text("utf-8").split()))
        for name in SKILLS:
            self.assertRegex((skill_dir(name) / "SKILL.md").read_text("utf-8"),
                             r"(?i)read.only|supplied.{0,30}evidence")

    @unittest.skip("Receiving-layout adaptation: the source root .gitignore is not imported (it ignores .mcp.json, which this repository requires); ignore policy is the receiving repository's.")
    def test_private_and_generated_state_is_ignored(self):
        for relative in (".env", ".obs/application.json", ".foundry/cache.json",
                         ".local-context/private.md", ".test-work/file.json",
                         "results/evidence.json", ".venv/pyvenv.cfg"):
            with self.subTest(path=relative):
                result = subprocess.run(
                    ["git", "-C", str(ROOT), "check-ignore", "--no-index", relative],
                    capture_output=True, text=True, timeout=20,
                )
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_owned_python_helpers_parse_and_offer_offline_help(self):
        scripts = [
            "connect-observability/scripts/onboarding.py",
            "verify-observability-fix/scripts/recovery.py",
            "assess-observability-health/scripts/render_inline_health_visual.py",
            "assess-observability-health/scripts/build_appinsights_trace_link.py",
            "troubleshoot-observability/references/azure-diagnostics/investigation/scripts/query_prometheus.py",
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

    def test_public_notice_does_not_claim_release_or_blanket_license(self):
        content = SOURCE_NOTICE.read_text("utf-8")
        self.assertIn("No repository-wide license is declared", content)
        self.assertIn("earlier Git", content)
        self.assertIn("Receiving-project license acceptance", content)


if __name__ == "__main__":
    unittest.main()
