"""Offline missing-sibling instruction contracts, not installed-host behavior."""

from pathlib import Path
import re
import shutil
import tempfile
import unittest
from urllib.parse import unquote, urlsplit

from _adaptation import SHARED_NAMES, SHARED_SKILLS, normalize_contract_links


ROOT = (Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill")
SKILLS = ROOT / "skills"
SHARED = {"trace-capabilities.md", "next-actions.md", "specialists.md", "host-tests.md"}
LINK = re.compile(r"\]\(([^)]*(?:references/shared/|troubleshoot-observability/)[^)]+)\)")


def shared_links(path):
    return LINK.findall(path.read_text("utf-8"))


class StandaloneSkillContracts(unittest.TestCase):
    def test_every_entry_gates_sibling_use_without_changing_the_bundle(self):
        entries = list(SKILLS.glob("*/SKILL.md"))
        self.assertEqual(len(entries), 6)
        for entry in entries:
            text = " ".join(entry.read_text("utf-8").split())
            with self.subTest(skill=entry.parent.name):
                if entry.parent.name == "microsoft-foundry":
                    for phrase in ("Standalone availability gate", "unknown",
                                   "unavailable", "missing sibling-file read",
                                   "When present", "Missing shared guidance", "stay local"):
                        self.assertIn(phrase, text)
                    self.assertRegex(text.casefold(), r"never.{0,80}(install|download)")
                    self.assertLess(text.index("Standalone availability gate"),
                                    LINK.search(text).start())
                    continue
                for phrase in (
                    "Standalone availability gate", "For an admitted task",
                    "check availability before reading any cross-skill reference",
                    "Individual installation may omit them",
                    "Use available shared instructions unchanged in the bundle",
                    "their use below is conditional",
                    "Unknown availability follows the missing-reference fallback",
                    "Never download, install or attempt a mandatory missing sibling-file read",
                ):
                    self.assertIn(phrase, text)

    def test_every_shared_reference_site_is_guarded_before_a_read(self):
        sites = [path for path in SKILLS.rglob("*.md") if shared_links(path)]
        self.assertTrue(sites)
        for path in sites:
            text = path.read_text("utf-8")
            with self.subTest(path=path):
                self.assertIn("Standalone availability gate", text)
                self.assertLess(text.index("Standalone availability gate"),
                                LINK.search(text).start())
                self.assertIn("missing sibling-file read", text)
                for target in shared_links(path):
                    destination = (path.parent / target.split("#")[0]).resolve()
                    self.assertIn(destination.name, SHARED)
                    self.assertTrue(destination.is_file(), "Bundle must retain the shared reference.")
                    skill = SKILLS / path.relative_to(SKILLS).parts[0]
                    self.assertTrue(destination.is_relative_to(skill))

    def test_local_shared_contracts_match_the_coordinator_without_instruction_drift(self):
        source = SKILLS / "troubleshoot-observability/references"
        for name in sorted(SHARED_SKILLS):
            shared = SKILLS / name / "references/shared"
            self.assertEqual({path.name for path in shared.iterdir()}, SHARED_NAMES)
            for filename in sorted(SHARED_NAMES):
                with self.subTest(skill=name, contract=filename):
                    self.assertEqual(
                        normalize_contract_links((shared / filename).read_text("utf-8")),
                        normalize_contract_links((source / filename).read_text("utf-8")),
                    )

    def test_individually_copied_skills_have_no_required_coordinator_file(self):
        scratch = Path(__file__).resolve().parents[3] / "tmp" / "observability-super-skill"
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            for entry in SKILLS.glob("*/SKILL.md"):
                if entry.parent.name == "troubleshoot-observability":
                    continue
                isolated = Path(temporary) / entry.parent.name
                shutil.copytree(entry.parent, isolated)
                self.assertFalse((isolated.parent / "troubleshoot-observability").exists())
                for document in isolated.rglob("*.md"):
                    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)",
                                             document.read_text("utf-8")):
                        parsed = urlsplit(target.split(' "', 1)[0])
                        if parsed.scheme or target.startswith("#"):
                            continue
                        with self.subTest(skill=entry.parent.name, reference=target):
                            destination = (document.parent / unquote(parsed.path)).resolve()
                            self.assertTrue(destination.is_relative_to(isolated))
                            self.assertTrue(destination.is_file())
                self.assertIn("handoff", (isolated / "SKILL.md").read_text("utf-8").casefold())

    def test_standalone_fallbacks_preserve_scope_and_do_not_create_services(self):
        investigation = (SKILLS / "azure-diagnostics/investigation/README.md").read_text("utf-8")
        trace = (SKILLS / "microsoft-foundry/foundry-agent/trace/trace.md").read_text("utf-8")
        for text in (investigation, trace):
            for phrase in ("scope/window", "existing authorized", "invented",
                           "fix/rollback plan-review question", "smallest missing evidence"):
                self.assertIn(phrase, text)
        self.assertIn("skip optional SRE review", investigation)
        self.assertIn("Missing recovery instructions block that handoff", investigation)
        portal = (SKILLS / "azure-diagnostics/investigation/references/portal-links.md").read_text("utf-8")
        self.assertIn("verified existing source/component link or omit", portal)
        self.assertIn("Do not guess a portal route or read new telemetry", portal)
        connection = (SKILLS / "connect-observability/SKILL.md").read_text("utf-8")
        self.assertIn("return readiness and the precise", connection)
        self.assertIn("not a health or", connection)
        recovery = (SKILLS / "verify-observability-fix/SKILL.md").read_text("utf-8")
        self.assertIn("run only this local supplied-evidence", recovery)
        self.assertIn("no diagnosis, new reads or edits follow", recovery)


if __name__ == "__main__":
    unittest.main()
