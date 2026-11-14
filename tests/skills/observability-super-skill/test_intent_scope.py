"""Instruction and synthetic-fixture contracts, NOT model activation/enforcement."""

import json
from pathlib import Path
import re
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
COORDINATOR = SKILLS / "troubleshoot-observability"
REFERENCES = COORDINATOR / "references"
NAMES = {
    "troubleshoot-observability", "connect-observability",
    "assess-observability-health", "verify-observability-fix",
    "azure-diagnostics", "microsoft-foundry",
}


def compact(text):
    return " ".join(text.split())


class IntentScopeContracts(unittest.TestCase):
    def setUp(self):
        self.entries = {
            name: (skill_dir(name) / "SKILL.md").read_text("utf-8")
            for name in NAMES
        }
        self.fixture = json.loads((REFERENCES / "intent-cases.json").read_text("utf-8"))
        self.cases = {case["id"]: case for case in self.fixture["cases"]}

    def test_six_discovery_descriptions_are_intent_specific_not_disabled(self):
        for name, text in self.entries.items():
            with self.subTest(skill=name):
                frontmatter = text.split("---", 2)[1]
                description = re.search(r"(?m)^description: (.+)$", frontmatter)[1].lower()
                self.assertRegex(description, r"observability|telemetry|operational")
                self.assertIn("conceptual", description)
                self.assertNotIn("one starting point", description)
                self.assertNotIn("disable-model-invocation", frontmatter)
                self.assertLess(len(description), 1024)
        foundry = self.entries["microsoft-foundry"].split("---", 2)[1]
        self.assertNotIn("Complete upstream create", foundry)
        self.assertIn("Not agent/resource creation", foundry)

    def test_every_loaded_entry_gates_before_its_first_presentation_rule(self):
        for name, text in self.entries.items():
            with self.subTest(skill=name):
                gate_start = text.index("## Current-request intent gate")
                gate_end = text.find("\n## ", gate_start + 1)
                gate = compact(text[gate_start:gate_end if gate_end != -1 else len(text)])
                self.assertLess(gate_start, text.index("**Using:**"))
                for resource in re.finditer(r"\]\(references/", text):
                    self.assertLess(gate_start, resource.start())
                for phrase in ("Before any journey header", "diagram", "discovery",
                               "read", "current request", "conceptual", "directly",
                               "before deployment", "topic switch", "not sticky",
                               "normal approvals", "coordinator"):
                    # The coordinator's more detailed canonical gate uses equivalent
                    # wording and is checked separately below.
                    if name != "troubleshoot-observability":
                        self.assertIn(phrase.casefold(), gate.casefold())

    def test_coordinator_gate_precedes_all_workflow_references(self):
        text = self.entries["troubleshoot-observability"]
        gate = text.index("## Current-request intent gate")
        for reference in ("references/acquire-capability.md",
                          "references/journey-indicator.md",
                          "references/handoff.md", "references/specialists.md"):
            self.assertLess(gate, text.index(reference))
        normalized = compact(text).replace("**", "")
        for phrase in ("on every user turn", "before any journey header",
                       "actual failure (including a failed deployment)",
                       "Natural language such as", "my API is slow",
                       "outside application/operational context",
                       "routine deployment readiness", "without invoking this coordinator",
                       "one minimal question", "do not interrogate every resource-creation task"):
            self.assertIn(phrase, normalized)

    def test_greenfield_setup_is_not_a_deployment_or_gap_prerequisite(self):
        text = compact(self.entries["troubleshoot-observability"])
        for phrase in ("even for a new application", "without requiring a deployed target",
                       "inventing an existing gap", "not permission to provision",
                       "Explicit collection/instrumentation/alert setup or design request"):
            self.assertIn(phrase, text)
        self.assertNotIn('"Find this app\'s telemetry" or unconfirmed target/source', text)
        self.assertNotIn("| Proposed fix or optimization |", text)
        self.assertIn("Proposed fix or optimization tied to an observability finding", text)

    def test_concepts_and_topic_switches_suppress_all_wrapper_surfaces(self):
        text = compact(self.entries["troubleshoot-observability"]).replace("**", "")
        for phrase in ("Answer conceptual observability questions directly",
                       "Do not start a journey", "discover tools",
                       "emit no observability Using", "Stage", "Discovered",
                       "journey stepper or observability questions/tools",
                       "topic switch ends journey presentation immediately",
                       "Resume only on a relevant current request"):
            self.assertIn(phrase, text)
        for relative in ("journey-indicator.md", "acquire-capability.md", "specialists.md"):
            reference = compact((REFERENCES / relative).read_text("utf-8"))
            self.assertIn("current-request intent gate", reference)
            self.assertIn("conceptual", reference.lower())

    def test_reused_lifecycle_remains_separately_available_without_wrapper(self):
        text = compact(self.entries["microsoft-foundry"]).replace("**", "")
        for phrase in ("explicit broader Foundry lifecycle/resource request",
                       "corresponding retained workflow separately",
                       "normal operation-specific approvals",
                       "without an observability wrapper or coordinator",
                       "not broad automatic triggers"):
            self.assertIn(phrase, text)
        for name in ("azure-diagnostics", "microsoft-foundry"):
            boundaries = compact((skill_dir(name) / "references/execution-boundaries.md")
                                 .read_text("utf-8"))
            self.assertIn("current-request intent gate", boundaries)
            provenance = (skill_dir(name) / "references/provenance.md").read_text("utf-8")
            self.assertIn("0.3.30", provenance)
            self.assertIn("scripts", provenance)
        diagnostics = compact(self.entries["azure-diagnostics"])
        self.assertIn("not a general deployment/creation router", diagnostics)

    def test_fixture_is_an_unrun_specification_with_no_execution_permission(self):
        self.assertEqual(self.fixture["provenance"], "synthetic-specification-not-host-execution")
        self.assertEqual(self.fixture["host_status"], {"vscode": "unrun", "copilot_cli": "unrun"})
        self.assertEqual(self.fixture["permission_ceiling"], "no-cloud-no-execution-no-writes")
        self.assertEqual(len(self.cases), 24)
        self.assertEqual(len(self.fixture["cases"]), 24)
        for case in self.cases.values():
            with self.subTest(case=case["id"]):
                self.assertEqual(set(case), {"id", "context", "prompt", "expected"})
                self.assertLess(len(case["prompt"]), 100)
                self.assertNotRegex(case["prompt"], r"(?i)expected|don't use|do not use|no journey")
                self.assertEqual(set(case["expected"]), {
                    "route", "journey", "onboarding", "observability_discovery",
                })
                self.assertIsInstance(case["context"], list)
                for flag in ("journey", "onboarding", "observability_discovery"):
                    self.assertIs(type(case["expected"][flag]), bool)

    def test_negative_fixtures_do_not_trigger_wrapper_discovery_or_onboarding(self):
        for identifier in ("create-resource-group", "create-app", "create-agent",
                           "deploy-model", "fix-coding", "slow-unrelated", "rbac",
                           "subscription", "cost", "documentation", "deployment-readiness",
                           "topic-switch"):
            with self.subTest(case=identifier):
                self.assertEqual(self.cases[identifier]["expected"], {
                    "route": "normal-task", "journey": False,
                    "onboarding": False, "observability_discovery": False,
                })

    def test_positive_fixtures_allow_natural_language_and_greenfield_setup(self):
        for identifier in ("deployment-failure", "app-slow", "agent-runtime",
                           "alert-setup", "new-app-instrumentation", "collection-design",
                           "topic-resume", "recovery"):
            with self.subTest(case=identifier):
                self.assertEqual(self.cases[identifier]["expected"]["route"], "observability")
                self.assertTrue(self.cases[identifier]["expected"]["journey"])
        for identifier in ("alert-setup", "new-app-instrumentation", "collection-design"):
            self.assertFalse(self.cases[identifier]["expected"]["onboarding"])

    def test_concepts_ambiguity_and_explicit_specialists_are_not_forced_journeys(self):
        for identifier, route in (("concept-monitoring", "answer-concept"),
                                  ("concept-alerts", "answer-concept"),
                                  ("ambiguous", "clarify-intent"),
                                  ("direct-health", "direct-specialist")):
            with self.subTest(case=identifier):
                self.assertEqual(self.cases[identifier]["expected"]["route"], route)
                self.assertFalse(self.cases[identifier]["expected"]["journey"])
        self.assertTrue(self.cases["direct-health"]["expected"]["onboarding"])
        self.assertTrue(self.cases["topic-switch"]["context"])
        self.assertTrue(self.cases["topic-resume"]["context"])

    def test_host_gate_distinguishes_contracts_from_actual_activation(self):
        text = compact((REFERENCES / "host-tests.md").read_text("utf-8"))
        for phrase in ("intent-cases.json", "fresh", "VS Code", "Copilot CLI",
                       "short prompts", "unrun", "instruction-load", "not model activation",
                       "normal approvals", "topic-switch"):
            self.assertIn(phrase, text)


if __name__ == "__main__":
    unittest.main()
