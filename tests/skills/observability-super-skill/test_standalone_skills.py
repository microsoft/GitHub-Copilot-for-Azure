"""Offline missing-sibling instruction contracts, not installed-host behavior."""

from pathlib import Path
import re
import shutil
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILLS = ROOT / "skills"

# Receiving-layout adaptation: the source's azure-diagnostics and microsoft-foundry
# specialist trees are imported as references of troubleshoot-observability.
SPECIALISTS = ("azure-diagnostics", "microsoft-foundry")


def skill_dir(name):
    if name in SPECIALISTS:
        return SKILLS / "troubleshoot-observability" / "references" / name
    return SKILLS / name


def entry_files():
    """The six source entry points: four registered skills plus two imported specialists."""
    return sorted(SKILLS.glob("*/SKILL.md")) + [skill_dir(n) / "SKILL.md" for n in SPECIALISTS]
SHARED = {"trace-capabilities.md", "next-actions.md", "specialists.md", "host-tests.md"}
LINK = re.compile(r"\]\(([^)]*troubleshoot-observability/[^)]+)\)")


def shared_links(path):
    # Receiving-layout adaptation: imported specialists now link to the shared
    # coordinator references by relative path; cross-skill links are inline code.
    found = LINK.findall(path.read_text("utf-8"))
    shared_dir = (SKILLS / "troubleshoot-observability" / "references").resolve()
    if path.resolve().parent != shared_dir and path.resolve() != (shared_dir.parent / "SKILL.md"):
        for target in re.findall(r"\]\(([^)]+)\)", path.read_text("utf-8")):
            if "://" in target or target in found:
                continue
            destination = (path.parent / target.split("#")[0]).resolve()
            if destination.parent == shared_dir and destination.name in SHARED:
                found.append(target)
    return found


class StandaloneSkillContracts(unittest.TestCase):
    def test_every_entry_gates_sibling_use_without_changing_the_bundle(self):
        entries = entry_files()
        self.assertEqual(len(entries), 6)
        for entry in entries:
            text = " ".join(entry.read_text("utf-8").split())
            with self.subTest(skill=entry.parent.name):
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
                                text.index("](" + shared_links(path)[0]))
                self.assertIn("missing sibling-file read", text)
                for target in shared_links(path):
                    destination = (path.parent / target.split("#")[0]).resolve()
                    self.assertIn(destination.name, SHARED)
                    self.assertTrue(destination.is_file(), "Bundle must retain the shared reference.")

    def test_individually_copied_skills_have_no_required_coordinator_file(self):
        scratch = Path(__file__).resolve().parent / ".test-work"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            for entry in SKILLS.glob("*/SKILL.md"):
                if entry.parent.name == "troubleshoot-observability":
                    continue
                isolated = Path(temporary) / entry.parent.name / "skills" / entry.parent.name
                shutil.copytree(entry.parent, isolated)
                self.assertFalse((isolated.parent / "troubleshoot-observability").exists())
                for document in isolated.rglob("*.md"):
                    for target in shared_links(document):
                        with self.subTest(skill=entry.parent.name, reference=target):
                            self.assertFalse((document.parent / target.split("#")[0]).resolve().exists())
                            self.assertIn("Standalone availability gate", document.read_text("utf-8"))
                            self.assertIn("missing sibling-file read", document.read_text("utf-8"))
                self.assertIn("handoff", (isolated / "SKILL.md").read_text("utf-8").casefold())

    def test_standalone_fallbacks_preserve_scope_and_do_not_create_services(self):
        investigation = (SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/README.md").read_text("utf-8")
        trace = (SKILLS / "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md").read_text("utf-8")
        for text in (investigation, trace):
            for phrase in ("scope/window", "existing authorized", "invented",
                           "fix/rollback plan-review question", "smallest missing evidence"):
                self.assertIn(phrase, text)
        self.assertIn("skip optional SRE review", investigation)
        self.assertIn("Missing recovery instructions block that handoff", investigation)
        portal = (SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/references/portal-links.md").read_text("utf-8")
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
