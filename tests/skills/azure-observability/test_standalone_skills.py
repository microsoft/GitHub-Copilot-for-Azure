"""Offline missing-sibling instruction contracts, not installed-host behavior."""

from pathlib import Path
import re
import shutil
import tempfile
import unittest
from urllib.parse import unquote, urlsplit
from shared_contracts import SHARED_FILES, SHARED_SKILLS, normalized_shared_markdown



ROOT = (Path(__file__).resolve().parents[3] / "plugins" / "azure-observability")
SKILLS = ROOT / "skills"
SHARED = {"trace-capabilities.md", "next-actions.md", "specialists.md",
          "journey-indicator.md"}
LINK = re.compile(r"\]\(([^)]*(?:references/shared/|troubleshoot-observability/)[^)]+)\)")


def shared_links(path):
    return LINK.findall(path.read_text("utf-8"))


class StandaloneSkillContracts(unittest.TestCase):
    def test_every_entry_gates_sibling_use_without_changing_the_bundle(self):
        entries = list(SKILLS.glob("*/SKILL.md"))
        self.assertEqual(len(entries), 4)
        for entry in entries:
            text = " ".join(entry.read_text("utf-8").split())
            with self.subTest(skill=entry.parent.name):
                for phrase in (
                    "Standalone availability gate", "For an admitted task",
                    "check availability before reading any cross-skill reference",
                    "Individual installation may omit them",
                    "their use below is conditional",
                    "Unknown availability follows the missing-reference fallback",
                    "Never download, install or attempt a mandatory missing sibling-file read",
                ):
                    self.assertIn(phrase, text)
                self.assertRegex(text, r"Use available (?:shared|core) instructions")

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

    def test_derived_shared_closures_match_canonical_content_and_resolved_links(self):
        canonical = SKILLS / "troubleshoot-observability/references"
        for name in SHARED_SKILLS:
            shared = SKILLS / name / "references/shared"
            actual = {path.relative_to(shared).as_posix()
                      for path in shared.rglob("*") if path.is_file()}
            self.assertEqual(actual, SHARED_FILES)
            for relative in sorted(SHARED_FILES):
                with self.subTest(skill=name, contract=relative):
                    source = canonical / relative
                    derived = shared / relative
                    self.assertFalse(derived.is_symlink())
                    if derived.suffix == ".md":
                        self.assertEqual(normalized_shared_markdown(derived, shared),
                                         normalized_shared_markdown(source, canonical))
                    else:
                        self.assertEqual(derived.read_bytes().replace(b"\r\n", b"\n"),
                                         source.read_bytes().replace(b"\r\n", b"\n"))

    def test_individually_copied_skills_have_no_required_coordinator_file(self):
        scratch = Path(__file__).resolve().parent / ".test-work"
        scratch.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: scratch.rmdir() if scratch.is_dir()
                        and not any(scratch.iterdir()) else None)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            for entry in SKILLS.glob("*/SKILL.md"):
                if entry.parent.name == "troubleshoot-observability":
                    continue
                isolated = Path(temporary) / entry.parent.name / "skills" / entry.parent.name
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
        investigation = (SKILLS / "troubleshoot-observability/references/investigation/README.md").read_text("utf-8")
        for phrase in ("scope/window", "existing authorized", "invented",
                       "fix/rollback plan-review question", "smallest missing evidence"):
            self.assertIn(phrase, investigation)
        self.assertIn("skip optional SRE review", investigation)
        self.assertIn("Missing recovery instructions block that handoff", investigation)
        portal = (SKILLS / "troubleshoot-observability/references/investigation/references/portal-links.md").read_text("utf-8")
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
