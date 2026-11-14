"""Public investigation contracts and mocked Prometheus failures; no live reads."""

import importlib.util
import io
import json
from pathlib import Path
import re
import unittest
from unittest.mock import Mock, patch
import urllib.error


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
WORKFLOW = SKILLS / "troubleshoot-observability" / "references" / "azure-diagnostics" / "investigation"
spec = importlib.util.spec_from_file_location(
    "query_prometheus_integration", WORKFLOW / "scripts" / "query_prometheus.py")
prom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prom)


class InvestigationIntegrationTests(unittest.TestCase):
    def test_public_nested_resources_are_complete_and_closed(self):
        self.assertEqual(len(entry_files()), 6)
        expected = {
            "README.md", "scripts/query_prometheus.py",
            *("references/" + name + ".md" for name in (
                "confidence-assessment", "foundry-agent-routing", "managed-prometheus",
                "portal-links", "trace-query-patterns", "provenance", "host-tests")),
        }
        actual = {p.relative_to(WORKFLOW).as_posix() for p in WORKFLOW.rglob("*")
                  if p.is_file()}
        self.assertEqual(actual, expected)

    def test_investigation_links_resolve_to_the_public_resource_set(self):
        for path in SKILLS.rglob("*.md"):
            text = path.read_text("utf-8")
            for link in re.findall(r"\]\(([^)]+)\)", text):
                if "investigation/" not in link or "://" in link:
                    continue
                with self.subTest(path=path, link=link):
                    self.assertTrue((path.parent / link.split("#")[0]).resolve().is_file())

    def test_direct_contract_preserves_scope_causality_and_approvals(self):
        text = " ".join((WORKFLOW / "README.md").read_text("utf-8").split())
        for phrase in (
            "Direct telemetry (default)", "six total reads", "two representative operations",
            "No Python, Azure CLI", "never authorizes", "Do not run a mandatory broad health",
            "parent/child", "semantic", "fallback", "Correlation is not causation",
            "INCONCLUSIVE", "caller-assessed", "rank", "remaining read budgets",
            "trace capability reference", "verified connected/source proof",
            "never automatic delegation", "Review acceptance is not execution approval",
            "verify-observability-fix", "actual separately approved change",
        ):
            self.assertIn(phrase.casefold(), text.casefold())
        provenance = (WORKFLOW / "references" / "provenance.md").read_text("utf-8")
        for phrase in ("permission to", "No upstream LICENSE", "not an MIT grant",
                       "composes", "do not establish host activation"):
            self.assertIn(phrase, provenance)

    def test_all_entry_routes_preserve_the_direct_workflow(self):
        for relative in (
            "troubleshoot-observability/references/azure-diagnostics/SKILL.md", "troubleshoot-observability/references/specialists.md",
            "connect-observability/references/routing.md", "troubleshoot-observability/references/microsoft-foundry/SKILL.md",
        ):
            self.assertIn("investigation/README.md", (SKILLS / relative).read_text("utf-8"))
        selection = (SKILLS / "troubleshoot-observability/references/specialists.md").read_text("utf-8")
        self.assertIn("Direct telemetry remains the default", selection)
        self.assertIn("Optional existing SRE Agent", selection)
        self.assertIn("Unknown controls leave execution blocked", selection)

    def test_execution_section_exposes_only_the_direct_telemetry_route(self):
        text = (WORKFLOW / "README.md").read_text("utf-8")
        section = text.split("## 2.", 1)[1].split("## 3.", 1)[0]
        self.assertEqual(re.findall(r"\*\*([^*]+):\*\*", section),
                         ["Direct telemetry (default)"])
        self.assertIn("new external-service operations", section)
        self.assertIn("Explicit requests enter review", section)
        self.assertIn("unknown controls block execution", section)

    def test_shared_trace_helper_has_one_owner(self):
        helper = SKILLS / "assess-observability-health/scripts/build_appinsights_trace_link.py"
        self.assertTrue(helper.is_file())
        self.assertEqual(len(list(SKILLS.rglob(helper.name))), 1)
        portal = (WORKFLOW / "references/portal-links.md").read_text("utf-8")
        self.assertIn("portal.azure.com", portal)
        self.assertIn("unverified", portal)

    def test_prometheus_rejects_bad_scope_before_auth(self):
        for kwargs in (
            {"endpoint": "https://example.invalid", "query": "up"},
            {"endpoint": "https://westus.prometheus.monitor.azure.com/a", "query": "up",
             "start": "1", "end": "7201", "step": "60s"},
            {"endpoint": "https://westus.prometheus.monitor.azure.com/a", "query": "up", "timeout": 121},
        ):
            with patch.object(prom, "acquire_token") as auth, self.assertRaises(prom.QueryError):
                prom.execute_query(**kwargs)
            auth.assert_not_called()

    def test_prometheus_malformed_denied_and_oversized_are_not_empty_success(self):
        for raw in (b"[]", b"invalid", b'{"status":"error"}',
                    b'{"status":"success","data":null}',
                    json.dumps({"status": "success", "data": {"result": [{}] * 51}}).encode(),
                    b"x" * (prom.MAX_RESPONSE_BYTES + 1)):
            response = Mock()
            response.read.return_value = raw
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            with patch.object(prom, "acquire_token", return_value="synthetic"), \
                    patch.object(prom.urllib.request, "build_opener") as opener:
                opener.return_value.open.return_value = response
                with self.assertRaises(prom.QueryError):
                    prom.execute_query("https://westus.prometheus.monitor.azure.com/a", "up")
        error = urllib.error.HTTPError("https://example.invalid", 403, "Forbidden", {},
                                       io.BytesIO(b"Bearer synthetic-secret"))
        with patch.object(prom, "acquire_token", return_value="synthetic"), \
                patch.object(prom.urllib.request, "build_opener") as opener:
            opener.return_value.open.side_effect = error
            with self.assertRaises(prom.QueryError) as caught:
                prom.execute_query("https://westus.prometheus.monitor.azure.com/a", "up")
        self.assertIn("403", str(caught.exception))
        self.assertNotIn("synthetic-secret", str(caught.exception))
        self.assertIsNone(prom.NoRedirect().redirect_request(
            None, None, 302, "", {}, "https://else.invalid"))


if __name__ == "__main__":
    unittest.main()
