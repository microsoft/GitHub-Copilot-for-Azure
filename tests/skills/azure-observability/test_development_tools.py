"""Development gate safety without tokenizer tables, installation or network."""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import socket
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from instruction_sources import FIXTURES, SKILLS
from shared_contracts import normalized_shared_markdown


TOOLS = Path(__file__).resolve().parent / "tools"
SPEC = importlib.util.spec_from_file_location("observability_context_budget",
                                            TOOLS / "context_budget.py")
budget = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(budget)


class DevelopmentToolTests(unittest.TestCase):
    def test_synthetic_case_files_stay_outside_payload_with_all_cases_retained(self):
        counts = {
            "assess-observability-health/references/integration-cases.json": 6,
            "connect-observability/references/preflight-cases.json": 3,
            "troubleshoot-observability/references/acceptance.json": 19,
            "troubleshoot-observability/references/intent-cases.json": 24,
            "troubleshoot-observability/references/matching-cases.json": 27,
            "troubleshoot-observability/references/next-action-cases.json": 32,
            "troubleshoot-observability/references/trace-selection-cases.json": 29,
        }
        self.assertEqual({path.relative_to(FIXTURES).as_posix()
                          for path in FIXTURES.rglob("*.json")}, set(counts))
        for relative, count in counts.items():
            with self.subTest(fixture=relative):
                self.assertFalse((SKILLS / relative).exists())
                fixture = json.loads((FIXTURES / relative).read_text("utf-8"))
                provenance = (
                    "Synthetic instruction/host acceptance specification only; "
                    "not executed model or host evidence."
                    if relative.endswith("/next-action-cases.json")
                    else "synthetic-specification-not-host-execution"
                )
                self.assertEqual(fixture["provenance"], provenance)
                self.assertEqual(len(fixture["cases"]), count)
                self.assertEqual(len({case["id"] for case in fixture["cases"]}), count)

    def test_context_root_is_the_plugin_and_entry_gate_is_only_retained_coordinator(self):
        repository = TOOLS.parents[3]
        self.assertEqual(budget.ROOT, repository / "plugins" / "azure-observability")
        self.assertEqual(budget.ENTRY_NAMES, {"troubleshoot-observability"})

    def test_missing_tokenizer_is_a_blocker_not_an_install_or_pass(self):
        output = io.StringIO()
        with patch.object(budget, "tiktoken", None), patch("sys.argv", ["context_budget.py"]):
            with contextlib.redirect_stderr(output):
                self.assertEqual(budget.main(), 2)
        self.assertIn("BLOCKED", output.getvalue())
        self.assertIn("no dependencies were installed", output.getvalue())

    def test_missing_encoding_cache_cannot_open_a_network_socket(self):
        original = socket.socket.connect

        def attempts_network(_):
            with socket.socket() as connection:
                connection.connect(("192.0.2.1", 443))

        tokenizer = SimpleNamespace(get_encoding=attempts_network)
        with patch.object(budget, "tiktoken", tokenizer):
            with self.assertRaisesRegex(RuntimeError, "network is disabled"):
                budget.measure()
        self.assertIs(socket.socket.connect, original)

    def test_missing_encoding_cache_cannot_resolve_dns(self):
        original = socket.getaddrinfo
        tokenizer = SimpleNamespace(
            get_encoding=lambda _: socket.getaddrinfo("example.invalid", 443))
        with patch.object(budget, "tiktoken", tokenizer):
            with self.assertRaisesRegex(RuntimeError, "network is disabled"):
                budget.measure()
        self.assertIs(socket.getaddrinfo, original)

    def test_shared_normalization_allows_rebasing_but_not_drift_or_escaped_targets(self):
        scratch = TOOLS.parent / ".test-work"
        scratch.mkdir(exist_ok=True)
        self.addCleanup(lambda: scratch.rmdir() if scratch.is_dir()
                        and not any(scratch.iterdir()) else None)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            roots = [Path(temporary) / name for name in ("canonical", "derived")]
            for root in roots:
                root.mkdir()
                (root / "next-actions.md").write_text("# Policy\n", encoding="utf-8")
                (root / "specialists.md").write_text(
                    '[Policy](next-actions.md#decision "title")\n', encoding="utf-8")
            source = roots[0] / "specialists.md"
            derived = roots[1] / "specialists.md"
            expected = normalized_shared_markdown(source, roots[0])
            derived.write_text('[Policy](./next-actions.md#decision "title")\n',
                               encoding="utf-8")
            self.assertEqual(normalized_shared_markdown(derived, roots[1]), expected)
            for changed in (
                '[Changed policy](next-actions.md#decision "title")\n',
                '[Policy](next-actions.md#different "title")\n',
                '[Policy](specialists.md#decision "title")\n',
            ):
                derived.write_text(changed, encoding="utf-8")
                self.assertNotEqual(normalized_shared_markdown(derived, roots[1]), expected)
            for invalid in ("../canonical/next-actions.md", "unknown.md"):
                derived.write_text("[Policy](" + invalid + ")\n", encoding="utf-8")
                with self.assertRaises(ValueError):
                    normalized_shared_markdown(derived, roots[1])


if __name__ == "__main__":
    unittest.main()
