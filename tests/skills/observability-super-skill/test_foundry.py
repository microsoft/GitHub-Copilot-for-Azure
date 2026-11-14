"""Offline vendoring and instruction contracts, not live/model-routing tests."""

import ast
from collections import Counter
import hashlib
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "troubleshoot-observability" / "references" / "microsoft-foundry"
PIN = "fbda857c484a85c7ce644f56809b7f204471fb69"
LOCAL = {"LICENSE.md", "references/provenance.md", "references/execution-boundaries.md"}
LOCAL.add("foundry-agent/toolbox/scripts/get_catalog_inputs.py")
ADAPTED = {
    "SKILL.md",
    "references/agent-metadata-contract.md",
    "foundry-agent/azd-guidance/azd-guidance.md",
    "foundry-agent/create/references/local-run.md",
    "foundry-agent/create/references/voice-agent-hosted-bridge.md",
    "foundry-agent/insights/insights.md",
    "foundry-agent/trace/trace.md",
    "foundry-agent/trace/references/search-traces.md",
    "foundry-agent/trace/references/analyze-failures.md",
    "foundry-agent/trace/references/analyze-latency.md",
    "foundry-agent/trace/references/conversation-detail.md",
    "foundry-agent/trace/references/eval-correlation.md",
    "foundry-agent/trace/references/kql-templates.md",
    "foundry-agent/troubleshoot/troubleshoot.md",
    "foundry-agent/observe/observe.md",
    "foundry-agent/observe/references/analyze-results.md",
    "foundry-agent/observe/references/deploy-and-setup.md",
    "foundry-agent/observe/references/evaluate-step.md",
    "foundry-agent/observe/references/evaluation-suite-generation.md",
    "foundry-agent/observe/references/compare-iterate.md",
    "foundry-agent/observe/references/optimize-deploy.md",
    "foundry-agent/observe/references/cicd-monitoring.md",
    "foundry-agent/observe/references/continuous-eval.md",
    "models/deploy-model/preset/references/workflow.md",
    "models/deploy-model/preset/SKILL.md",
    "foundry-agent/create/references/foundry-tool-catalog.md",
    "foundry-agent/toolbox/references/test-endpoint.md",
    "foundry-agent/toolbox/references/tool-tool-search.md",
    "foundry-agent/toolbox/toolbox.md",
    "foundry-agent/toolbox/references/tool-mcp-managed-oauth.md",
    "foundry-agent/toolbox/references/tool-mcp-user-entra-token.md",
    "foundry-agent/toolbox/scripts/get-catalog-inputs.ps1",
    "foundry-agent/toolbox/scripts/get-catalog-inputs.sh",
}


def text(relative):
    return (SKILL / relative).read_text(encoding="utf-8-sig")


def files():
    return sorted(
        (p for p in SKILL.rglob("*") if p.is_file()),
        key=lambda p: p.relative_to(SKILL).as_posix().casefold(),
    )


def digest(paths, include_content=True):
    result = hashlib.sha256()
    for path in paths:
        result.update(path.relative_to(SKILL).as_posix().encode() + b"\0")
        if include_content:
            result.update(path.read_bytes().replace(b"\r\n", b"\n") + b"\0")
    return result.hexdigest()


def relative_links(content):
    """Extract inline Markdown links; external URLs and anchors are not assets."""
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", content):
        target = target.split(' "')[0]
        parsed = urlsplit(target)
        if not parsed.scheme and not target.startswith("#"):
            yield unquote(parsed.path)


def link_problem(parent, target, root=SKILL):
    resolved = (parent / target).resolve()
    shared = {
        (ROOT / "skills/troubleshoot-observability/references" / name).resolve()
        for name in ("trace-capabilities.md", "next-actions.md", "specialists.md")
    }
    if not resolved.is_relative_to(root.resolve()) and resolved not in shared:
        return "outside skill"
    if not resolved.exists():
        return "missing resource"
    return None


class FoundryIntegrityTests(unittest.TestCase):
    def test_neutral_tool_search_example_preserves_configuration_and_denial_safety(self):
        example = text("foundry-agent/toolbox/references/tool-tool-search.md")
        for phrase in ('"server_url": "https://example.invalid/sse"',
                       '"execute_query": { "pin": true', '"tool_configs"'):
            self.assertIn(phrase, example)
        consent = text("foundry-agent/create/references/foundry-tool-catalog.md")
        for phrase in ("Connected", "tools/list", "authorization failure",
                       "do not change identity", "retry denial automatically"):
            self.assertIn(phrase, consent)
        endpoint = text("foundry-agent/toolbox/references/test-endpoint.md")
        self.assertIn("#runtime-authorization-is-separate-from-consent", endpoint)

    def test_complete_upstream_inventory(self):
        upstream = [p for p in files() if p.relative_to(SKILL).as_posix() not in LOCAL]
        self.assertEqual(len(upstream), 221)
        self.assertEqual(
            digest(upstream, include_content=False),
            "5cec2df09ccaa7567b5b1dc258646b07f3e41d1e3b831c48328cbeea5cdcd958",
        )
        self.assertEqual(len(files()), 225)
        self.assertEqual(
            Counter(p.suffix for p in files()),
            {".md": 183, ".py": 18, ".ps1": 9, ".sh": 9, ".json": 2,
             ".yaml": 1, ".tpl": 1, ".bicep": 1, "": 1},
        )
        self.assertEqual((SKILL / ".gitignore").read_bytes(), b"")

    def test_unadapted_resources_unchanged(self):
        unchanged = [
            p for p in files()
            if p.relative_to(SKILL).as_posix() not in LOCAL | ADAPTED
        ]
        self.assertEqual(len(unchanged), 188)
        self.assertEqual(
            digest(unchanged),
            "a0fb3f9a3a648e2a0d8793890d06bb0c48be42a16dc1ccec9438f129d645fa6f",
        )

    def test_33_upstream_scripts_unchanged_without_execution(self):
        scripts = [p for p in files() if p.suffix in {".py", ".ps1", ".sh"}
                   and p.relative_to(SKILL).as_posix() not in LOCAL | ADAPTED]
        self.assertEqual(len(scripts), 33)
        self.assertEqual(
            digest(scripts),
            "d4e370001e74cc1ed0fd75c3af818f2d82f8b14b93a42664cdfc06bf34dc005b",
        )

    def test_exact_mit_notice(self):
        self.assertEqual(
            hashlib.sha256((SKILL / "LICENSE.md").read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
            "8a5d8efb70942e65032f930c761d097feeb41a7517ebd04c9d2e4ec3764071c5",
        )

    def test_provenance_records_every_adaptation_and_pin(self):
        provenance = text("references/provenance.md")
        self.assertIn(PIN, provenance)
        self.assertEqual(len(ADAPTED), 33)
        for name in ADAPTED:
            with self.subTest(path=name):
                self.assertIn(f"`{name}`", provenance)
                self.assertTrue((SKILL / name).is_file())
        self.assertIn("33 upstream scripts remain byte-identical", provenance)

    def test_every_relative_markdown_link_is_local_and_exists(self):
        for path in files():
            if path.suffix != ".md":
                continue
            for target in relative_links(path.read_text(encoding="utf-8-sig")):
                with self.subTest(file=path.relative_to(SKILL), target=target):
                    self.assertIsNone(link_problem(path.parent, target))

    def test_link_audit_rejects_missing_and_outside_resources(self):
        self.assertEqual(link_problem(SKILL, "missing-guide.md"), "missing resource")
        self.assertEqual(link_problem(SKILL, "../azure-diagnostics/SKILL.md"), "outside skill")
        self.assertEqual(link_problem(SKILL, "%2e%2e/missing"), "missing resource")
        targets = list(relative_links("[bad](%2e%2e/outside.md) [ok](https://example.test/a)"))
        self.assertEqual(targets, ["../outside.md"])
        self.assertEqual(link_problem(SKILL, targets[0]), "outside skill")

    def test_python_local_common_dependencies_are_present(self):
        count = 0
        for path in files():
            if path.suffix != ".py":
                continue
            tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module == "common":
                    count += 1
                    self.assertTrue((path.parent / "common.py").is_file(), path)
        self.assertGreater(count, 5)

    def test_voice_wrappers_have_their_real_bundled_python_target(self):
        base = "foundry-agent/create/scripts/"
        self.assertTrue((SKILL / base / "smoke_test_voice.py").is_file())
        for name in ("smoke-test-voice.ps1", "smoke-test-voice.sh"):
            self.assertIn("smoke_test_voice.py", text(base + name))

    def test_absent_optional_dependencies_are_explicit_not_stubbed(self):
        self.assertFalse(any(SKILL.rglob("generate_deployment_name.sh")))
        workflow = text("models/deploy-model/preset/references/workflow.md")
        self.assertIn("automatic deployment-name generation is unavailable", workflow)
        self.assertNotIn("DEPLOYMENT_NAME=$(bash", workflow)
        self.assertFalse(any(SKILL.rglob("smoke_test.py")))
        for name in ("local-run.md", "voice-agent-hosted-bridge.md"):
            body = text("foundry-agent/create/references/" + name)
            self.assertIn("sample", body)
            self.assertIn("execution-boundaries.md", body)


class FoundryApprovalContractTests(unittest.TestCase):
    def test_entry_is_evidence_first_and_has_no_onload_setup(self):
        entry = text("SKILL.md")
        self.assertTrue(entry.startswith("---\nname: microsoft-foundry\n"))
        self.assertIn("supplied sanitized evidence", entry)
        self.assertIn("without tools", entry)
        self.assertIn("No dependency check or setup script runs on load", entry)
        self.assertNotIn("As the first step after this skill loads, run", entry)
        self.assertIn("coordinator's confirmed", entry)
        self.assertIn("INCONCLUSIVE", entry)
        self.assertIn("operation-specific approval", entry)

    def test_direct_workflow_resources_have_nearby_supersession(self):
        paths = {
            p for p in ADAPTED
            if p.startswith(("foundry-agent/trace/", "foundry-agent/observe/"))
        }
        paths |= {
            "foundry-agent/troubleshoot/troubleshoot.md",
            "foundry-agent/azd-guidance/azd-guidance.md",
            "foundry-agent/insights/insights.md",
            "references/agent-metadata-contract.md",
        }
        for name in paths:
            with self.subTest(path=name):
                self.assertIn("execution-boundaries.md", text(name)[:1600])

    def test_boundary_distinguishes_every_failure_and_approval_class(self):
        body = text("references/execution-boundaries.md")
        for term in (
            "unsupported", "missing", "denied", "empty", "stale", "throttled",
            "failed", "truncated", "partial", "INCONCLUSIVE",
            "sensitive-content access approval", "cost/budget approval",
            "persistence/edit approval", "local edit approval",
            "No automatic/background polling", "No `--follow`",
            "never authority to execute commands",
        ):
            with self.subTest(term=term):
                self.assertIn(term, body)

    def test_query_schema_and_field_provenance_contract(self):
        body = " ".join(text("references/execution-boundaries.md").split())
        for term in (
            "`resource-id`, `table`, and `query`", "Workspace queries",
            "schema metadata", "exact UTC window", "duration units",
            "`requests`", "`dependencies`", "`customDimensions`",
            "`AppRequests`", "`Properties`", "`TimeGenerated`",
            "actual observed", "De-duplicate", "not proof of agent",
            "not a universal mapping", "Missing GenAI attributes remain missing",
        ):
            with self.subTest(term=term):
                self.assertIn(term, body)

    def test_hosted_correlation_keeps_nested_spans(self):
        for name in ("analyze-failures.md", "analyze-latency.md"):
            body = text("foundry-agent/trace/references/" + name)
            self.assertIn("| distinct operation_Id;", body)
            self.assertIn("| where operation_Id in (reqIds)", body)
            self.assertNotIn("| where operation_ParentId in (reqIds)", body)
        self.assertIn("not end-to-end latency", text("foundry-agent/trace/references/analyze-latency.md"))

    def test_sensitive_content_examples_are_gated(self):
        for name in (
            "conversation-detail.md", "eval-correlation.md", "kql-templates.md",
            "analyze-failures.md",
        ):
            body = text("foundry-agent/trace/references/" + name)
            with self.subTest(path=name):
                self.assertIn("sensitive-content", body[:1500])
        self.assertIn(
            "sensitive-content", text("foundry-agent/observe/references/analyze-results.md")[:1500]
        )
        self.assertIn("includeDetails: true", text("foundry-agent/insights/insights.md")[:1200])

    def test_existing_eval_review_does_not_require_new_jobs_or_cache(self):
        body = text("foundry-agent/observe/references/analyze-results.md")
        for term in (
            "in memory", "no azd", "metadata alone", "separate sensitive-content",
            "Null/missing scores stay unknown", "then stop",
        ):
            with self.subTest(term=term):
                self.assertIn(term.casefold(), body.casefold())
        boundary = text("references/execution-boundaries.md")
        self.assertIn("comparison job is a new job, not a read", boundary)
        self.assertIn("do not establish production recovery or causation", boundary)

    def test_runtime_triage_never_creates_a_session_or_follows(self):
        body = text("foundry-agent/troubleshoot/troubleshoot.md")
        self.assertIn("Never invoke an agent, create a session or use `--follow`", body)
        self.assertNotIn("monitor --session-id <session-id> --follow", body)
        self.assertIn("report missing session evidence", body)
        self.assertNotIn('Use `* contains', body)

    def test_verification_claims_are_offline_only(self):
        body = text("references/provenance.md")
        self.assertIn("not model-routing tests", body)
        self.assertIn("No Azure operation", body)
        self.assertIn("not asserted to be live-tested", body)

    def test_data_viewer_template_is_inert_and_optional(self):
        template = (
            "vscode://ms-windows-ai-studio.windows-ai-studio/"
            "open_data_viewer?file=<file_path>&source=microsoft-foundry-skill"
        )
        for name in (
            "foundry-agent/observe/observe.md",
            "foundry-agent/observe/references/analyze-results.md",
        ):
            body = " ".join(text(name).replace("\n>", " ").split())
            with self.subTest(path=name):
                self.assertIn(f"`{template}`", body)
                self.assertNotRegex(body, r"\]\(vscode://")
                for term in (
                    "already-saved sanitized local artifacts",
                    "compatible VS Code host", "existing Microsoft AI Toolkit",
                    "Confirm host support and user intent",
                    "Do not install an extension, launch a handler",
                    "No Copilot CLI deep-link compatibility is claimed",
                ):
                    self.assertIn(term, body)
        provenance = text("references/provenance.md")
        self.assertIn("Data Viewer templates require", provenance)
        self.assertIn("not executable placeholder URI hyperlinks", provenance)


if __name__ == "__main__":
    unittest.main()
