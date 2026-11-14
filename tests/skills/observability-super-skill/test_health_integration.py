"""Offline packaging/instruction contracts, not host routing or live behavior."""

import hashlib
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILLS = ROOT / "skills"
HEALTH = SKILLS / "assess-observability-health"


def assets():
    return {
        path.relative_to(ROOT).as_posix(): path.read_bytes()
        for path in SKILLS.rglob("*") if path.is_file()
    }


def read(relative):
    return (HEALTH / relative).read_text(encoding="utf-8")


class HealthIntegrationContracts(unittest.TestCase):
    def test_complete_health_subset_and_public_investigation_are_exported(self):
        payload = assets()
        self.assertEqual(len(list(SKILLS.iterdir())), 4)  # receiving layout: four registered skills
        self.assertFalse((HEALTH.parent / "assess-production-health").exists())
        self.assertFalse(any("skills/assess-production-health/" in name for name in payload))
        prefix = "skills/assess-observability-health/"
        expected = {
            "SKILL.md", "scripts/render_inline_health_visual.py",
            "scripts/build_appinsights_trace_link.py",
            *("references/" + name for name in (
                "application-health.md", "foundry-agent-health.md",
                "health-contract.md", "inline-health-visual.md", "provenance.md",
                "transaction-links.md", "host-tests.md", "integration-cases.json",
                "integration-host-tests.md", "evidence.md", "web-api.md",
                "foundry-agent.md", "query-guidance.md",
            )),
        }
        self.assertEqual(
            # Receiving-layout adaptation: version.json is a receiving-repository scaffold file.
            {name.removeprefix(prefix) for name in payload if name.startswith(prefix)} - {"version.json"},
            expected,
        )
        self.assertEqual(
            {name for name in payload if name.startswith("skills/troubleshoot-observability/references/azure-diagnostics/investigation/scripts/")},
            {"skills/troubleshoot-observability/references/azure-diagnostics/investigation/scripts/query_prometheus.py"},
        )
        self.assertNotIn(prefix + "LICENSE.md", payload)

    def test_renderer_retained_and_portal_helper_adapted_with_lf_hashes(self):
        hashes = {
            "build_appinsights_trace_link.py":
                "986a21ea53737be5defc9e54f5a3a2b7ab641949558870924d5be637c7d37d9d",
            "render_inline_health_visual.py":
                "b8a14f282cf048165ba28dfd9522370d7ec67fb4e69e1ec3757ddeb86c05b813",
        }
        for name, digest in hashes.items():
            with self.subTest(helper=name):
                data = (HEALTH / "scripts" / name).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
                self.assertNotIn(b"\r\n", data)

    def test_reuse_permission_is_not_an_invented_license(self):
        text = " ".join(read("references/provenance.md").split())
        for requirement in (
            "2026-11-11", "explicitly confirmed reuse permission",
            "No upstream LICENSE was found", "not an MIT grant",
            "permission to ship", "not merely local reuse",
        ):
            self.assertIn(requirement, text)
        self.assertIn("shipping approval for this included contribution is confirmed", text)
        self.assertNotIn("Confirm the scope of distribution", text)
        self.assertIn("not byte-identical", text)
        self.assertIn("do not verify portal rendering", text)

    def test_evidence_only_entry_and_actual_operation_discovery(self):
        text = read("SKILL.md")
        for requirement in (
            "complete no-cloud path", "run Python, save files, install anything",
            "actual host operations", "input/output schemas", "not universal",
            "no environment dumps", "nonsecret identifiers", "untrusted data",
            "**Planned tools:**", "**Tools used:**", "host activation unverified",
        ):
            self.assertIn(requirement, text)
        foundry = read("references/foundry-agent-health.md")
        self.assertNotIn("following tested shapes", foundry)
        self.assertNotIn("active environment values", foundry)
        self.assertIn("not fixed universal", foundry)
        self.assertIn("No new evaluation is required", foundry)

    def test_budget_window_schema_and_no_retry_limits_apply_to_all_rounds(self):
        text = read("SKILL.md")
        for requirement in (
            "both telemetry rounds", "same total budget", "single correction",
            "remaining call/row budgets", "broaden the window",
            "retry when prohibited", "smaller approved limits",
        ):
            self.assertIn(requirement, text)
        for reference in ("application-health.md", "foundry-agent-health.md"):
            text = read("references/" + reference)
            self.assertIn("budget", text)
            self.assertIn("window", text)
            self.assertIn("schema", text)

    def test_renderer_is_optional_consented_and_uses_no_extra_queries(self):
        text = read("SKILL.md")
        for requirement in (
            "optionally offer", "explicit consent", "approved Python interpreter",
            "never install Python", "complete chat assessment",
            "Do not issue new remote queries",
        ):
            self.assertIn(requirement, text)
        reference = read("references/inline-health-visual.md")
        self.assertIn("no install/setup", reference)
        self.assertIn("approved local destination", reference)

    def test_original_classification_and_ranked_procedures_remain(self):
        text = read("references/health-contract.md")
        for requirement in (
            "active customer-visible failure", "degraded_success",
            "recovered incident", "coverage_gap", "Resource-pressure rule",
            "Request-success rule", "INCONCLUSIVE", "partial/truncated",
            "confidence percentages", "chosen",
        ):
            self.assertIn(requirement, text)
        application = read("references/application-health.md")
        for section in ("Named AKS", "Named VM", "Functions and HTTP dependencies"):
            self.assertIn(section, application)
        self.assertIn("canonical", read("SKILL.md"))
        self.assertIn("failed + passed", read("references/foundry-agent-health.md"))

    def test_selected_finding_handoff_and_fallback_cannot_loop(self):
        text = read("SKILL.md")
        for requirement in (
            "never run competing", "developer's chosen finding",
            "azure-diagnostics", "microsoft-foundry", "health-selection loop",
            "Neither health nor ordinary",
        ):
            self.assertIn(requirement, text)
        self.assertIn("Ordinary health and onboarding handoffs use this stable entry", text)
        self.assertIn("request for an eligible available external specialist", text)
        self.assertIn("not dual engines", text)

    def test_no_remaining_sibling_script_or_portal_reference_dependency(self):
        text = read("references/transaction-links.md")
        self.assertEqual(len(list(HEALTH.parent.rglob("build_appinsights_trace_link.py"))), 1)
        self.assertIn("scripts/build_appinsights_trace_link.py", text)
        self.assertIn("itemId UUID", text)
        self.assertIn("Do not issue new reads", text)
        self.assertIn("verified component link", text)

    def test_failure_fixtures_are_specs_and_host_validation_is_unrun(self):
        fixture = json.loads(read("references/integration-cases.json"))
        self.assertEqual(
            fixture["provenance"], "synthetic-specification-not-host-execution"
        )
        self.assertEqual(
            fixture["permission_ceiling"], "supplied-evidence-only-no-cloud-scripts-saves"
        )
        self.assertEqual(
            {case["id"] for case in fixture["cases"]},
            {"handled-failure", "stale-empty-partial", "existing-budget",
             "renderer-declined", "explicit-stable-entry", "selected-rank-2"},
        )
        for case in fixture["cases"]:
            self.assertTrue(case["evidence"])
            self.assertTrue(case["expected"])
        text = read("references/integration-host-tests.md")
        self.assertIn("unrun host gates", text)
        self.assertIn("VS Code and Copilot CLI separately", text)
        self.assertIn("not observed host behavior", " ".join(text.split()))

    def test_one_canonical_classifier_and_public_guidance_are_wired(self):
        entry = read("SKILL.md")
        for reference in (
            "health-contract.md", "evidence.md", "query-guidance.md", "web-api.md",
            "application-health.md", "foundry-agent-health.md", "foundry-agent.md",
            "inline-health-visual.md", "transaction-links.md", "provenance.md",
        ):
            self.assertIn("references/" + reference, entry)
        evidence = read("references/evidence.md")
        self.assertIn("single [health classification contract]", evidence)
        self.assertNotIn("- **HEALTHY:**", evidence)
        self.assertIn("VERIFIED_RECOVERED", read("references/health-contract.md"))
        correlation = read("references/foundry-agent.md")
        self.assertIn("De-duplicate request trace IDs", correlation)
        self.assertIn("Same-trace membership", correlation)
        self.assertIn("50 rows", read("references/foundry-agent-health.md"))

    def test_live_routing_has_no_automatic_separate_health_preference(self):
        paths = (
            "skills/connect-observability/SKILL.md",
            "skills/connect-observability/references/routing.md",
            "skills/troubleshoot-observability/SKILL.md",
            "skills/troubleshoot-observability/references/specialists.md",
        )
        for path in paths:
            with self.subTest(path=path):
                text = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn("assess-observability-health", text)
                self.assertNotIn("assess-production-health", text)
                self.assertNotIn(
                    "Prefer applicable available contributed assessment over the public fallback",
                    text,
                )
        payload = assets()
        entries = {name for name in payload if name.startswith("skills/")
                   and name.endswith("/SKILL.md") and len(name.split("/")) == 3}
        self.assertEqual(len(entries), 4)  # receiving layout: four registered skills
        self.assertFalse(any("assess-production-health/" in name for name in payload))
        for helper in ("render_inline_health_visual.py", "build_appinsights_trace_link.py"):
            name = "skills/assess-observability-health/scripts/" + helper
            self.assertEqual(payload[name], (HEALTH / "scripts" / helper).read_bytes())


if __name__ == "__main__":
    unittest.main()
