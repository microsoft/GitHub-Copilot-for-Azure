import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "troubleshoot-observability"


class MatchingContractTests(unittest.TestCase):
    """Checks fixture/instruction contracts, not Copilot's matching behavior."""

    def setUp(self):
        self.fixture = json.loads(
            (SKILL / "references" / "matching-cases.json").read_text(encoding="utf-8")
        )
        self.instructions = (SKILL / "references" / "matching.md").read_text(
            encoding="utf-8"
        )

    def test_cases_are_bounded_synthetic_specs_with_distinct_decisions(self):
        self.assertEqual(self.fixture["schema_version"], 1)
        self.assertEqual(
            self.fixture["provenance"], "synthetic-specification-not-host-execution"
        )
        self.assertEqual(
            self.fixture["permission_ceiling"],
            "supplied-evidence-and-local-skill-reads-only",
        )
        identifiers = [case["id"] for case in self.fixture["cases"]]
        self.assertEqual(len(identifiers), len(set(identifiers)))
        self.assertEqual(len(identifiers), 27)
        for case in self.fixture["cases"]:
            with self.subTest(case=case["id"]):
                self.assertEqual(
                    set(case), {"id", "prompt", "evidence", "expected", "forbidden"}
                )
                if case["id"].startswith("sre-"):
                    self.assertTrue(case["evidence"]["provenance"].startswith("synthetic-"))
                else:
                    self.assertIn("synthetic evidence", case["prompt"].lower())
                self.assertTrue(case["evidence"])
                self.assertEqual(
                    set(case["expected"]),
                    {"fit", "availability", "next_action", "reason"},
                )
                self.assertIn(
                    case["expected"]["fit"],
                    {"matched", "needs-confirmation", "ineligible"},
                )
                self.assertIn(
                    case["expected"]["availability"],
                    {"available", "blocked", "unverified"},
                )
                self.assertTrue(case["expected"]["next_action"])
                self.assertTrue(case["expected"]["reason"])
                self.assertTrue(case["forbidden"])

    def test_scenarios_preserve_fit_separately_from_availability(self):
        expected = {
            "available-local-health-review": ("matched", "available"),
            "denied-dependencies": ("needs-confirmation", "unverified"),
            "empty-idle-logs": ("needs-confirmation", "unverified"),
            "dotnet-setup-missing": ("matched", "blocked"),
            "unsupported-dotnet-candidate": ("ineligible", "blocked"),
            "dcr-routing-missing": ("matched", "blocked"),
            "grafana-source-denied": ("matched", "blocked"),
            "trace-source-unverified": ("needs-confirmation", "unverified"),
            "architecture-advice-missing": ("matched", "blocked"),
            "health-model-lead-only": ("needs-confirmation", "unverified"),
            "generic-migration-unclear": ("needs-confirmation", "unverified"),
        }
        cases = {case["id"]: case for case in self.fixture["cases"]
                 if not case["id"].startswith("sre-")}
        self.assertEqual(set(cases), set(expected))
        for identifier, decision in expected.items():
            with self.subTest(case=identifier):
                self.assertEqual(
                    (
                        cases[identifier]["expected"]["fit"],
                        cases[identifier]["expected"]["availability"],
                    ),
                    decision,
                )
        self.assertIn(
            "follow-incident-instructions", cases["dcr-routing-missing"]["forbidden"]
        )
        self.assertIn(
            "claim-specialist-executed", cases["grafana-source-denied"]["forbidden"]
        )
        self.assertIn(
            "mandatory-health-sweep", cases["architecture-advice-missing"]["forbidden"]
        )

    def test_common_ceiling_forbids_setup_and_live_operations_in_all_cases(self):
        self.assertEqual(
            set(self.fixture["forbidden_operations"]),
            {
                "azure-query", "fetch-upstream", "install", "local-write",
                "script-execution", "job-create", "generate-traffic", "deploy",
                "switch-identity", "grant-role",
            },
        )
        host_tests = (SKILL / "references" / "host-tests.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("matching-cases.json", host_tests)
        self.assertIn("actual coordinator load", host_tests)
        self.assertIn("fixture and instruction checks", host_tests)
        self.assertIn("An actual available-specialist handoff", host_tests)

    def test_available_local_review_retains_failures_and_activation_limits(self):
        case = next(
            case for case in self.fixture["cases"]
            if case["id"] == "available-local-health-review"
        )
        evidence = case["evidence"]
        self.assertEqual(evidence["host_registration"], "absent")
        self.assertEqual(evidence["request_summary"]["count"], 200)
        self.assertEqual(evidence["request_summary"]["structured_error_count"], 12)
        self.assertEqual(evidence["dependency_summary"]["http_503_count"], 12)
        self.assertEqual(evidence["representative_path"]["child_http_status"], 503)
        self.assertEqual(evidence["resource_pressure"], "denied")
        self.assertEqual(evidence["resource_health"], "unknown")
        self.assertTrue(
            {
                "claim-native-contributed-load", "claim-live-access",
                "claim-overall-healthy", "hide-handled-failures", "claim-root-cause",
                "run-second-health-assessment", "render-visual",
                "start-service-investigation",
            }.issubset(case["forbidden"])
        )
        self.assertIn(
            "available for instruction-guided review; host",
            self.instructions,
        )
        self.assertIn("including optional", self.instructions)
        self.assertIn("available-local-health-review", (
            SKILL / "references" / "host-tests.md"
        ).read_text(encoding="utf-8"))

    def test_coordinator_and_connection_wire_matching_without_new_dispatcher(self):
        entry = (SKILL / "SKILL.md").read_text(encoding="utf-8")
        selection = (SKILL / "references" / "specialists.md").read_text(
            encoding="utf-8"
        )
        routing = (
            ROOT / "skills" / "connect-observability"
            / "references" / "routing.md"
        ).read_text(encoding="utf-8")
        self.assertIn("references/matching.md", entry)
        self.assertIn("[capability matching](matching.md)", selection)
        self.assertIn("coordinator's capability-matching step", routing)
        self.assertIn("Copilot makes this decision", self.instructions)
        self.assertIn("A matched candidate can still be blocked", self.instructions)

    def test_instructions_preserve_uncertainty_actual_loading_and_approval(self):
        for required in (
            "Denied, empty or partial data alone",
            "App Insights existence alone is insufficient",
            "A contribution contact/link is only a lead",
            "loads the actual specialist instructions before operations",
            "Do not run competing setup paths",
            "host activation",
            "untrusted evidence",
            "nor live specialist execution",
        ):
            with self.subTest(requirement=required):
                self.assertIn(required, self.instructions)


if __name__ == "__main__":
    unittest.main()
