"""Instruction and synthetic-fixture contracts, NOT model activation/enforcement."""

import json
from pathlib import Path
import re
import unittest
from instruction_sources import FIXTURES, host_contract, read_contract


ROOT = (Path(__file__).resolve().parents[3] / "plugins" / "azure-observability")
SKILLS = ROOT / "skills"
COORDINATOR = SKILLS / "troubleshoot-observability"
REFERENCES = COORDINATOR / "references"
NAMES = {
    "troubleshoot-observability", "connect-observability",
    "assess-observability-health", "verify-observability-fix",
}


def compact(text):
    return " ".join(text.split())


class IntentScopeContracts(unittest.TestCase):
    def setUp(self):
        self.entries = {
            name: read_contract(name + "/SKILL.md")
            for name in NAMES
        }
        self.fixture = json.loads((FIXTURES / "troubleshoot-observability" /
                                  "references/intent-cases.json").read_text("utf-8"))
        self.cases = {case["id"]: case for case in self.fixture["cases"]}

    def test_bundled_discovery_descriptions_are_intent_specific_not_disabled(self):
        for name, text in self.entries.items():
            with self.subTest(skill=name):
                frontmatter = text.split("---", 2)[1]
                description = re.search(r"(?m)^description: (.+)$", frontmatter)[1].lower()
                self.assertRegex(description, r"observability|telemetry|operational")
                self.assertIn("conceptual", description)
                self.assertNotIn("one starting point", description)
                self.assertNotIn("disable-model-invocation", frontmatter)
                self.assertLess(len(description), 1024)

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
        for reference in ("references/scope-permissions.md",
                          "references/journey-indicator.md",
                          "references/selection.md", "references/next-actions.md"):
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

    def test_external_lifecycle_does_not_expand_bundled_intent(self):
        self.assertEqual({path.parent.name for path in SKILLS.glob("*/SKILL.md")}, NAMES)
        for text in self.entries.values():
            gate = text.split("## Current-request intent gate", 1)[1].split("\n## ", 1)[0]
            self.assertIn("conceptual", gate.casefold())
            self.assertRegex(compact(gate).casefold(), r"current (?:request|operational)")
        selection = compact((REFERENCES / "specialists.md").read_text("utf-8"))
        for name in ("azure-diagnostics", "microsoft-foundry"):
            self.assertIn(name, selection)
            self.assertFalse((SKILLS / name).exists())

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
        text = compact(host_contract())
        for phrase in ("intent-cases.json", "fresh", "VS Code", "Copilot CLI",
                       "prompt", "unrun", "instruction-load", "activation",
                       "normal approvals", "topic switch"):
            self.assertIn(phrase.casefold(), text.casefold())


if __name__ == "__main__":
    unittest.main()
