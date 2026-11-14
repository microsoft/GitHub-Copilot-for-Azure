"""Synthetic instruction contracts only, not host/model execution or enforcement."""

import json
import re
from pathlib import Path
import unittest


SKILLS = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill" / "skills"
REFERENCE = "troubleshoot-observability/references/next-actions.md"


def references_next_actions(relative):
    """Receiving-layout adaptation: imported specialists link the shared policy by relative path."""
    path = SKILLS / relative
    raw = path.read_text("utf-8")
    if "references/next-actions.md" in raw:
        return True
    target = (SKILLS / REFERENCE).resolve()
    return any((path.parent / link.split("#")[0]).resolve() == target
               for link in re.findall(r"\]\(([^)]+)\)", raw) if "://" not in link)


def read(relative):
    return " ".join((SKILLS / relative).read_text("utf-8").split())


class NextActionContracts(unittest.TestCase):
    def setUp(self):
        self.policy = read(REFERENCE)
        fixture = json.loads((SKILLS / "troubleshoot-observability" / "references"
                              / "next-action-cases.json").read_text("utf-8"))
        self.assertIn("not executed", fixture["provenance"])
        self.cases = {case["id"]: case for case in fixture["cases"]}
        self.assertEqual(len(self.cases), len(fixture["cases"]))

    def test_actionable_results_offer_one_human_planning_decision(self):
        for phrase in ("smallest supported change", "one concise human question",
                       "Would you like me to review the smallest fix and rollback plan?",
                       "**Review fix** / **Stop with diagnosis**",
                       "Never require a skill name", "planning", "plan review only",
                       "no edits", "action-specific approvals", "do not auto-run"):
            self.assertIn(phrase, self.policy)
        for name in ("coordinator-actionable", "direct-foundry-trace",
                     "direct-foundry-runtime", "direct-diagnostics",
                     "nested-obs-return", "read-only", "diagnosis-only"):
            with self.subTest(case=name):
                case = self.cases[name]
                self.assertEqual(case["stage"], "Investigate the affected path")
                self.assertEqual(case["permission"], "planning only")
                self.assertEqual(case["question"].count("?"), 1)

    def test_completed_plan_unblocks_source_or_exact_edit_not_verification(self):
        for phrase in ("After a reviewed supported plan", "smallest concrete implementation step",
                       "Where is the source/config", "Open the workspace",
                       "share the relevant files with secrets removed",
                       "exact target and minimal edit", "operation-specific approval",
                       "review the concrete diff", "acceptance criteria and rollback",
                       "Do not demand engineering recipes"):
            self.assertIn(phrase, self.policy)
        for name in ("completed-plan-missing-source", "completed-plan-known-source",
                     "plan-approval-only", "permitted-local-source",
                     "remote-source-separate-read", "historical-effective-version"):
            with self.subTest(case=name):
                self.assertEqual(self.cases[name]["stage"], "Guide an approved fix")
                self.assertEqual(self.cases[name]["question"].count("?"), 1)
        self.assertIn("adapter.py", self.cases["completed-plan-known-source"]["question"])
        self.assertEqual(self.cases["plan-approval-only"]["permission"], "planning only")

    def test_source_access_and_historical_fix_boundaries(self):
        for phrase in ("A plan-review yes grants no source reads",
                       "inspect only relevant nonsecret source",
                       "No broad scans, credentials, `.env`",
                       "installed plugin/cache", "no automatic cloning",
                       "telemetry permission does not cover fetching/exporting code",
                       "Do not fetch it automatically", "confirm the effective current code/version",
                       "Do not assume the old version remains deployed",
                       "create missing resources", "unresolved cause still needs"):
            self.assertIn(phrase, self.policy)
        self.assertEqual(self.cases["permitted-local-source"]["permission"],
                         "scoped source read only")
        self.assertEqual(self.cases["remote-source-separate-read"]["permission"],
                         "separate source read approval required")
        self.assertEqual(self.cases["completed-plan-unresolved-cause"]["stage"],
                         "Investigate the affected path")
        self.assertIsNone(self.cases["completed-plan-decline"]["question"])
        self.assertEqual(self.cases["completed-plan-decline"]["permission"], "none")

    def test_local_edit_is_not_deployed_recovery_or_automatic_validation(self):
        for phrase in ("distinguish local unit validation from deployed behavior",
                       "do not imply deployment or production recovery",
                       "Local-only fixes do not require cloud deployment",
                       "Do not automatically run new tests", "actual effective change",
                       "local-only comparison cannot certify deployed behavior"):
            self.assertIn(phrase, self.policy)
        local = self.cases["local-edit-not-production"]
        self.assertEqual(local["stage"], "Guide an approved fix")
        self.assertEqual(local["permission"], "local validation approval required")
        self.assertEqual(self.cases["local-only-effective-change"]["permission"],
                         "supplied comparison only")

    def test_completed_plan_continuation_is_reachable_without_coordinator(self):
        for path in (
            "troubleshoot-observability/SKILL.md",
            "troubleshoot-observability/references/azure-diagnostics/SKILL.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            "troubleshoot-observability/references/microsoft-foundry/SKILL.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/troubleshoot/troubleshoot.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/observe/references/analyze-results.md",
        ):
            with self.subTest(path=path):
                text = read(path)
                self.assertTrue(references_next_actions(path))
                self.assertIn("missing source", text)
                self.assertIn("separate approval", text)
        host = read("troubleshoot-observability/references/host-tests.md")
        for phrase in ("Installation/catalog gate", "Six physical entries do not prove",
                       "six registered skills", "health missing", "unrun"):
            self.assertIn(phrase, host)
        for name in ("troubleshoot-observability", "connect-observability",
                     "assess-observability-health", "verify-observability-fix",
                     "azure-diagnostics", "microsoft-foundry"):
            self.assertIn("`" + name + "`", host)
        verify = read("verify-observability-fix/SKILL.md")
        self.assertIn("effective in the scope being verified", verify)
        self.assertIn("does not establish deployed behavior", verify)

    def test_direct_and_nested_results_link_same_policy(self):
        paths = (
            "troubleshoot-observability/SKILL.md",
            "troubleshoot-observability/references/azure-diagnostics/SKILL.md",
            "troubleshoot-observability/references/azure-diagnostics/investigation/README.md",
            "troubleshoot-observability/references/microsoft-foundry/SKILL.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/trace/trace.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/troubleshoot/troubleshoot.md",
            "troubleshoot-observability/references/microsoft-foundry/foundry-agent/observe/references/analyze-results.md",
            "verify-observability-fix/SKILL.md",
            "connect-observability/references/routing.md",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(references_next_actions(path))
        self.assertIn("belongs in chat, not a new service request", self.policy)
        self.assertIn("That stopping rule does not suppress", self.policy)

    def test_causal_fix_is_separate_from_speculative_quality_risk(self):
        for phrase in ("narrowest causally supported option", "disabling that injector first",
                       "separate optional optimization", "latency effect is unproven",
                       "quality risk", "Do not bundle"):
            self.assertIn(phrase, self.policy)
        self.assertIn("separate optional quality-risk experiment",
                      self.cases["coordinator-actionable"]["next_action"])

    def test_readonly_and_diagnosis_only_allow_offer_not_execution(self):
        for phrase in ("Read-only or no-changes forbids execution",
                       "Diagnosis-only limits work to diagnosis",
                       "unless the developer opts into", "It authorizes no edits"):
            self.assertIn(phrase, self.policy)
        self.assertIn("do not begin planning without acceptance",
                      self.cases["diagnosis-only"]["next_action"])
        self.assertIn("without reads, edits, deployment, traffic or saving",
                      self.cases["read-only"]["next_action"])

    def test_stop_and_decline_are_not_repeated_prompts(self):
        for phrase in ("recommendations only", "no follow-up", "previously declined",
                       "suppress", "do not nag", "offered/accepted/declined",
                       "Reuse an accepted plan review or declined offer",
                       "unexpired, covered action approvals"):
            self.assertIn(phrase, self.policy)
        for name in ("recommendations-only", "explicit-stop",
                     "declined-review-handoff", "accepted-review-handoff",
                     "covered-approved-plan"):
            self.assertIsNone(self.cases[name]["question"])
        handoff = read("troubleshoot-observability/references/handoff.md")
        for phrase in ("Next action", "offered/accepted/declined", "execution ceiling"):
            self.assertIn(phrase, handoff)

    def test_unresolved_cause_requests_smallest_missing_evidence(self):
        for phrase in ("do not manufacture a fix", "smallest missing evidence read",
                       "finite budget", "appropriate approval",
                       "smallest missing supplied observation"):
            self.assertIn(phrase, self.policy)
        self.assertEqual(self.cases["uncertain-cause"]["permission"],
                         "separate bounded read approval")
        self.assertEqual(self.cases["direct-foundry-existing-results"]["permission"],
                         "supplied evidence only")

    def test_actual_change_offers_verification_not_a_plan(self):
        for phrase in ("actual separately approved change is confirmed",
                       "proactively", "Would you like me to compare",
                       "`verify-observability-fix`", "previously accepted verification",
                       "A proposed or merely approved plan stays"):
            self.assertIn(phrase, self.policy)
        self.assertEqual(self.cases["actual-change"]["permission"],
                         "supplied comparison only")
        self.assertEqual(self.cases["planned-only"]["stage"], "Guide an approved fix")
        verify = read("verify-observability-fix/SKILL.md")
        self.assertIn("do not start verification", verify)
        self.assertIn("A proposed or approved plan", verify)

    def test_verification_yes_never_collects_or_fabricates_success(self):
        for phrase in ("existing explicitly supplied evidence",
                       'A yes or "continue" grants no new reads, jobs, traffic',
                       "missing/stale", "INCONCLUSIVE", "minimal missing supplied",
                       "separately approved collection", "Do not auto-collect",
                       "Deployment success alone is not recovery"):
            self.assertIn(phrase, self.policy)
        self.assertIsNone(self.cases["accepted-verification"]["question"])
        for name in ("missing-post-evidence", "deployment-only"):
            self.assertIn("INCONCLUSIVE", self.cases[name]["next_action"])
            self.assertEqual(self.cases[name]["permission"], "supplied comparison only")

    def test_health_choice_and_optional_visuals_do_not_compete(self):
        health = read("assess-observability-health/SKILL.md")
        for phrase in ("finding-selection question", "never auto-select rank 1",
                       "no-follow-up", "Defer optional visual questions",
                       "does not prohibit a legitimate human next-step question"):
            self.assertIn(phrase, health)
        self.assertEqual(self.cases["health-selection"]["permission"], "selection only")
        visual = read("troubleshoot-observability/references/visual-evidence.md")
        self.assertIn("next-actions.md", visual)
        self.assertIn("Defer a new optional visual offer", visual)
        self.assertIn("never bundle two choices", self.policy)

    def test_concepts_and_topic_switches_do_not_continue_journey(self):
        for phrase in ("current-request intent gate first", "conceptual answers",
                       "general coding", "unrelated topic switches",
                       "no journey continuation"):
            self.assertIn(phrase, self.policy)
        for name in ("topic-switch", "conceptual"):
            self.assertIsNone(self.cases[name]["stage"])
            self.assertIsNone(self.cases[name]["question"])

    def test_coordinated_investigate_to_accepted_plan_has_top_presentation(self):
        for phrase in ("already coordinated journey", "not from the skill currently answering",
                       "actual response point", "at the TOP", "before the indicator",
                       "Investigate the affected path", "not the entry Detect graph",
                       "When an offered fix-plan review is accepted",
                       "Guide an approved fix", "**You're here: Remediate**",
                       "Only then give the review content",
                       "Planning only · No changes made", "buried at the end",
                       "after an actual effective change", "Validate recovery"):
            self.assertIn(phrase, self.policy)
        for path in ("troubleshoot-observability/SKILL.md", "troubleshoot-observability/references/azure-diagnostics/SKILL.md",
                     "troubleshoot-observability/references/microsoft-foundry/SKILL.md"):
            text = read(path)
            self.assertTrue(references_next_actions(path))
            self.assertIn("already coordinated journey", text)
            self.assertIn("source bounds", text)

    def test_remediate_literal_graph_is_safe_and_not_evidence_svg(self):
        text = (SKILLS / "troubleshoot-observability/references/journey-indicator.md"
                ).read_text("utf-8")
        example = text.split("### Accepted plan review: literal Remediate example")[1]
        graph = example.split("```mermaid\n", 1)[1].split("```", 1)[0]
        for node in ('D("Detect")', 'I("Investigate")',
                     'R("Remediate<br/>Reviewing a fix")', 'V("Validate")'):
            self.assertIn(node, graph)
        self.assertEqual(graph.count("stroke-width:3px"), 1)
        self.assertIn("style R fill:#17365d", graph)
        for node in ("D", "I", "V"):
            self.assertIn("style " + node + " fill:#242930", graph)
        self.assertLess(example.index("**You're here: Remediate**"),
                        example.index("```mermaid"))
        for phrase in ("not an SVG file", "not a guaranteed rendered graphic",
                       "No file write", "do not enable health",
                       "omit-diagram", "accessible text or rendering failure",
                       "Prior stages are neutral"):
            self.assertIn(phrase, " ".join(example.split()))

    def test_standalone_no_diagram_and_fallback_preserve_intent(self):
        for phrase in ("An explicit standalone specialist request does not start",
                       "coordinator for presentation", "direct skill header only",
                       "no-diagram, accessible text", "rendering-failure fallback",
                       "Routine continuations need no repeated diagram",
                       "not a new runtime state mechanism"):
            self.assertIn(phrase, self.policy)
        indicator = read("troubleshoot-observability/references/journey-indicator.md")
        for phrase in ("This reference does not activate the coordinator",
                       "topic switch ends", "Generating a diagram is not proof it rendered",
                       "do not print both forms"):
            self.assertIn(phrase, indicator)

    def test_substantive_report_preserves_depth_without_fabrication_or_forced_health(self):
        handoff = read("troubleshoot-observability/references/handoff.md")
        for phrase in ("executive finding", "exact UTC window", "sources",
                       "freshness/retrieval basis", "counts/denominators", "units",
                       "source/query basis", "finding state", "do not invent a health rank",
                       "no extra reads or health pass", "Quick questions",
                       "resolved parent/child", "transport status versus semantic",
                       "customer outcome", "representative-chain corroboration",
                       "Separate observed evidence", "unknown causes",
                       "Bound customer impact", "INCONCLUSIVE", "capped",
                       "fallback, blocked or excluded", "do not prove a dedicated Trace MCP",
                       "identifiable actual operation evidence", "safe existing source/query",
                       "Do not invent URLs", "arbitrary timeout/HTTP"):
            self.assertIn(phrase, handoff)

    def test_plan_review_keeps_support_source_consent_and_no_recovery_claim(self):
        for phrase in ("briefly carries its decisive support and uncertainty",
                       "rather than duplicating", "smallest change, risk, exact target",
                       "unknown if unconfirmed", "not an agreed SLO",
                       "source question or concrete edit-consent question",
                       "never source and deployment consent together",
                       "Planning consent still authorizes no operations",
                       "A plan-review yes grants no source reads",
                       "local-only comparison cannot certify deployed behavior"):
            self.assertIn(phrase, self.policy)
        self.assertEqual(self.cases["local-edit-not-production"]["stage"],
                         "Guide an approved fix")
        self.assertEqual(self.cases["planned-only"]["stage"], "Guide an approved fix")
        self.assertEqual(self.cases["uncertain-cause"]["stage"],
                         "Investigate the affected path")


if __name__ == "__main__":
    unittest.main()
