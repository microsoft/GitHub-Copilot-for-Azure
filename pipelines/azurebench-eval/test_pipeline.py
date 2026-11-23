import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml
from msbench.cli.arguments import parse_args


ROOT = Path(__file__).resolve().parents[2]
PIPELINE = ROOT / "pipelines" / "azurebench-eval.yml"
KEYVAULT = "${{ if eq(parameters.capiCredentials, 'keyVault') }}"


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
        cls.keyvault = next(step[KEYVAULT] for step in cls.submit_steps if KEYVAULT in step)[0]
        cls.azure = next(step for step in cls.submit_steps if step.get("task") == "AzureCLI@2")
        cls.all_steps = steps

    def test_submission_and_secret_access_are_opt_in(self):
        self.assertFalse(self.parameters["submit"]["default"])
        self.assertFalse(self.parameters["authorizeCapi"]["default"])
        self.assertEqual(self.parameters["capiCredentials"]["default"], "autodev-test")
        self.assertEqual(self.keyvault["task"], "AzureKeyVault@2")
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
                KEYVAULT: {
                    "GITHUB_COPILOT_INTEGRATION_ID": "$(${{ parameters.capiIdSecret }})",
                    "CAPI_HMAC_KEY": "$(${{ parameters.capiHmacSecret }})",
                }
            },
        )

    def run_script(self, credentials, use_identity, env_overrides):
        script = self.azure["inputs"]["inlineScript"]
        replacements = {
            "capiCredentials": credentials,
            "useRunIdentity": use_identity,
            "benchmark": "azurebench@1.0.0",
            "model": "label",
            "backend": "ces-dev1",
        }
        for key, value in replacements.items():
            script = script.replace("${{ parameters." + key + " }}", value)
        script = script.replace("$(packageDir)", "package").replace("$(resultsDir)", "results")
        self.assertNotRegex(script, r"\$\{\{")
        stub = (
            'msbench-cli() { printf "%s\\n" "$@" > "$CAPTURE_PATH"; '
            'printf "%s|%s|%s\\n" "${CES_PROXY_BYPASS:-}" "${CAPI_HMAC_KEY:-}" '
            '"${GITHUB_COPILOT_INTEGRATION_ID:-}" > "$CAPTURE_PATH.env"; }\n'
            "python3() { cat >/dev/null; }\n"
        )
        folder = tempfile.mkdtemp()
        capture = Path(folder) / "args.txt"
        env = os.environ.copy()
        env.update(
            CAPTURE_PATH=capture.as_posix(),
            RUN_IDENTITY_CLIENT_ID="client",
            RUN_IDENTITY_TENANT_ID="tenant",
            RUN_IDENTITY_SUBSCRIPTION_ID="subscription",
            CES_PROXY_FORCE="true",
        )
        env.update(env_overrides)
        result = subprocess.run(["bash", "-c", stub + script], cwd=folder, env=env, capture_output=True, text=True)
        args = capture.read_text(encoding="utf-8").splitlines() if capture.exists() else None
        seen = Path(str(capture) + ".env").read_text(encoding="utf-8").strip() if capture.exists() else None
        return result, args, seen

    def test_autodev_test_uses_workflow_credentials_with_byoi(self):
        result, args, seen = self.run_script(
            "autodev-test", "True", {"CAPI_HMAC_KEY": "stray", "GITHUB_COPILOT_INTEGRATION_ID": "stray"}
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        parsed = parse_args(args)
        self.assertIsNone(parsed.encrypted_env)
        self.assertEqual(parsed.run_identity_client_id, "client")
        self.assertIn("harbor.keepIdentityForRun=true", args)
        self.assertEqual(seen, "true||")

    def test_keyvault_blocks_missing_credentials_and_passes_names_only(self):
        good = {"GITHUB_COPILOT_INTEGRATION_ID": "test-id", "CAPI_HMAC_KEY": "test-key", "CES_PROXY_BYPASS": "true"}
        for name, value in (("CAPI_HMAC_KEY", ""), ("GITHUB_COPILOT_INTEGRATION_ID", "$(missing)")):
            result, args, _ = self.run_script("keyVault", "False", {**good, name: value})
            self.assertNotEqual(result.returncode, 0)
            self.assertIsNone(args)
        result, args, _ = self.run_script("keyVault", "True", good)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot be used with BYOI", result.stderr)
        self.assertIsNone(args)
        result, args, seen = self.run_script("keyVault", "False", good)
        self.assertEqual(result.returncode, 0, result.stderr)
        parsed = parse_args(args)
        self.assertEqual(parsed.encrypted_env, ["GITHUB_COPILOT_INTEGRATION_ID", "CAPI_HMAC_KEY"])
        self.assertIsNone(parsed.run_identity_client_id)
        self.assertNotIn("test-id", args)
        self.assertNotIn("test-key", args)
        self.assertEqual(seen, "|test-key|test-id")


if __name__ == "__main__":
    unittest.main()