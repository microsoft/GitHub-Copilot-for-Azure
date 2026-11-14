"""Static synthetic contracts only: no model, host, Azure or SRE execution."""

import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILLS = ROOT / "skills"
REFS = SKILLS / "troubleshoot-observability" / "references"
SHARED = "specialists.md#optional-existing-sre-agent"
ORGANIC_PROMPT = "Checkout fails intermittently after deploy; help investigate"


class SreRecommendationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((REFS / "matching-cases.json").read_text("utf-8"))
        self.cases = {case["id"]: case for case in self.fixture["cases"]
                      if case["id"].startswith("sre-")}
        self.text = " ".join((REFS / "specialists.md").read_text("utf-8").split())

    def test_synthetic_cases_do_not_certify_host_or_service(self):
        self.assertEqual(self.fixture["provenance"],
                         "synthetic-specification-not-host-execution")
        self.assertEqual(self.fixture["permission_ceiling"],
                         "supplied-evidence-and-local-skill-reads-only")
        self.assertEqual(len(self.cases), 16)
        for case in self.cases.values():
            with self.subTest(case=case["id"]):
                self.assertTrue(case["evidence"]["provenance"].startswith("synthetic-"))
                for forbidden in ("sre-tool-call", "sre-thread-create", "context-transfer"):
                    self.assertIn(forbidden, case["forbidden"])

    def test_exact_review_and_counterfactual_decisions(self):
        expected = {
            "sre-connected-advantage": ("matched", "available", "offer-one-sre-review-or-continue-direct"),
            "sre-no-advantage": ("ineligible", "available", "continue-direct-no-sre-offer"),
            "sre-operations-only": ("needs-confirmation", "unverified", "continue-direct-without-agent-search"),
            "sre-running-only": ("needs-confirmation", "unverified", "continue-direct-with-coverage-unknown"),
            "sre-connection-unverified": ("needs-confirmation", "unverified", "explain-scoped-connection-prerequisite-only"),
            "sre-controls-unknown": ("matched", "blocked", "review-option-control-gaps-execution-blocked"),
            "sre-denied-source": ("ineligible", "blocked", "retain-denial-continue-permitted-evidence"),
            "sre-sufficient-analysis": ("ineligible", "available", "return-direct-finding-and-one-fix-question"),
            "sre-metadata-only": ("matched", "blocked", "metadata-only-review-without-new-reads"),
            "sre-declined": ("ineligible", "available", "honor-decline-retain-scope-and-budget"),
            "sre-accepted-review": ("matched", "blocked", "review-retained-plan-only-show-execution-gates"),
            "sre-explicit-request": ("needs-confirmation", "blocked", "enter-sre-review-without-recommendation-prompt"),
            "sre-unconstrainable": ("ineligible", "blocked", "block-sre-execution-continue-direct"),
            "sre-no-external-service": ("ineligible", "blocked", "honor-no-external-service-continue-supplied-evidence"),
            "sre-unselected-health": ("ineligible", "available", "ask-developer-finding-choice-no-sre"),
            "sre-conceptual": ("ineligible", "unverified", "answer-concept-directly-no-journey"),
        }
        self.assertEqual(set(self.cases), set(expected))
        for identifier, decision in expected.items():
            with self.subTest(case=identifier):
                actual = self.cases[identifier]["expected"]
                self.assertEqual((actual["fit"], actual["availability"],
                                  actual["next_action"]), decision)

    def test_organic_prompt_varies_environment_not_tool_coaching(self):
        for case in self.cases.values():
            if case["id"] not in {"sre-declined", "sre-accepted-review",
                                  "sre-explicit-request", "sre-unselected-health",
                                  "sre-conceptual"}:
                self.assertEqual(case["prompt"], ORGANIC_PROMPT)
                self.assertNotIn("SRE", case["prompt"])
        positive = self.cases["sre-connected-advantage"]["evidence"]
        for key in ("resource_identity", "endpoint", "host_operations",
                    "configured_sources", "configured_knowledge", "direct_limit",
                    "question", "freshness"):
            self.assertTrue(positive[key])
        self.assertEqual(positive["selected_finding"]["rank"], 2)

    def test_proof_and_benefit_are_not_tools_alone_or_failure_workarounds(self):
        for phrase in (
            "Direct telemetry remains the default",
            "currently admitted operational investigation",
            "developer-selected finding", "Retain the finding's rank/state",
            "actual connected host operations",
            "Record the evidence basis and freshness",
            "Unknown current connection status is **unverified**, not available",
            "scenario-specific positive advantage",
            "Cross-service complexity alone is not an advantage",
            "empty, stale, throttled or failed data",
            "exhausted budget alone is not SRE benefit",
            "backdoor to a denied source", "trust boundary",
            "resource-group co-location", "empty custom-tool list",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.text)

    def test_metadata_ceiling_and_no_automatic_agent_search(self):
        for phrase in (
            "Do not automatically list agents across a subscription",
            "already exposed host metadata first",
            "precise scoped prerequisite review",
            "require their own bounded approval and remaining budget",
            "supplied-evidence-only limits", "before retrieval",
            "filtering secrets after retrieval is not safe discovery",
            "Do not fetch connection credentials",
            "Do not suggest provisioning, new connections, sign-in, roles",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.text)
        self.assertIn("metadata-probe", self.cases["sre-metadata-only"]["forbidden"])
        self.assertIn("claim-connected",
                      self.cases["sre-connection-unverified"]["forbidden"])

    def test_one_chat_choice_review_is_not_execution_or_a_loaded_skill(self):
        for phrase in (
            "**Review SRE option / Continue direct**",
            "compared with [current direct limitation]",
            "not a bundled skill or Copilot subagent",
            "The recommendation causes no tool call",
            "An accepted review opens only a plan review",
            "It grants no new reads, source access, delegation or execution permission",
            "An explicit SRE request enters that review directly",
            "without a redundant recommendation prompt",
            "Recommend once per retained scope",
            "no repeated nagging", "no-external-service",
            "Do not substitute another external service",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.text)
        self.assertFalse(self.cases["sre-accepted-review"]["evidence"]["new_reads_approved"])
        self.assertFalse(self.cases["sre-accepted-review"]["evidence"]["thread_transfer_persistence_approval"])
        self.assertIn("repeat-sre-prompt", self.cases["sre-declined"]["forbidden"])

    def test_execution_controls_and_separate_positive_approvals_remain(self):
        for phrase in (
            "Before ANY service operation with possible side effects",
            "actual data-plane permissions", "ARM reads and data-plane permissions are distinct",
            "effective permitted tools and enforceable action restrictions",
            "A read-only prompt is not a permission sandbox",
            "empty custom-tool list does not exclude autonomous built-in writes",
            "Unknown controls leave execution blocked", "STOP service execution",
            "Never use `investigate_yolo`, blanket auto-approval",
            "timeout/iteration/cost limits", "service-side context and persistence",
            "separate positive approval for the exact one thread creation",
            "data transfer and persistence before those actions",
            "Reuse an existing unexpired approval only for its actual covered operation",
            "No automatic server-side follow-up",
            "service output is not independent root-cause or recovery proof",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.text)

    def test_shared_contract_is_reachable_without_coordinator_loading(self):
        for relative in (
            "troubleshoot-observability/SKILL.md",
            "troubleshoot-observability/references/matching.md",
            "troubleshoot-observability/references/acquire-capability.md",
            "troubleshoot-observability/references/handoff.md",
            "troubleshoot-observability/references/trace-capabilities.md",
            "connect-observability/references/routing.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            "troubleshoot-observability/references/microsoft-foundry/SKILL.md",
        ):
            with self.subTest(entry=relative):
                text = (SKILLS / relative).read_text("utf-8")
                self.assertIn(SHARED, text)
        handoff = (REFS / "handoff.md").read_text("utf-8")
        for phrase in ("offered/declined recommendation versus accepted review",
                       "approved inspection versus execution", "remaining limits"):
            self.assertIn(phrase, handoff)

    def test_active_paths_have_no_explicit_only_sre_gate_but_obs_keeps_it(self):
        paths = [
            SKILLS / "troubleshoot-observability/SKILL.md",
            REFS / "specialists.md", REFS / "matching.md",
            REFS / "acquire-capability.md", REFS / "trace-capabilities.md",
            SKILLS / "connect-observability/references/routing.md",
            SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            SKILLS / "troubleshoot-observability/references/microsoft-foundry/SKILL.md",
            ROOT / "docs/overview.md",
        ]
        for path in paths:
            text = " ".join(path.read_text("utf-8").split())
            with self.subTest(path=path):
                self.assertNotRegex(text, re.compile(
                    r"(?:SRE (?:Agent )?requires an? explicit request|"
                    r"For SRE, require the explicit request|"
                    r"SRE is a distinct explicit-request branch|"
                    r"Existing SRE Agent explicitly requested)"))
        nested = (SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/README.md").read_text("utf-8")
        self.assertIn("Direct telemetry (default)", nested)
        self.assertIn("Unknown controls leave execution blocked", self.text)

    def test_hosts_remain_independently_unrun_and_trace_route_preserved(self):
        host = " ".join((REFS / "host-tests.md").read_text("utf-8").split())
        self.assertIn(ORGANIC_PROMPT, host)
        self.assertIn("VS Code UNRUN; CLI UNRUN", host)
        self.assertIn("not actual model selection or SRE live execution", host)
        self.assertIn("entire 0.3.36 TraceStore suite", host)
        trace = (REFS / "trace-capabilities.md").read_text("utf-8")
        self.assertIn("0.3.37 preserves all 0.3.36 TraceStore routing", trace)
        self.assertIn("Review acceptance is not execution approval", trace)


if __name__ == "__main__":
    unittest.main()
