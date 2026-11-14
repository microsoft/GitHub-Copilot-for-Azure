import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "connect-observability"


class PreflightContractTests(unittest.TestCase):
    """Checks instruction/fixture contracts, not host or Azure behavior."""

    def setUp(self):
        self.fixture = json.loads(
            (SKILL / "references" / "preflight-cases.json").read_text(
                encoding="utf-8"
            )
        )
        self.guide = (SKILL / "references" / "tools.md").read_text(
            encoding="utf-8"
        )

    def test_cases_are_synthetic_specs_with_distinct_prerequisite_states(self):
        self.assertEqual(self.fixture["schema_version"], 1)
        self.assertEqual(
            self.fixture["provenance"], "synthetic-specification-not-host-execution"
        )
        cases = {case["id"]: case for case in self.fixture["cases"]}
        expected = {
            "missing-web-telemetry-tools": "missing",
            "visible-agent-router-unverified": "unverified",
            "metadata-access-query-denied": "denied",
        }
        self.assertEqual(len(cases), len(self.fixture["cases"]))
        self.assertEqual(set(cases), set(expected))
        for identifier, state in expected.items():
            with self.subTest(case=identifier):
                case = cases[identifier]
                self.assertEqual(
                    set(case), {"id", "prompt", "evidence", "expected", "forbidden"}
                )
                self.assertIn("synthetic", case["prompt"].lower())
                self.assertTrue(case["evidence"])
                self.assertEqual(
                    set(case["expected"]),
                    {"tool_state", "next_action", "readiness", "health"},
                )
                self.assertEqual(case["expected"]["tool_state"], state)
                self.assertTrue(case["expected"]["next_action"])
                self.assertEqual(case["expected"]["readiness"], "not-computed")
                self.assertEqual(case["expected"]["health"], "INCONCLUSIVE")
                self.assertTrue(case["forbidden"])

    def test_common_ceiling_excludes_setup_discovery_and_live_operations(self):
        self.assertEqual(
            self.fixture["permission_ceiling"],
            "supplied-evidence-and-local-skill-reads-only",
        )
        self.assertEqual(
            set(self.fixture["forbidden_operations"]),
            {
                "azure-query", "remote-discovery", "fetch-upstream", "install",
                "sign-in", "switch-identity", "grant-role", "script-execution",
                "local-write", "job-create", "generate-traffic", "deploy",
            },
        )
        for case in self.fixture["cases"]:
            self.assertEqual(case["evidence"]["helper_execution"], "prohibited")

    def test_cases_cannot_substitute_installation_or_sign_in_for_evidence(self):
        cases = {case["id"]: case for case in self.fixture["cases"]}
        missing = cases["missing-web-telemetry-tools"]
        self.assertEqual(
            missing["evidence"]["setup_route"], "documented-not-host-tested"
        )
        self.assertEqual(
            missing["expected"]["next_action"],
            "review-documented-vscode-route-and-client-policy",
        )
        self.assertTrue({
            "invent-install-command", "require-python-for-azure-reads",
            "require-foundry-for-web-api", "claim-fresh-client-verified",
            "apply-local-ui-to-copilot-harness", "request-contributor-for-read-only",
        }.issubset(missing["forbidden"]))
        router = cases["visible-agent-router-unverified"]
        self.assertEqual(router["evidence"]["child_schemas"], "unknown")
        self.assertIn("claim-router-proves-callability", router["forbidden"])
        denied = cases["metadata-access-query-denied"]
        self.assertEqual(denied["evidence"]["resource_read"], "successful-as-supplied")
        self.assertEqual(denied["evidence"]["log_access"], "denied")
        self.assertTrue({
            "claim-sign-in-proves-query-access", "claim-instrumentation-gap",
            "recommend-duplicate-install",
        }.issubset(denied["forbidden"]))

    def test_connection_and_host_scenarios_wire_the_local_guide(self):
        entry = (SKILL / "SKILL.md").read_text(encoding="utf-8")
        host_tests = (SKILL / "references" / "host-tests.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("references/tools.md", entry)
        self.assertIn("preflight-cases.json", self.guide)
        self.assertIn("preflight-cases.json", host_tests)
        self.assertIn("Actually load the coordinator", host_tests)
        self.assertIn("Do not change the host's real tools", host_tests)
        self.assertIn("response behavior", host_tests)

    def test_guide_keeps_setup_actionable_and_results_explicit(self):
        for required in (
            "fresh-client execution remains unverified",
            "Do not invent",
            "intended client/version",
            "required operations",
            "actual operation schemas",
            "separate consent for installation/configuration",
            "bounded telemetry read",
            "readiness classification not computed",
            "INCONCLUSIVE",
            "Installing Python cannot supply Azure telemetry",
        ):
            with self.subTest(requirement=required):
                self.assertIn(required.lower(), self.guide.lower())

    def test_documented_route_retains_sources_harness_and_access_boundaries(self):
        route = (SKILL / "references" / "vscode-setup.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("vscode-setup.md", self.guide)
        for required in (
            "ms-azuretools.vscode-azure-mcp-server",
            "https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/get-started/tools/visual-studio-code",
            "https://code.visualstudio.com/docs/agents/run/tools",
            "https://learn.microsoft.com/en-us/azure/azure-monitor/logs/manage-access",
            "Chat: Open Customizations -> Tools",
            "Configure Tools",
            "fresh-client installation, authentication and telemetry reads remain unverified",
            "separate consent",
            "Resource-context logs",
            "Workspace-context logs",
            "not automatically authorize workspace-wide",
            "enforced read-only server configuration",
            "preview and automatic",
            "Copilot CLI has a [separate setup route](cli-setup.md)",
            "acceptance test",
        ):
            with self.subTest(requirement=required):
                self.assertIn(required, route)
        self.assertNotIn("az login", route)
        self.assertNotIn("npx -y", route)


if __name__ == "__main__":
    unittest.main()
