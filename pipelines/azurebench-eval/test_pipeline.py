import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml
from msbench.cli.arguments import parse_args


ROOT = Path(__file__).resolve().parents[2]
PIPELINE = ROOT / "pipelines" / "azurebench-eval.yml"


class EvalPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pipeline = yaml.safe_load(PIPELINE.read_text(encoding="utf-8"))
        cls.parameters = {p["name"]: p for p in pipeline["parameters"]}
        steps = pipeline["jobs"][0]["steps"]
        allowed = "${{ if and(eq(parameters.submit, true), eq(parameters.authorizeCapi, true)) }}"
        denied = "${{ if and(eq(parameters.submit, true), eq(parameters.authorizeCapi, false)) }}"
        cls.submit_steps = next(step[allowed] for step in steps if allowed in step)
        cls.denied_steps = next(step[denied] for step in steps if denied in step)
        cls.keyvault = next(step for step in cls.submit_steps if step.get("task") == "AzureKeyVault@2")
        cls.azure = next(step for step in cls.submit_steps if step.get("task") == "AzureCLI@2")
        cls.all_steps = steps

    def test_submission_and_secret_access_are_opt_in(self):
        self.assertFalse(self.parameters["submit"]["default"])
        self.assertFalse(self.parameters["authorizeCapi"]["default"])
        self.assertEqual(self.keyvault["inputs"]["RunAsPreJob"], False)
        self.assertEqual(
            self.keyvault["inputs"]["SecretsFilter"],
            "${{ parameters.capiIdSecret }},${{ parameters.capiHmacSecret }}",
        )
        self.assertIn("exit 1", self.denied_steps[0]["script"])
        self.assertFalse(any(step.get("task") in ("AzureKeyVault@2", "AzureCLI@2") for step in self.all_steps))
        self.assertEqual(
            self.azure["env"],
            {
                "GITHUB_COPILOT_INTEGRATION_ID": "$(${{ parameters.capiIdSecret }})",
                "CAPI_HMAC_KEY": "$(${{ parameters.capiHmacSecret }})",
            },
        )

    def test_shell_blocks_missing_credentials_and_passes_names_only(self):
        script = self.azure["inputs"]["inlineScript"]
        replacements = {
            "useRunIdentity": "False",
            "benchmark": "azurebench@1.0.0",
            "model": "label",
            "backend": "ces-dev1",
        }
        for key, value in replacements.items():
            script = script.replace("${{ parameters." + key + " }}", value)
        script = script.replace("$(packageDir)", "package").replace("$(resultsDir)", "results")
        self.assertNotRegex(script, r"\$\{\{")
        stub = (
            'msbench-cli() { [ -z "${CES_PROXY_BYPASS:-}" ] || return 1; printf "%s\\n" "$@" > "$CAPTURE_PATH"; }\n'
            "python3() { cat >/dev/null; }\n"
        )
        with tempfile.TemporaryDirectory() as folder:
            capture = Path(folder) / "args.txt"
            env = os.environ.copy()
            env["CAPTURE_PATH"] = capture.as_posix()
            env["GITHUB_COPILOT_INTEGRATION_ID"] = "test-id"
            env["CAPI_HMAC_KEY"] = "test-key"
            env["CES_PROXY_BYPASS"] = "true"
            for name, value in (("CAPI_HMAC_KEY", ""), ("GITHUB_COPILOT_INTEGRATION_ID", "$(missing)")):
                invalid = env.copy()
                invalid[name] = value
                result = subprocess.run(
                    ["bash", "-c", stub + script], cwd=folder, env=invalid, capture_output=True, text=True
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(capture.exists())
            result = subprocess.run(
                ["bash", "-c", stub + script], cwd=folder, env=env, capture_output=True, text=True
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            args = capture.read_text(encoding="utf-8").splitlines()
            parsed = parse_args(args)
            self.assertEqual(parsed.encrypted_env, ["GITHUB_COPILOT_INTEGRATION_ID", "CAPI_HMAC_KEY"])
            self.assertNotIn("test-id", args)
            self.assertNotIn("test-key", args)


if __name__ == "__main__":
    unittest.main()
