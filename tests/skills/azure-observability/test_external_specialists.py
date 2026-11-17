"""Offline instruction contracts; no dependency installation, loading or execution."""

from pathlib import Path
import re
import unittest

from instruction_sources import COORDINATOR_GUIDES, read_contract


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "azure-observability"
SKILLS = ROOT / "skills"
REFS = SKILLS / "troubleshoot-observability" / "references"
EXTERNAL = ("azure-diagnostics", "microsoft-foundry")


def compact(path):
    return " ".join(path.read_text("utf-8").split()).casefold()


class ExternalSpecialistContracts(unittest.TestCase):
    def setUp(self):
        self.contract = compact(REFS / "canonical-dependencies.md")

    def test_external_dependencies_are_declared_not_bundled_or_path_resolved(self):
        for name in EXTERNAL:
            with self.subTest(specialist=name):
                self.assertFalse((SKILLS / name).exists())
                self.assertIn("`" + name + "`", self.contract)
                self.assertRegex(
                    self.contract,
                    r"https://github\.com/microsoft/azure-skills/(?:tree|blob)/[^ )]+/"
                    + re.escape(name),
                )
                self.assertIn(
                    "https://github.com/microsoft/azure-skills/tree/main/"
                    ".github/plugins/azure-skills/skills/" + name,
                    self.contract,
                )
        self.assertIn("moving branch, not a pinned dependency version", self.contract)
        self.assertIn("external instruction dependencies", self.contract)
        self.assertRegex(self.contract, r"do not assume.{0,180}sibling path")
        for path in SKILLS.rglob("*.md"):
            text = path.read_text("utf-8")
            for target in re.findall(r"\]\(([^)]+)\)", text):
                if "://" not in target:
                    self.assertNotRegex(
                        target, r"(?:^|/)(?:azure-diagnostics|microsoft-foundry)/",
                        str(path),
                    )

    def test_discovery_instruction_load_execution_and_access_remain_separate(self):
        for concept in ("origin/version", "supported loading", "duplicate names",
                        "explicit-invocation", "complete instructions/resources",
                        "loading proof", "execution proof", "access", "approval"):
            self.assertIn(concept, self.contract)
        for state in ("missing", "disabled", "failed-load", "incomplete", "policy-blocked"):
            self.assertIn(state, self.contract)
        for concept in ("instructions loaded", "operations executed", "fallback used",
                        "scope/window", "read/row/retry budget", "declines", "consumed budgets"):
            self.assertIn(concept, self.contract)

    def test_upstream_setup_and_lifecycle_steps_do_not_inherit_approval(self):
        for concept in ("bootstrap", "sign-in", "cache migration", "setup",
                        "job", "collector", "no-query/no-save", "approval ceiling"):
            self.assertIn(concept, self.contract)
        self.assertRegex(self.contract, r"do not.{0,140}follow.{0,80}automatic")
        self.assertRegex(self.contract, r"cannot work.{0,180}(?:blocker|core path)")
        self.assertRegex(self.contract, r"never install.{0,160}automatically")
        self.assertRegex(self.contract, r"separate.{0,40}setup approval")
        self.assertIn("no installation command or package id is invented", self.contract)
        self.assertIn("setup never grants live reads", self.contract)

    def test_sufficient_supplied_evidence_needs_no_external_setup(self):
        self.assertRegex(self.contract, r"not bundled.{0,100}mandatory prerequisites")
        self.assertIn("continue permitted evidence-only investigation", self.contract)
        self.assertRegex(self.contract, r"offer setup only if.{0,100}needs it")
        self.assertIn("declined setup is retained", self.contract)
        self.assertIn("no repeated prompt", self.contract)
        local = compact(REFS / "investigation" / "README.md")
        self.assertRegex(local, r"evidence-only investigation requires neither")
        self.assertIn("without redundant service delegation", local)
        self.assertIn("inconclusive", local)

    def test_external_routes_link_the_same_dependency_boundary(self):
        for relative in (
            "troubleshoot-observability/references/specialists.md",
            "troubleshoot-observability/references/investigation/README.md",
        ):
            with self.subTest(source=relative):
                self.assertIn("canonical-dependencies.md", read_contract(relative))
        selection = compact(REFS / "specialists.md")
        self.assertNotRegex(selection, r"bundled [`*]*(?:azure-diagnostics|microsoft-foundry)")
        self.assertIn("core affected-path", selection)

    def test_source_composition_is_explicit_and_never_composes_external_copies(self):
        entry = SKILLS / "troubleshoot-observability" / "SKILL.md"
        expected = entry.read_text("utf-8") + "\n" + "\n".join(
            (REFS / name).read_text("utf-8") for name in COORDINATOR_GUIDES
        )
        self.assertEqual(read_contract("troubleshoot-observability/SKILL.md"), expected)
        for name in EXTERNAL:
            with self.subTest(specialist=name), self.assertRaises(FileNotFoundError):
                read_contract(name + "/SKILL.md")

    def test_unique_agent_chain_and_sensitive_content_boundaries_survive(self):
        patterns = (REFS / "investigation" / "references" /
                    "trace-query-patterns.md").read_text("utf-8")
        for concept in ("OperationId", "ParentId", "transport/dependency status",
                        "structured tool result", "semantic error", "fallback",
                        "parent-agent outcome", "Do not project raw exception messages"):
            self.assertIn(concept, patterns)
        self.assertIn("not a bulk-download", patterns)
        self.assertNotIn("`OuterMessage`", patterns)
        self.assertNotIn("`InnermostMessage`", patterns)


if __name__ == "__main__":
    unittest.main()
