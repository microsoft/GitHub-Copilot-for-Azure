"""Offline contracts and real local comparator outputs; not model-routing evidence."""

import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "azure-observability"
REFS = ROOT / "skills" / "troubleshoot-observability" / "references"
VERIFY = ROOT / "skills" / "verify-observability-fix"
SPEC = importlib.util.spec_from_file_location("journey_recovery", VERIFY / "scripts/recovery.py")
recovery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recovery)


def text(path):
    return " ".join(path.read_text("utf-8").split())


class JourneyOutcomeTests(unittest.TestCase):
    def test_native_entries_keep_inline_gates_before_shared_reads(self):
        for entry in (ROOT / "skills").glob("*/SKILL.md"):
            content = entry.read_text("utf-8")
            with self.subTest(skill=entry.parent.name):
                intent_match = re.search(r"(?m)^## Current-request intent(?: gate)?$", content)
                availability_match = re.search(r"(?m)^## Standalone availability(?: gate)?$", content)
                self.assertIsNotNone(intent_match)
                self.assertIsNotNone(availability_match)
                intent = intent_match.start()
                availability = availability_match.start()
                self.assertIn("conceptual", content.lower())
                self.assertIn("approval", content.lower())
                self.assertIn("INCONCLUSIVE", content)
                for line in content.splitlines():
                    if "](../troubleshoot-observability/" in line:
                        position = content.index(line)
                        self.assertLess(intent, position)
                        self.assertLess(availability, position)

    def test_remediate_options_are_concrete_and_separately_approved(self):
        policy = text(REFS / "next-actions.md")
        for phrase in (
            "up to three evidence-backed options", "Correct the issue",
            "Mitigate impact", "Prevent or detect recurrence",
            "An alert is not a fix", "Selecting an option permits planning only",
            "commit, push, publish a PR or deploy",
            "Do not force source-file questions for an alert",
            "acceptance criteria and rollback", "one option-selection question",
        ):
            self.assertIn(phrase, policy)

    def test_monitoring_has_no_implicit_execution_or_success(self):
        policy = text(REFS / "monitoring-follow-up.md")
        for phrase in (
            "after reporting a recovery verdict", "INCONCLUSIVE or NOT_RECOVERED",
            "no decision is pending", "Existing AMG dashboard", "Alert guidance",
            "Later health check", "Finish here",
            "not reads, connections, writes, scheduled jobs",
            "Auto-refresh stays off", "must initiate it",
            "Missing Grafana never blocks", "Unknown thresholds require agreement",
        ):
            self.assertIn(phrase, policy)
        verify = text(VERIFY / "SKILL.md")
        self.assertLess(verify.index("## 4. Report narrowly"),
                        verify.index("## 5. Offer optional monitoring"))
        self.assertIn("does not execute dashboard, alert, query", verify)
        handoff = text(REFS / "handoff.md")
        self.assertIn("Remediation options", handoff)
        self.assertIn("Monitoring follow-up", handoff)

    def test_local_comparator_still_preserves_all_three_outcomes(self):
        original = json.loads((VERIFY / "references/fixture.json").read_text("utf-8"))
        now = dt.datetime(2026, 10, 30, 12, tzinfo=dt.timezone.utc)
        variants = [
            (original, "VERIFIED_RECOVERED"),
            (copy.deepcopy(original), "NOT_RECOVERED"),
            (copy.deepcopy(original), "INCONCLUSIVE"),
        ]
        variants[1][0]["checks"][0]["post"]["total"] = 20
        variants[2][0]["checks"][0]["post"].update(
            state="missing", complete=False, sample_count=None, total=None,
            first_event_at=None, latest_event_at=None,
        )
        for evidence, verdict in variants:
            with self.subTest(verdict=verdict):
                result = recovery.assess(evidence, now)
                self.assertEqual(result["verdict"], verdict)
                self.assertFalse(result["supporting_results_establish_recovery"])

    def test_natural_language_host_cases_cover_positive_and_failure_paths(self):
        suite = json.loads((Path(__file__).resolve().parent / "journey-cases.json").read_text("utf-8"))
        self.assertEqual(suite["provenance"], "synthetic-specification-not-host-execution")
        self.assertEqual(suite["host_status"], {"vscode": "unrun", "copilot_cli": "unrun"})
        cases = {case["id"]: case for case in suite["cases"]}
        self.assertEqual(len(cases), 21)
        self.assertEqual(len(cases), len(suite["cases"]))
        for case in cases.values():
            self.assertLessEqual(len(case["prompt"]), 100)
            self.assertNotIn("skill", case["prompt"].lower())
            self.assertTrue(case["expect"])
            self.assertTrue(case["forbid"])
        self.assertEqual(cases["local-edit"]["stage"], "Remediate")
        self.assertIn("INCONCLUSIVE", cases["recovery-missing"]["expect"])
        self.assertIn("NOT_RECOVERED", cases["recovery-failed"]["expect"])
        self.assertIsNone(cases["topic-switch"]["stage"])

    def test_discovery_first_cases_preserve_external_load_and_setup_boundaries(self):
        suite = json.loads((Path(__file__).resolve().parent / "journey-cases.json").read_text("utf-8"))
        cases = {case["id"]: case for case in suite["cases"]}
        for identifier in ("canonical-diagnostics-installed", "canonical-foundry-installed"):
            with self.subTest(case=identifier):
                case = cases[identifier]
                self.assertEqual(case["stage"], "Investigate")
                self.assertRegex(" ".join(case["expect"]), r"actual external.{0,30}load")
                self.assertRegex(" ".join(case["forbid"]), r"install|setup")
        missing = cases["canonical-missing-setup"]
        self.assertIn("obtain separate real setup approval", missing["expect"])
        self.assertIn("auto install", missing["forbid"])
        approved = cases["canonical-setup-approved"]
        self.assertIn("treat fixture as authorization", approved["forbid"])
        self.assertIn("verify discovery and actual external load after setup", approved["expect"])
        self.assertIn("query Azure", approved["forbid"])
        for identifier in ("canonical-setup-declined", "canonical-access-denied"):
            with self.subTest(case=identifier):
                case = cases[identifier]
                self.assertIn("continue sufficient supplied-evidence analysis", case["expect"])
                self.assertRegex(" ".join(case["forbid"]), r"bypass|alternate installer")
        lifecycle = cases["canonical-lifecycle-defaults"]
        for forbidden in ("auto install", "run bootstrap", "sign in", "migrate cache",
                          "create session", "run evaluation or optimization job",
                          "inherit safety claims"):
            self.assertIn(forbidden, lifecycle["forbid"])
        host = text(Path(__file__).resolve().parent / "host-acceptance/journey.md")
        for identifier in (name for name in cases if name.startswith("canonical-")):
            self.assertIn(identifier, host)
        for concept in ("VS Code UNRUN", "CLI UNRUN", "fresh-host"):
            self.assertIn(concept, host)

    def test_selected_entries_remain_conditional_and_capabilities_present(self):
        coordinator = text(ROOT / "skills/troubleshoot-observability/SKILL.md")
        for phrase in ("Load only the applicable guidance", "not every reference",
                       "connect-observability", "assess-observability-health",
                       "azure-diagnostics", "microsoft-foundry", "verify-observability-fix",
                       "monitoring-follow-up.md", "never auto-select rank 1"):
            self.assertIn(phrase, coordinator)
        connector = text(ROOT / "skills/connect-observability/SKILL.md")
        for phrase in ("tools-only mode", "saved mapping", "approved integrations",
                       "reviewed Azure MCP setup path", "bounded", "readiness"):
            self.assertIn(phrase, connector)


if __name__ == "__main__":
    unittest.main()
