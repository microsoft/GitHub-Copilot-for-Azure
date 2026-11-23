"""Run the AzureBench pipeline scripts against a stub msbench-cli.

python -m unittest discover -s pipelines/azurebench -p test_pipeline.py -v
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml
from msbench.cli.arguments import parse_args


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent / "scripts"

# Records its arguments and CAPI environment, then writes a fully resolved report.
STUB = """#!/usr/bin/env bash
printf '%s\\n' "$@" > "$CAPTURE/args.txt"
printf '%s|%s|%s\\n' "${CES_PROXY_BYPASS:-}" "${CAPI_HMAC_KEY:-}" "${GITHUB_COPILOT_INTEGRATION_ID:-}" > "$CAPTURE/env.txt"
if [ "$1" = run ]; then
  echo '{"event": "run_started", "data": {"run_id": "123"}}' > "$RESULTS_DIR/events.jsonl"
  echo '{"requested_instance_count": 1, "summary": {"benchmarks_overview": {"b": {"totals": {"num_passed_cases": 1}}}}}' > "$RESULTS_DIR/report.json"
fi
"""


def load(name):
    return yaml.safe_load((ROOT / "pipelines" / name).read_text(encoding="utf-8"))


class ScriptTestCase(unittest.TestCase):
    def run_script(self, script, *args, **env):
        folder = Path(tempfile.mkdtemp())
        bin_dir = folder / "bin"
        bin_dir.mkdir()
        (bin_dir / "msbench-cli").write_text(STUB, encoding="utf-8", newline="\n")
        python = Path(sys.executable).as_posix()
        (bin_dir / "python3").write_text(f'#!/usr/bin/env bash\nexec "{python}" "$@"\n', encoding="utf-8", newline="\n")
        full = {**os.environ, "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"], "CAPTURE": folder.as_posix(), **env}
        result = subprocess.run(
            ["bash", (SCRIPTS / script).as_posix(), *args], cwd=ROOT, env=full, capture_output=True, text=True
        )
        captured = folder / "args.txt"
        cli_args = captured.read_text(encoding="utf-8").splitlines() if captured.exists() else None
        seen = (folder / "env.txt").read_text(encoding="utf-8").strip() if captured.exists() else None
        return result, cli_args, seen


class EvalTests(ScriptTestCase):
    def eval(self, capi, use_identity, **env):
        results = Path(tempfile.mkdtemp()).as_posix()
        base = dict(
            BENCHMARK="azurebench@1.0.0", MODEL="label", BACKEND="ces-dev1", PACKAGE_DIR="package",
            RESULTS_DIR=results, CAPI=capi, USE_RUN_IDENTITY=use_identity, CES_PROXY_FORCE="true",
            RUN_IDENTITY_CLIENT_ID="client", RUN_IDENTITY_TENANT_ID="tenant", RUN_IDENTITY_SUBSCRIPTION_ID="sub",
        )
        return self.run_script("run-eval.sh", **{**base, **env})

    def test_yaml_is_opt_in_and_uses_our_service_connection(self):
        pipeline = load("azurebench-eval.yml")
        params = {p["name"]: p for p in pipeline["parameters"]}
        self.assertFalse(params["submit"]["default"])
        self.assertFalse(params["authorizeCapi"]["default"])
        self.assertEqual(params["capi"]["values"], ["ours", "msbench"])
        self.assertNotIn("serviceConnection", params)
        variables = {v["name"]: v["value"] for v in pipeline["variables"] if "name" in v}
        self.assertEqual(variables["serviceConnection"], "azurebench_sc")

    def test_msbench_uses_workflow_credentials_with_byoi(self):
        result, args, seen = self.eval("msbench", "True", CAPI_HMAC_KEY="stray", GITHUB_COPILOT_INTEGRATION_ID="stray")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Resolved 1/1", result.stdout)
        parsed = parse_args(args)
        self.assertIsNone(parsed.encrypted_env)
        self.assertEqual(parsed.run_identity_client_id, "client")
        self.assertIn("harbor.keepIdentityForRun=true", args)
        self.assertEqual(seen, "true||")

    def test_ours_passes_secret_names_only_and_rejects_bad_input(self):
        good = dict(GITHUB_COPILOT_INTEGRATION_ID="test-id", CAPI_HMAC_KEY="test-key", CES_PROXY_BYPASS="true")
        for name, value in (("CAPI_HMAC_KEY", ""), ("GITHUB_COPILOT_INTEGRATION_ID", "$(azurebench-capi-id)")):
            result, args, _ = self.eval("ours", "False", **{**good, name: value})
            self.assertEqual(result.returncode, 2)
            self.assertIsNone(args)
        result, args, _ = self.eval("ours", "True", **good)
        self.assertEqual(result.returncode, 2)
        self.assertIn("use CAPI=msbench", result.stderr)
        self.assertIsNone(args)
        result, args, seen = self.eval("ours", "False", **good)
        self.assertEqual(result.returncode, 0, result.stderr)
        parsed = parse_args(args)
        self.assertEqual(parsed.encrypted_env, ["GITHUB_COPILOT_INTEGRATION_ID", "CAPI_HMAC_KEY"])
        self.assertIsNone(parsed.run_identity_client_id)
        self.assertNotIn("test-key", args)
        self.assertEqual(seen, "|test-key|test-id")


class ReleaseTests(ScriptTestCase):
    def release(self, mode, dataset="benchmarks/azurebench/dataset.jsonl"):
        return self.run_script(
            "release.sh", mode, BENCHMARK="azurebench", VERSION="1.0.0",
            METADATA="benchmarks/azurebench/registry.json", DATASET=dataset, PRIVATE="True", BACKEND="ces-dev1",
            SOURCE_REPOSITORY="https://github.com/microsoft/GitHub-Copilot-for-Azure", SOURCE_COMMIT="a" * 40,
        )

    def test_yaml_uses_our_service_connection(self):
        pipeline = load("azurebench-release.yml")
        self.assertNotIn("serviceConnection", {p["name"] for p in pipeline["parameters"]})
        variables = {v["name"]: v["value"] for v in pipeline["variables"] if "name" in v}
        self.assertEqual(variables["serviceConnection"], "azurebench_sc")

    def test_validate_and_publish_arguments(self):
        result, args, _ = self.release("validate")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(args[:4], ["registry", "add", "benchmark", "azurebench@1.0.0"])
        self.assertIn("--validate-only", args)
        self.assertIn("--private", args)
        self.assertNotIn("--management-mode", args)
        result, args, _ = self.release("publish")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("--validate-only", args)
        self.assertEqual(args[args.index("--management-mode") + 1], "self")
        result, args, _ = self.release("upload")
        self.assertEqual(result.returncode, 2)
        self.assertIsNone(args)

    def test_unpushed_pin_stops_before_msbench(self):
        row = json.loads((ROOT / "benchmarks/azurebench/dataset.jsonl").read_text(encoding="utf-8").splitlines()[0])
        row["task_repo_commit"] = "0" * 40
        dataset = Path(tempfile.mkdtemp()) / "dataset.jsonl"
        dataset.write_text(json.dumps(row) + "\n", encoding="utf-8")
        result, args, _ = self.release("validate", dataset.as_posix())
        self.assertEqual(result.returncode, 1)
        self.assertIn("is not pushed", result.stdout)
        self.assertIsNone(args)


if __name__ == "__main__":
    unittest.main()