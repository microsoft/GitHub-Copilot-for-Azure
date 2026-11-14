"""Synthetic fixture/instruction checks only; no model or integration execution."""

import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILLS = ROOT / "skills"
REFERENCES = SKILLS / "troubleshoot-observability/references"


class TraceSelectionTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((REFERENCES / "trace-selection-cases.json").read_text("utf-8"))
        self.text = " ".join((REFERENCES / "trace-capabilities.md").read_text("utf-8").split())
        self.cases = {case["id"]: case for case in self.fixture["cases"]}

    def test_bounded_synthetic_cases_are_not_host_execution(self):
        self.assertEqual(self.fixture["schema_version"], 1)
        self.assertEqual(self.fixture["provenance"], "synthetic-specification-not-host-execution")
        self.assertEqual(self.fixture["permission_ceiling"], "supplied-evidence-and-local-skill-reads-only")
        self.assertEqual(len(self.cases), 29)
        self.assertEqual(len(self.fixture["cases"]), 29)
        scope = self.fixture["scope"]
        self.assertLess(scope["window_start_utc"], scope["window_end_utc"])
        self.assertEqual(scope["total_read_budget"], 6)
        self.assertEqual(scope["remaining_read_budget"], 2)
        self.assertEqual(scope["max_aggregate_rows"], 50)
        self.assertEqual(scope["max_representative_operations"], 2)
        self.assertEqual(set(self.fixture["forbidden_operations"]), {
            "azure-query", "fetch-upstream", "install", "local-write",
            "script-execution", "job-create", "generate-traffic", "deploy",
            "switch-identity", "grant-role",
        })
        for case in self.cases.values():
            with self.subTest(case=case["id"]):
                self.assertEqual(set(case), {"id", "prompt", "evidence", "expected", "forbidden"})
                self.assertIn("supplied synthetic evidence only", case["prompt"])
                self.assertIn(case["expected"]["fit"], {"matched", "needs-confirmation", "ineligible"})
                self.assertIn(case["expected"]["availability"], {"available", "blocked", "unverified"})
                self.assertTrue(case["expected"]["reason"])
                self.assertTrue(case["forbidden"])

    def test_exact_case_decisions(self):
        expected = {
            "organic-monitor-router-parent-gap": ("needs-confirmation", "available", "visible-route-decision-then-one-scoped-source-check-approval"),
            "organic-router-no-query": ("needs-confirmation", "available", "metadata-only-decision-no-source-probe"),
            "fresh-confirmed-router-reuse": ("matched", "available", "reuse-source-schema-and-covered-approval-for-one-lookup"),
            "candidate-id-association-check": ("needs-confirmation", "available", "validate-candidate-id-with-identity-and-child-timing-match"),
            "whole-page-nested-trace-result": ("matched", "available", "report-separate-counts-limit-expansion-and-timing-gaps-stop"),
            "aggregation-failed-no-retry": ("matched", "available", "retain-failed-aggregation-no-automatic-retry-or-revised-query"),
            "separately-approved-revised-lookup": ("matched", "available", "report-partial-retrieval-success-separate-from-failed-aggregation"),
            "organic-source-declined": ("needs-confirmation", "available", "honor-decline-retain-current-path-and-gaps"),
            "irrelevant-gap-chosen-fix": ("ineligible", "unverified", "stop-with-explicit-gap-no-compulsory-lookup"),
            "cap-before-next-pass-chain": ("needs-confirmation", "unverified", "visible-decision-before-next-pass-and-material-reevaluation"),
            "semantic-content-gap-only": ("ineligible", "unverified", "retain-semantic-content-boundary-without-mcp"),
            "module-or-fixture-failure-only": ("ineligible", "unverified", "do-not-infer-trace-need-from-local-failure"),
            "exhausted-budget-actionable-end": ("matched", "available", "ask-one-bounded-read-approval-or-supplied-evidence-choice"),
            "explicit-current-path-only": ("needs-confirmation", "unverified", "explain-current-path-limit-and-honor-stop"),
            "row-cap-unresolved-parent": ("needs-confirmation", "unverified", "surface-once-bounded-retrieval-or-analysis-candidate"),
            "sufficient-narrow-kql": ("matched", "available", "continue-sufficient-direct-analysis"),
            "candidate-not-discovered": ("needs-confirmation", "unverified", "disclose-candidate-not-discovered-or-usable"),
            "missing-spans-no-recovery-promise": ("needs-confirmation", "unverified", "retain-coverage-uncertainty-without-recovery-promise"),
            "no-query-capability-checkpoint": ("needs-confirmation", "unverified", "inspect-exposed-metadata-only-and-retain-ceiling"),
            "applens-unknown-contract": ("needs-confirmation", "unverified", "retain-unknown-contract-not-presumed-persistence"),
            "sufficient-server-api": ("matched", "available", "retain-sufficient-server-analysis"),
            "retrieval-only-analysis-gap": ("matched", "blocked", "offer-supported-analysis-mcp-or-equivalent-api"),
            "trace-eligibility-unconfirmed": ("needs-confirmation", "unverified", "request-trace-eligibility-and-association-facts"),
            "trace-access-denied": ("matched", "blocked", "retain-permission-gap-and-current-evidence"),
            "partial-server-analysis": ("matched", "available", "report-inconclusive-population-claim-with-partial-findings"),
            "complete-direct-no-delegation": ("matched", "available", "return-direct-finding-without-delegation"),
            "handled-tool-outcome": ("matched", "available", "separate-tool-failure-fallback-and-unknown-parent-outcome"),
            "explicit-sre-permission-gap": ("needs-confirmation", "blocked", "explain-sre-coverage-permissions-and-execution-blocker"),
            "no-query-no-save-handoff": ("matched", "available", "analyze-retained-evidence-inline-only"),
        }
        self.assertEqual(set(self.cases), set(expected))
        for identifier, result in expected.items():
            with self.subTest(case=identifier):
                decision = self.cases[identifier]["expected"]
                self.assertEqual((decision["fit"], decision["availability"], decision["next_action"]), result)

    def test_organic_router_gap_does_not_require_tool_name_or_advanced_analysis(self):
        case = self.cases["organic-monitor-router-parent-gap"]
        self.assertNotIn("MCP", case["prompt"])
        self.assertNotIn("TraceStore", case["prompt"])
        self.assertFalse(case["evidence"]["standalone_server"])
        self.assertEqual(case["evidence"]["advanced_analysis"], "not-exposed")
        for phrase in ("Missing intermediate parents or handoff relationships",
                       "bounded retrieval alone", "available operation candidate",
                       "not an unknown missing standalone server",
                       "Do not wait for the developer to name a tool",
                       "alternative operation contracts, not competing queries to race"):
            self.assertIn(phrase, self.text.replace("**", ""))
        for relative in (
            "troubleshoot-observability/SKILL.md",
            "troubleshoot-observability/references/matching.md",
            "troubleshoot-observability/references/acquire-capability.md",
            "troubleshoot-observability/references/specialists.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            "connect-observability/references/routing.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/references/analyze-latency.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/references/search-traces.md",
        ):
            with self.subTest(entry=relative):
                entry = (SKILLS / relative).read_text("utf-8")
                self.assertIn("TraceStore", entry)

    def test_two_trace_routes_are_examples_not_feature_parity_or_setup(self):
        for phrase in ("4.0.0-beta.1+", "actual exposed version metadata",
                       "monitor_traces_account_list", "monitor_traces_field_list",
                       "monitor_traces_query_run", "monitor_traces_query_resume",
                       "monitor_traces_query_cancel", "functions.azure-monitor",
                       "not portable invocation names or an API",
                       "whether account listing accepts a resource group",
                       "not an ARM ID or accountId GUID",
                       "Microsoft.Azure.Monitor.Traces.Mcp", "az_list_field_names",
                       "only if actually exposed", "verified public distribution and access",
                       "Monitoring Reader", "real network/access",
                       "no local azd, Python or .NET setup", "proves feature parity"):
            self.assertIn(phrase, self.text.replace("**", ""))
        entry = (SKILLS / "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md").read_text("utf-8")
        self.assertNotIn("USE THIS SKILL INSTEAD OF", entry)
        self.assertNotIn("| Preferred query tool |", entry)
        self.assertIn("| App Insights query route |", entry)
        self.assertIn("| TraceStore query route |", entry)

    def test_source_reuse_unknown_identity_and_no_query_are_distinct(self):
        reuse = self.cases["fresh-confirmed-router-reuse"]["evidence"]
        self.assertEqual(reuse["remaining_calls"], reuse["query_calls"])
        self.assertEqual(reuse["approval"], "covered-unexpired")
        unknown = self.cases["candidate-id-association-check"]["evidence"]
        self.assertEqual(unknown["association"], "unknown")
        self.assertEqual(unknown["approved_check"], "one-identity-filtered-lookup")
        self.assertEqual(self.cases["organic-router-no-query"]["evidence"]["permission"], "no-query")
        for phrase in ("do not repeat account/field discovery",
                       "explicitly retained or supplied facts with provenance and freshness",
                       "metadata-only evaluation is not permission to probe",
                       "not universally a TraceStore", "never silently remove identity predicates",
                       "not proven absent from the App Insights store",
                       "do not require proven association before that bounded check"):
            self.assertIn(phrase, self.text.replace("**", ""))

    def test_trace_rows_pages_and_timing_do_not_certify_complete_path(self):
        result = self.cases["whole-page-nested-trace-result"]["evidence"]
        self.assertGreater(result["trace_rows"], result["requested_rows"])
        self.assertGreater(result["span_count"], result["trace_rows"])
        self.assertIsNone(result["bytes"])
        self.assertFalse(result["output_limit_reached"])
        for phrase in ("one trace row is not one span", "trace_rows", "span_count",
                       "whole backend pages", "no hard span/byte cap",
                       "not automatic collection, pagination or budget renewal",
                       "trace envelope", "Children ending after their parent",
                       "valid full critical path"):
            self.assertIn(phrase, self.text.replace("**", ""))

    def test_aggregation_failure_needs_separate_revised_lookup_approval(self):
        failed = self.cases["aggregation-failed-no-retry"]
        success = self.cases["separately-approved-revised-lookup"]
        self.assertEqual(failed["evidence"]["remaining_calls"], 1)
        self.assertEqual(failed["evidence"]["revised_lookup"], "not-approved")
        self.assertEqual(success["evidence"]["revised_lookup_approval"], "separate-one-call")
        for phrase in ("remaining budget is not permission for a changed query",
                       "Honor no-retry ceilings", "not proof of denied access",
                       "Do not retry, correct or fall back automatically",
                       "separately approved revised nonaggregation lookup",
                       "does not establish aggregation support"):
            self.assertIn(phrase, self.text)

    def test_negative_choices_do_not_force_trace_or_change_service_selection(self):
        for identifier, forbidden in (
            ("sufficient-narrow-kql", "require-new-mcp"),
            ("organic-source-declined", "force-trace-route"),
            ("irrelevant-gap-chosen-fix", "mandatory-tracestore"),
        ):
            self.assertIn(forbidden, self.cases[identifier]["forbidden"])
        self.assertIn("If the answer is already sufficient, do no additional reads", self.text)
        self.assertIn("not a compulsory trace query or health assessment", self.text)
        nested = " ".join((SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/README.md").read_text("utf-8").split())
        self.assertIn("Direct telemetry (default)", nested)
        self.assertIn("recommendation-only SRE contract", nested)
        self.assertIn("never automatic delegation", nested)
        self.assertIn("Review acceptance is not execution approval", nested)

    def test_api_sufficiency_and_retrieval_gap_do_not_confuse_transport(self):
        sufficient = self.cases["sufficient-server-api"]
        self.assertEqual(sufficient["evidence"]["transport"], "api")
        self.assertIn("require-new-mcp", sufficient["forbidden"])
        gap = self.cases["retrieval-only-analysis-gap"]
        self.assertEqual(gap["evidence"]["retrieval"], "successful")
        self.assertEqual(gap["evidence"]["analysis"], "unsupported")
        for forbidden in ("bulk-download", "local-percentiles", "local-critical-path",
                          "invent-operation-name", "silent-pagination", "shopping-list"):
            self.assertIn(forbidden, gap["forbidden"])
        for phrase in ("non-MCP API", "input/output schemas", "capability gap proactively",
                       "or equivalent server-side", "not a missing-integration shopping list",
                       "Do not invent operation names"):
            self.assertIn(phrase, self.text.replace("**", ""))

    def test_synthetic_chain_requires_decision_before_both_budget_requests(self):
        chain = self.cases["cap-before-next-pass-chain"]["evidence"]
        self.assertEqual(chain["reference"], "already-loaded")
        self.assertEqual(chain["initial_query_budget"], 8)
        cap, narrowed, correlation, exhausted = chain["steps"]
        self.assertEqual(cap["row_cap"], 50)
        self.assertEqual(cap["next_requested"], {"queries": 4, "metadata_reads": 4})
        self.assertEqual(cap["required_before_request"], "visible-trace-capability-decision")
        self.assertEqual(narrowed["failure_chains"], 2)
        self.assertEqual(narrowed["required"], "explicit-current-path-rationale")
        self.assertTrue(correlation["material_change"])
        self.assertEqual(correlation["next_requested"]["queries"], 3)
        self.assertEqual(correlation["required_before_request"], "reevaluate-visible-decision")
        self.assertEqual(exhausted["cause"], "unresolved")
        for phrase in ("BEFORE requesting the next evidence pass",
                       "already loaded", "once per material issue",
                       "unanswered question", "existing path can answer it and why",
                       "availability/eligibility", "next bounded choice"):
            self.assertIn(phrase, self.text.replace("**", ""))

    def test_visible_checkpoint_is_reachable_at_each_entry(self):
        for relative in (
            "troubleshoot-observability/SKILL.md",
            "troubleshoot-observability/references/azure-diagnostics/SKILL.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md",
        ):
            with self.subTest(entry=relative):
                text = " ".join((SKILLS / relative).read_text("utf-8").split())
                self.assertIn("Trace capability decision", text)
                self.assertIn("before", text.casefold())
                self.assertIn("next evidence pass or budget", text)
                self.assertIn("do not defer", text.casefold())

    def test_decision_is_not_deferred_to_eligibility_and_no_automatic_scans(self):
        for phrase in ("Decide scenario fit now, separately from availability and access",
                       "not defer the capability decision until cloud",
                       "documented candidate, not discovered",
                       "one scoped capability-check permission",
                       "no supported check is exposed", "supplied facts instead",
                       "Do not loop approval questions",
                       "scan Azure Monitor workspaces (AMW) automatically",
                       "Actual use still requires verified eligibility/schema/access"):
            self.assertIn(phrase, self.text.replace("**", ""))

    def test_sufficient_narrow_path_gets_explicit_reason_not_forced_discovery(self):
        self.assertIn("If narrowed KQL is sufficient, explicitly say why", self.text)
        self.assertIn("without forcing MCP use or cloud discovery", self.text)
        self.assertIn("require-new-mcp", self.cases["sufficient-narrow-kql"]["forbidden"])

    def test_content_and_local_failures_do_not_establish_trace_need(self):
        for identifier in ("semantic-content-gap-only", "module-or-fixture-failure-only"):
            self.assertEqual(self.cases[identifier]["expected"]["fit"], "ineligible")
            self.assertIn("require-new-mcp", self.cases[identifier]["forbidden"])
        for phrase in ("Missing semantic content", "a missing module",
                       "fixture parse failure alone is not a trace-analysis need",
                       "retrieved parent span/tree coverage",
                       "cannot manufacture cross-product IDs"):
            self.assertIn(phrase, self.text)

    def test_exhausted_budget_ends_with_actionable_choice_not_unknown_fix(self):
        evidence = self.cases["exhausted-budget-actionable-end"]["evidence"]
        self.assertEqual(evidence["remaining_read_budget"], 0)
        self.assertEqual(evidence["proposed_reads"], 1)
        contract = " ".join((REFERENCES / "next-actions.md").read_text("utf-8").split())
        for phrase in ("exhausted budget", "ONE actionable question",
                       "May I read", "UTC window, predicates, finite reads/rows",
                       "supply that sanitized evidence", "no-query remains",
                       "honor stop, decline and no-follow-up",
                       "before this next-pass request"):
            self.assertIn(phrase, contract)
        self.assertIn("never force an unknown fix", self.text)

    def test_explicit_retrieval_and_declined_capability_choice_are_preserved(self):
        case = self.cases["explicit-current-path-only"]
        self.assertFalse(case["evidence"]["follow_up"])
        for phrase in ("explicit retrieval-only, current-path-only",
                       "no-new-integration request", "declined capability check"):
            self.assertIn(phrase, self.text)

    def test_row_cap_and_unresolved_parent_trigger_reachable_checkpoint(self):
        case = self.cases["row-cap-unresolved-parent"]
        self.assertTrue(case["evidence"]["truncated"])
        self.assertEqual(case["evidence"]["query_row_cap"], 50)
        self.assertEqual(case["evidence"]["parent"], "unresolved")
        for phrase in ("Mandatory capability evaluation checkpoint",
                       "before nontrivial distributed trace reconstruction",
                       "truncated or hits its row cap", "missing or disconnected",
                       "repeated joins/manual reconstruction",
                       "unresolved trace/source identity",
                       "once per investigation", "new evidence materially changes"):
            self.assertIn(phrase, self.text)
        for relative in ("troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md",
                         "troubleshoot-observability/references/azure-diagnostics/investigation/README.md"):
            text = " ".join((SKILLS / relative).read_text("utf-8").split())
            for phrase in ("trace-capabilities.md", "nontrivial", "parents", "joins"):
                self.assertIn(phrase, text)

    def test_sufficient_narrow_kql_needs_no_mcp_recommendation(self):
        case = self.cases["sufficient-narrow-kql"]
        self.assertFalse(case["evidence"]["material_gap"])
        self.assertIn("require-new-mcp", case["forbidden"])
        for phrase in ("self-imposed query row cap is not an inherent KQL",
                       "narrower approved KQL query is valid",
                       "continue sufficient direct analysis without recommending"):
            self.assertIn(phrase, self.text)

    def test_unavailable_candidate_is_not_discovered_or_usable(self):
        case = self.cases["candidate-not-discovered"]
        self.assertEqual(case["evidence"]["tool"], "not-exposed")
        self.assertIn("phantom-discovery", case["forbidden"])
        for phrase in ("Documented candidate", "Discovered tool",
                       "Verified usable operation", "bounded retrieval or server-side analysis",
                       "actual operations", "not an invented tool, endpoint or setup recipe",
                       "New access categories", "trust boundaries"):
            self.assertIn(phrase, self.text.replace("**", ""))

    def test_missing_spans_are_not_guaranteed_recoverable(self):
        case = self.cases["missing-spans-no-recovery-promise"]
        self.assertEqual(case["evidence"]["ingestion"], "unknown")
        self.assertIn("guarantee-recovery", case["forbidden"])
        for phrase in ("Do not promise recovery of spans never emitted or ingested",
                       "collection gaps", "rather than declaring uncollected data"):
            self.assertIn(phrase, self.text)

    def test_no_query_evaluation_does_not_execute_cloud_discovery(self):
        case = self.cases["no-query-capability-checkpoint"]
        self.assertEqual(case["evidence"]["approval"], "no-query-no-save")
        for operation in ("cloud-discovery", "schema-read", "eligibility-probe"):
            self.assertIn(operation, case["forbidden"])
        for phrase in ("not mandatory Trace MCP use or cloud discovery",
                       "inspect exposed metadata only",
                       "do not execute cloud discovery, schema reads or source/eligibility probes",
                       "consumes the retained budget"):
            self.assertIn(phrase, self.text)

    def test_unknown_applens_contract_is_not_fabricated_persistence(self):
        case = self.cases["applens-unknown-contract"]
        self.assertEqual(case["evidence"]["side_effects"], "unknown")
        self.assertIn("fabricate-persistence-requirement", case["forbidden"])
        boundaries = " ".join((SKILLS / "troubleshoot-observability/references/azure-diagnostics/references/execution-boundaries.md")
                              .read_text("utf-8").split()).replace("**", "")
        for phrase in ("AppLens brand", "actual exposed schema",
                       "documented side effects", "not presumed stateful or stateless",
                       "missing persistence approval alone is not evidence",
                       "Relevant AppLens diagnostics remain eligible"):
            self.assertIn(phrase, boundaries)
        investigation = (SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/README.md").read_text("utf-8")
        self.assertIn("../references/execution-boundaries.md", investigation)

    def test_source_access_and_partial_data_are_distinct(self):
        self.assertEqual(self.cases["trace-eligibility-unconfirmed"]["evidence"]["traces_enabled"], "unknown")
        self.assertIn("claim-trace-eligibility", self.cases["trace-eligibility-unconfirmed"]["forbidden"])
        self.assertIn("retry-denial", self.cases["trace-access-denied"]["forbidden"])
        partial = self.cases["partial-server-analysis"]
        self.assertIsNone(partial["evidence"]["population_count"])
        self.assertTrue(partial["evidence"]["truncated"])
        for phrase in ("traces enabled", "Microsoft.Monitor/accounts",
                       "configured source coverage", "sampling rate/weighting",
                       "Unknown count or sampling stays unknown",
                       "material gaps yield", "INCONCLUSIVE", "correlation are not causal proof"):
            self.assertIn(phrase, self.text)

    def test_no_redundant_delegation_and_service_permissions(self):
        direct = self.cases["complete-direct-no-delegation"]
        for forbidden in ("mandatory-applens", "health-reassessment", "sre-create"):
            self.assertIn(forbidden, direct["forbidden"])
        sre = self.cases["explicit-sre-permission-gap"]["evidence"]
        self.assertEqual(sre["source_coverage"], "unknown")
        self.assertFalse(sre["enforceable_limits"])
        investigation = " ".join((SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/README.md").read_text("utf-8").split())
        for phrase in ("without redundant service delegation", "Explicit requests",
                       "verified connected/source proof", "remaining budgets"):
            self.assertIn(phrase, investigation)
        selection = " ".join((REFERENCES / "specialists.md").read_text("utf-8").split())
        for phrase in ("Unknown controls leave execution blocked",
                       "STOP service execution", "separate positive approval",
                       "It grants no new reads, source access"):
            self.assertIn(phrase, selection)

    def test_handled_failures_and_ceilings_survive_handoff(self):
        case = self.cases["handled-tool-outcome"]
        self.assertEqual(case["evidence"]["semantic_result"], "failure")
        self.assertEqual(case["evidence"]["parent_outcome"], "unknown")
        for phrase in ("transport success", "structured semantic failure", "caught exception",
                       "fallback", "parent-agent outcome", "No-query/no-save ceilings",
                       "schema reads", "same budget"):
            self.assertIn(phrase.casefold(), self.text.casefold())
        no_save = self.cases["no-query-no-save-handoff"]
        for forbidden in ("azure-query", "local-write", "script-execution", "new-source-read"):
            self.assertIn(forbidden, no_save["forbidden"])

    def test_reference_is_wired_without_fake_sibling_activation(self):
        for relative in (
            "troubleshoot-observability/SKILL.md",
            "troubleshoot-observability/references/matching.md",
            "troubleshoot-observability/references/acquire-capability.md",
            "connect-observability/references/routing.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/references/trace-query-patterns.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md",
        ):
            with self.subTest(resource=relative):
                self.assertIn("trace-capabilities.md", (SKILLS / relative).read_text("utf-8"))
        for relative in ("troubleshoot-observability/references/host-tests.md",
                         "troubleshoot-observability/references/azure-diagnostics/investigation/references/host-tests.md"):
            text = (SKILLS / relative).read_text("utf-8")
            self.assertIn("trace-selection-cases.json", text)
            self.assertIn("unrun", text)

    def test_direct_monitor_path_and_noncontent_exception_projection(self):
        entry = " ".join((SKILLS / "troubleshoot-observability/references/azure-diagnostics/SKILL.md").read_text("utf-8").split())
        self.assertIn("AppLens is not a mandatory preflight", entry)
        self.assertIn("unanswered platform/resource diagnostic question", entry)
        patterns = (SKILLS / "troubleshoot-observability/references/azure-diagnostics/investigation/references/trace-query-patterns.md").read_text("utf-8")
        self.assertNotIn("`OuterMessage`", patterns)
        self.assertNotIn("`InnermostMessage`", patterns)
        self.assertIn("Do not project raw exception messages", patterns)


if __name__ == "__main__":
    unittest.main()
