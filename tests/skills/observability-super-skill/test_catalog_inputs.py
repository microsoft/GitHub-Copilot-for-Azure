"""Offline reviewed catalog input and wrapper tests; no service access."""

from contextlib import redirect_stderr, redirect_stdout
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SCRIPTS = ROOT / "skills" / "troubleshoot-observability" / "references" / "microsoft-foundry" / "foundry-agent" / "toolbox" / "scripts"
SPEC = importlib.util.spec_from_file_location("catalog_inputs", SCRIPTS / "get_catalog_inputs.py")
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


def fixture():
    return {
        "schema_version": 1, "coverage": "complete",
        "entries": [
            {"name": "managed-example", "toolEntityId": "reviewed-managed-id",
             "serverUrl": "https://example.invalid/mcp", "managedOAuth": True,
             "connectorName": "reviewed-connector", "userEntraToken": False, "scopes": []},
            {"name": "entra-example", "toolEntityId": "reviewed-entra-id",
             "serverUrl": "https://example.invalid/mcp?api-version=v1",
             "managedOAuth": False, "userEntraToken": True,
             "audience": "https://example.invalid", "scopes": ["reviewed-scope"]},
        ],
    }


class CatalogInputTests(unittest.TestCase):
    def setUp(self):
        scratch = Path(__file__).resolve().parent / ".test-work"
        scratch.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(self.temp.cleanup)
        self.input = Path(self.temp.name) / "reviewed.json"
        self.input.write_text(json.dumps(fixture()), encoding="utf-8")

    def write(self, value):
        self.input.write_text(json.dumps(value), encoding="utf-8")

    def run_main(self, *arguments):
        output, errors = io.StringIO(), io.StringIO()
        with redirect_stdout(output), redirect_stderr(errors):
            result = catalog.main(list(arguments))
        return result, output.getvalue(), errors.getvalue()

    def test_valid_inputs_preserve_cli_fields_and_do_not_claim_availability(self):
        value = catalog.read_inputs(self.input)
        result = catalog.select_inputs(value, auth_filter="managedOAuth")
        self.assertEqual(result["entries"], [fixture()["entries"][0]])
        self.assertEqual(result["status"], "reviewed-inputs")
        self.assertEqual(result["availability"], "unverified")
        result = catalog.select_inputs(value, "ENTRA", "userEntraToken")
        self.assertEqual(result["entries"][0]["audience"], "https://example.invalid")

    def test_missing_review_flag_stops_before_file_read(self):
        with patch.object(catalog, "read_inputs") as read:
            with self.assertRaises(SystemExit) as error, redirect_stderr(io.StringIO()):
                catalog.main(["--input-file", str(self.input)])
            self.assertEqual(error.exception.code, 2)
            read.assert_not_called()

    def test_partial_coverage_remains_explicit_with_warning(self):
        value = fixture()
        value["coverage"] = "partial"
        self.write(value)
        code, output, errors = self.run_main("--input-file", str(self.input), "--reviewed-inputs")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output)["status"], "partial-reviewed-inputs")
        self.assertIn("partial reviewed input scope", errors)

    def test_no_match_and_false_support_are_not_incompatibility_or_success(self):
        for arguments in (("--name", "missing"), ("--name", "entra", "--managed-oauth")):
            code, output, errors = self.run_main(
                "--input-file", str(self.input), "--reviewed-inputs", *arguments)
            self.assertEqual(code, 2)
            self.assertEqual(output, "")
            self.assertIn("does not prove incompatibility", errors)

    def test_invalid_and_secret_bearing_entries_are_rejected_without_raw_echo(self):
        patches = (
            {"managedOAuth": "true"}, {"userEntraToken": None},
            {"connectorName": ""}, {"serverUrl": "http://example.invalid"},
            {"serverUrl": "https://secret@example.invalid/mcp"},
            {"serverUrl": "https://example.invalid/mcp?token=synthetic-secret"},
            {"serverUrl": "https://example.invalid/mcp#fragment"},
            {"scopes": "not-a-list"}, {"scopes": [None]},
            {"name": "\nunsafe"}, {"credentials": "synthetic-secret"},
        )
        for patch in patches:
            value = fixture()
            value["entries"][0].update(patch)
            self.write(value)
            with self.subTest(patch=patch):
                code, output, errors = self.run_main(
                    "--input-file", str(self.input), "--reviewed-inputs")
                self.assertEqual(code, 2)
                self.assertEqual(output, "")
                self.assertNotIn("synthetic-secret", errors)

    def test_missing_auth_metadata_is_never_inferred(self):
        value = fixture()
        del value["entries"][1]["audience"]
        self.write(value)
        with self.assertRaisesRegex(catalog.InputError, "audience"):
            catalog.read_inputs(self.input)
        value = fixture()
        del value["entries"][0]["connectorName"]
        self.write(value)
        with self.assertRaisesRegex(catalog.InputError, "connectorName"):
            catalog.read_inputs(self.input)

    def test_duplicate_records_and_fields_fail_explicitly(self):
        value = fixture()
        value["entries"].append(copy.deepcopy(value["entries"][0]))
        self.write(value)
        with self.assertRaisesRegex(catalog.InputError, "Duplicate entry name"):
            catalog.read_inputs(self.input)
        self.input.write_text('{"schema_version":1,"schema_version":1}', encoding="utf-8")
        with self.assertRaisesRegex(catalog.InputError, "Duplicate JSON field"):
            catalog.read_inputs(self.input)

    def test_missing_empty_malformed_and_oversized_inputs_are_distinct_blockers(self):
        with self.assertRaisesRegex(catalog.InputError, "Cannot read"):
            catalog.read_inputs(self.input.parent / "missing.json")
        for raw in (b"not-json", b"\xff"):
            self.input.write_bytes(raw)
            with self.assertRaisesRegex(catalog.InputError, "valid UTF-8 JSON"):
                catalog.read_inputs(self.input)
        for patch in ({"entries": []}, {"entries": fixture()["entries"] * 51},
                      {"coverage": "unknown"}, {"schema_version": True},
                      {"raw_response": "synthetic-secret"}):
            value = fixture()
            value.update(patch)
            self.write(value)
            with self.subTest(patch=patch), self.assertRaises(catalog.InputError):
                catalog.read_inputs(self.input)
        self.input.write_bytes(b"x" * (catalog.MAX_BYTES + 1))
        with self.assertRaisesRegex(catalog.InputError, "1 MiB"):
            catalog.read_inputs(self.input)

    def test_success_has_no_input_mutation_or_artifacts(self):
        before = self.input.read_bytes()
        code, output, errors = self.run_main(
            "--input-file", str(self.input), "--reviewed-inputs", "--managed-oauth")
        self.assertEqual(code, 0)
        self.assertEqual(errors, "")
        self.assertEqual(json.loads(output)["entries"][0]["connectorName"], "reviewed-connector")
        self.assertEqual(self.input.read_bytes(), before)
        self.assertEqual(list(self.input.parent.iterdir()), [self.input])

    def test_wrappers_require_explicit_interpreter_and_do_not_fetch(self):
        for name in ("get-catalog-inputs.ps1", "get-catalog-inputs.sh"):
            text = (SCRIPTS / name).read_text("utf-8")
            self.assertIn("get_catalog_inputs.py", text)
            self.assertNotIn("get-access-token", text)
            self.assertNotIn("Invoke-WebRequest", text)
            self.assertNotIn("curl ", text)

    def test_catalog_discovery_is_operation_gated_without_blocking_generic_tasks(self):
        base = SCRIPTS.parent.parent
        paths = [
            base / "toolbox" / "toolbox.md",
            base / "create" / "references" / "foundry-tool-catalog.md",
            base / "toolbox" / "references" / "tool-mcp-managed-oauth.md",
            base / "toolbox" / "references" / "tool-mcp-user-entra-token.md",
        ]
        for path in paths:
            text = " ".join(path.read_text("utf-8").split())
            with self.subTest(path=path):
                for phrase in ("reviewed inputs", "supported catalog capability",
                               "unverified", "not", "default"):
                    self.assertIn(phrase, text)
                self.assertNotIn("Only the MCP tiles this query returns", text)
                self.assertNotIn("If the tile is not in this list", text)
        toolbox = paths[0].read_text("utf-8")
        self.assertIn("generic MCP/OpenAPI tasks", toolbox)
        self.assertIn("Do not substitute another API or invent a discovery operation", toolbox)

    def test_powershell_wrapper_success_and_missing_review_stop(self):
        powershell = shutil.which("powershell") or shutil.which("pwsh")
        if not powershell:
            self.skipTest("No installed PowerShell runtime.")
        command = [powershell, "-NoProfile", "-NonInteractive", "-File",
                   str(SCRIPTS / "get-catalog-inputs.ps1"),
                   "-PythonExecutable", sys.executable, "-InputFile", str(self.input),
                   "-ManagedOAuth"]
        denied = subprocess.run(command, capture_output=True, text=True, timeout=30)
        if denied.returncode == 1 and "running scripts is disabled" in denied.stderr:
            self.skipTest("PowerShell wrapper execution blocked by host script policy; no policy change attempted.")
        self.assertEqual(denied.returncode, 2)
        self.assertEqual(denied.stdout, "")
        self.assertIn("-ReviewedInputs", denied.stderr)
        result = subprocess.run(command + ["-ReviewedInputs"], capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["entries"], [fixture()["entries"][0]])

    def test_powershell_wrapper_syntax_without_execution_policy_changes(self):
        powershell = shutil.which("powershell") or shutil.which("pwsh")
        if not powershell:
            self.skipTest("No installed PowerShell parser.")
        path = str(SCRIPTS / "get-catalog-inputs.ps1").replace("'", "''")
        code = ("$tokens=$null; $errors=$null; "
                "[System.Management.Automation.Language.Parser]::ParseFile("
                f"'{path}', [ref]$tokens, [ref]$errors) | Out-Null; "
                "if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }")
        result = subprocess.run([powershell, "-NoProfile", "-NonInteractive", "-Command", code],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_bash_wrapper_success_and_missing_review_stop(self):
        candidates = [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "bin" / "bash.exe"]
        bash = next((str(path) for path in candidates if path.is_file()), None) or shutil.which("bash")
        if not bash:
            self.skipTest("No installed Bash runtime.")
        command = [bash, str(SCRIPTS / "get-catalog-inputs.sh").replace("\\", "/"),
                   "--python", sys.executable.replace("\\", "/"),
                   "--input-file", str(self.input).replace("\\", "/"), "--user-entra-token"]
        denied = subprocess.run(command, capture_output=True, text=True, timeout=30)
        self.assertEqual(denied.returncode, 2)
        self.assertEqual(denied.stdout, "")
        self.assertIn("--reviewed-inputs", denied.stderr)
        result = subprocess.run(command + ["--reviewed-inputs"], capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["entries"], [fixture()["entries"][1]])


if __name__ == "__main__":
    unittest.main()
