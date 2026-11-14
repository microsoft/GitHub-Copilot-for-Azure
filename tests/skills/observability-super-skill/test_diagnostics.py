"""Offline asset/wording contracts, not model-routing or live-execution tests."""

import hashlib
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[3] / "plugins" / "observability-super-skill"
SKILL = ROOT / "skills" / "troubleshoot-observability" / "references" / "azure-diagnostics"
PIN = "fbda857c484a85c7ce644f56809b7f204471fb69"

# SHA-256 of every pinned upstream file, normalized only for checkout line endings.
UPSTREAM = {
    "references/app-service/README.md": "cf43af284241ce4bae6dcbc1c646cd35f2ce049620da26d209c38a7ca37e1388",
    "references/azure-resource-graph.md": "cd7cf01f8f74983a38e24f8bb20cb8f492f682319a56ac73cdc8647ddf550491",
    "references/container-apps/README.md": "84e55cea1303be8300109c0d0cd95fe479a981f052921f8403ae933f32e12437",
    "references/functions/durable.md": "9d43d0b29c17cca92635ccd6cb5f29eca5fc95eda9cf4dffc42f7585a4925d8a",
    "references/functions/README.md": "68e9d73865fd465b5cfd7b9e86127675a92721779283d5539ea914fe032945de",
    "references/functions/triggers.md": "5048d2e47072c808228cf38354d00369e7a3714e5f7ae2e5a1c3fd0294709793",
    "references/kql-queries.md": "3a784ff92bb90e0967c0c40dc0ce4daed8b664ceb1f014bd7a70d8c2926cc8a3",
    "scripts/aks-baseline.ps1": "f61e3158363103a2e5912f2cab4d27e93e830c89f7e5b2f27920f6b242673fb5",
    "scripts/aks-baseline.sh": "2772e90323cab531203726b5a9af6829930986bfd6248ac1aa27403ade70f228",
    "scripts/appservice-diagnostics.ps1": "1fcc0d0b07ecace5d28a50213d76fab23c701933c05a07d1b97891c5bce2baa6",
    "scripts/appservice-diagnostics.sh": "210e25beeaf94116a7829654782206d5cea7e7f0dd97e5869c171851e71051fc",
    "scripts/containerapp-diagnostics.ps1": "f01c4a47de3c01d2d616d7521a5e26df0cc95f155c93bbec465cd82d792fe910",
    "scripts/containerapp-diagnostics.sh": "f393206b606e0d5d5eb4e6505393dd9e8c0463adf6b1693d47dd750ff7179e80",
    "scripts/pod-evidence.ps1": "ec95c20067b66df2dae73ceed09d561e089b0b0b09fa3f6172836b8c3fc2ec27",
    "scripts/pod-evidence.sh": "cb6bbea2957017f1815a87f90f896dcbdcc3aec538097958242752724bf1fefb",
    "scripts/run-ig.ps1": "044c1311c7be68ff990e978c8a6a34c79ba0b8dc0720f14a0570193150ac9201",
    "scripts/run-ig.sh": "35a64f1d4da8c3c1b107b243bae6d4a9a9fa66957c9878febb0b6bcf3fe2582e",
    "scripts/test-messaging-connectivity.ps1": "a42d229408b4281fc6f6110c6e9286091523ce00d48b96e0f28672307c6f49a2",
    "scripts/test-messaging-connectivity.sh": "cf6d212b403a8846c8d58629fc20272f3e7a325d9a97a12688f367d665d87c36",
    "SKILL.md": "98539bd472258ec80a1b2718a197df2f1f85b27d43a5c96a980424e5fac6894c",
    "troubleshooting/aks/aks-troubleshooting.md": "37a141177815d3bda47b15f270683d3a96f0d57dd59a2078150da2ab03ec6223",
    "troubleshooting/aks/general-diagnostics.md": "8acf6259604ef912d6ac763d75552a65925e76ab2020da56168ca879c389ef56",
    "troubleshooting/aks/load-balancer-and-ingress.md": "411fe1e7af9b072011d1cdc34733051cf8c31d6fa59355c0b0a5b2421a5f4681",
    "troubleshooting/aks/network-policy.md": "557901c258eb637baad32466e6e4eb9e570fa66deebb21520cef3436fe4672ce",
    "troubleshooting/aks/networking.md": "75ec5358fc5baff4a8c3f5891e3c6bf8fbb6930972abe00cbc09096aa96db66a",
    "troubleshooting/aks/node-issues.md": "1913b8383ecf748ea2fae53b1e3dfb176205c0f1a4183070f5a35ecce01a41d6",
    "troubleshooting/aks/optional-aks-operations.md": "96d5598e05b4dd0ec9982400fcce25bd4a1d969d626877876a3f2426d4607c07",
    "troubleshooting/aks/pod-failures.md": "930c8da84023a13da2fc92793f283eb7252bb03779b611716852338fe79a2126",
    "troubleshooting/aks/references/aks-mcp.md": "6377b54c5828aff186fed7ef86dcb0c38c7eba52d6266309d4b41d27febcf5c1",
    "troubleshooting/aks/references/command-flows.md": "130392554d7d93bad0fb74bef445333b7e11a27124133cf6d4821ae5edbdc3ad",
    "troubleshooting/aks/references/inspektor-gadget.md": "c78220ece086363f969810eee40a1963d276864d8cd31f6cd8af823cf91fb741",
    "troubleshooting/aks/references/structured-input-modes.md": "eb1d1efe70567b5583d56c155a640ed6d3964befba1e63589d57045ee0640119",
    "troubleshooting/aks/spot-and-zone-issues.md": "00531f4c15aafa5d89d9d8696d2b83c37611fbf7014600308252ef2382ec0379",
    "troubleshooting/aks/upgrade-operations.md": "a159e73391f2436c0184790deb9a3296c766288269cead50d07f3d021331dc88",
    "troubleshooting/compute/references/cannot-connect-to-vm.md": "d49c4ac1447e343c465750232379624434dad1955fac1b204894f91ee7e24663",
    "troubleshooting/compute/references/credential-auth-errors.md": "741fdd4facf000ddaf01f0b6d0654a0f12b0421ba9f75d626d51a25babd1805a",
    "troubleshooting/compute/references/firewall-blocking.md": "a855444fd7d42a1f874b97c8a9d354cecf7567f12ce14ce7b410aec4092f221c",
    "troubleshooting/compute/references/network-connectivity.md": "0d4dab14b9ee2b8f05faa0ecc2fc08592a12d05ee23489e4c7a52c5300d0d0fc",
    "troubleshooting/compute/references/rdp-connectivity.md": "e3d5a70e4a027e639602967107eb53be3b40a9360898bb843508cd7214379247",
    "troubleshooting/compute/references/rdp-service-config.md": "1a6e3bb20d6e7ae9a7c7638ce74009bf0bdb82b632c3e560be5201e87ad44881",
    "troubleshooting/compute/references/ssh-connectivity.md": "e9346d563a9a9d890ef6f9a03d429dd5e72decbe7bbdd5868d278c1b5823b44a",
    "troubleshooting/compute/references/vm-agent-not-responding.md": "270c2b73af1ac40d9cc9b0acc6b830363f6fa1a76d5591b2e275cfcbd78f2adc",
    "troubleshooting/compute/vm-troubleshooting.md": "4f25c141241dbc0f4b1ed25d8e998475f4881584ac7207f7e8678ca4ad4ab9a8",
    "troubleshooting/messaging/auth-best-practices.md": "34f6fe88e2b5819c1a0f24aa3930a060d9504fee68ea4b363f0912a78daa5396",
    "troubleshooting/messaging/azure-eventhubs-dotnet.md": "d168fd1529ad865409707fd0e208d44877ae3e9306de25f36ad141fe916e7b5e",
    "troubleshooting/messaging/azure-eventhubs-java.md": "f81e0671f1472545a805cb8ed5982fc3fb3ab743ac7111a26549be1500bb2e49",
    "troubleshooting/messaging/azure-eventhubs-js.md": "f4794520b65453a99ba1ede3fe9c7d34742d37a5148710a957ad8c6ba3033bb4",
    "troubleshooting/messaging/azure-eventhubs-py.md": "4511039cc6ce513e8ff4eaedc46b7248bb64d12897b52003bf66709a0c4a4e78",
    "troubleshooting/messaging/azure-servicebus-dotnet.md": "49ee74f9327aa2fe311d56d0bed2b80d757c807b82e6385833497570a1eb3927",
    "troubleshooting/messaging/azure-servicebus-java.md": "d5c07b964c79225c52f7dcaea2c46cef5fdb320aec67cbf3ba0fc03d46675910",
    "troubleshooting/messaging/azure-servicebus-js.md": "ef4131010dbaa59fea9dd9c5b6b6a4d866e83d375fd4d920c79d25ccadf0e16b",
    "troubleshooting/messaging/azure-servicebus-py.md": "274162fa4cec6f96fea056639c7cf0d8821bce277af82eb01343f6a9e74f647b",
    "troubleshooting/messaging/README.md": "060a285a2fab6038e198261f9a6d2b6151707f8e0aa29951f08816bba0766d2c",
    "troubleshooting/messaging/service-troubleshooting.md": "056d3ee490ff20d121eb8575c47c6bab67a786996b6949921c08de3aa887f949",
}
ADAPTED = {
    "SKILL.md",
    "references/app-service/README.md",
    "references/azure-resource-graph.md",
    "references/container-apps/README.md",
    "references/functions/durable.md",
    "references/functions/README.md",
    "references/functions/triggers.md",
    "references/kql-queries.md",
    "troubleshooting/aks/aks-troubleshooting.md",
    "troubleshooting/aks/general-diagnostics.md",
    "troubleshooting/aks/optional-aks-operations.md",
    "troubleshooting/aks/pod-failures.md",
    "troubleshooting/aks/references/aks-mcp.md",
    "troubleshooting/aks/references/command-flows.md",
    "troubleshooting/aks/references/inspektor-gadget.md",
    "troubleshooting/compute/vm-troubleshooting.md",
    "troubleshooting/messaging/README.md",
    "troubleshooting/messaging/service-troubleshooting.md",
}
LOCAL = {"LICENSE.md", "references/provenance.md", "references/execution-boundaries.md"}
LOCAL |= {
    "investigation/README.md",
    "investigation/scripts/query_prometheus.py",
    *("investigation/references/" + name + ".md" for name in (
        "confidence-assessment", "foundry-agent-routing",
        "managed-prometheus", "portal-links", "trace-query-patterns",
        "provenance", "host-tests",
    )),
}

MIT_NOTICE = """MIT License

Copyright 2025 (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE"""


def read(relative):
    return (SKILL / relative).read_text(encoding="utf-8")


def compact(relative):
    return " ".join(read(relative).split())


def local_link_errors(source, text):
    targets = re.findall(r"\[[^\]]*\]\(([^)]+)\)", text)
    targets += re.findall(r"^\[[^\]]+\]:\s*(\S+)", text, re.MULTILINE)
    errors = []
    for target in targets:
        parsed = urlsplit(target)
        if parsed.scheme or target.startswith("#"):
            continue
        path = (source.parent / unquote(parsed.path)).resolve()
        shared = {
            (ROOT / "skills/troubleshoot-observability/references" / name).resolve()
            for name in ("trace-capabilities.md", "next-actions.md",
                         "specialists.md", "host-tests.md")
        }
        if (not path.is_relative_to(SKILL.resolve()) and path not in shared) or not path.is_file():
            errors.append(target)
    return errors


class DiagnosticsIntegrityTests(unittest.TestCase):
    def test_complete_upstream_inventory_and_only_reviewed_additions(self):
        actual = {p.relative_to(SKILL).as_posix() for p in SKILL.rglob("*") if p.is_file()}
        self.assertEqual(len(UPSTREAM), 54)
        self.assertEqual(len(ADAPTED), 18)
        self.assertEqual(actual, set(UPSTREAM) | LOCAL)
        self.assertEqual(sum(p.endswith(".md") for p in actual), 53)
        self.assertEqual(sum(p.endswith(".ps1") for p in actual), 6)
        self.assertEqual(sum(p.endswith(".sh") for p in actual), 6)
        self.assertFalse(any(p.is_symlink() for p in SKILL.rglob("*")))

    def test_only_declared_adaptations_differ_from_pinned_source(self):
        changed = set()
        for relative, expected in UPSTREAM.items():
            with self.subTest(path=relative):
                data = (SKILL / relative).read_bytes().replace(b"\r\n", b"\n")
                if hashlib.sha256(data).hexdigest() != expected:
                    changed.add(relative)
        self.assertEqual(changed, ADAPTED)
        self.assertFalse(any(p.startswith("scripts/") for p in changed))

    def test_exact_mit_notice_and_public_pin(self):
        self.assertEqual(read("LICENSE.md"), MIT_NOTICE)
        provenance = read("references/provenance.md")
        for required in (PIN, "https://github.com/microsoft/azure-skills", "MIT",
                         "Copyright 2025 (c) Microsoft Corporation.", "57 files",
                         "18 upstream", "never executed", "external-customer"):
            with self.subTest(required=required):
                self.assertIn(required.lower(), provenance.lower())
        for relative in ADAPTED:
            self.assertIn("[" + relative + "]", provenance)

    def test_discoverable_frontmatter(self):
        entry = read("SKILL.md")
        self.assertTrue(entry.startswith("---\n"))
        frontmatter = entry.split("---", 2)[1]
        self.assertRegex(frontmatter, r"(?m)^name: azure-diagnostics$")
        self.assertRegex(frontmatter, r"(?m)^description: \S.+$")
        self.assertIn("MIT for the pinned Microsoft specialist", frontmatter)

    def test_all_relative_markdown_links_remain_inside_complete_skill(self):
        for path in SKILL.rglob("*.md"):
            with self.subTest(path=path.relative_to(SKILL)):
                self.assertEqual(local_link_errors(path, path.read_text(encoding="utf-8")), [])

    def test_link_check_detects_missing_escape_and_encoded_escape(self):
        source = SKILL / "SKILL.md"
        for target in ("missing.md", "../connect-observability/SKILL.md",
                       "%2e%2e/SKILL.md"):
            with self.subTest(target=target):
                self.assertEqual(local_link_errors(source, "[bad](" + target + ")"), [target])
        self.assertEqual(local_link_errors(source, "[good](references/provenance.md)"), [])
        self.assertEqual(local_link_errors(source, "[docs]: https://learn.microsoft.com/"), [])


class DiagnosticsContractTests(unittest.TestCase):
    def test_evidence_only_has_no_runtime_or_auth_prerequisite(self):
        entry = compact("SKILL.md")
        for required in ("Evidence-only", "no Azure authentication, Azure CLI, MCP, Python, or scripts",
                         "Do not log in", "Do not execute recipe commands",
                         "No new external investigation service is required"):
            with self.subTest(required=required):
                self.assertIn(required, entry)
        self.assertNotIn("mcp_azure_mcp_", entry)

    def test_actual_operation_discovery_scope_and_handoff(self):
        entry = compact("SKILL.md")
        for required in ("actual tool names", "input schemas", "retained scope/window",
                         "UTC start/end", "50 aggregate rows", "Bound retries to one",
                         "Instructions loaded versus operations actually executed",
                         "fallback used", "untrusted evidence"):
            with self.subTest(required=required):
                self.assertIn(required, entry)

    def test_failure_states_uncertainty_and_metadata_are_explicit(self):
        entry = compact("SKILL.md")
        for state in ("Missing", "denied", "empty", "stale", "throttled", "failed", "partial"):
            with self.subTest(state=state):
                self.assertIn(state, entry)
        for required in ("INCONCLUSIVE", "is **not Resource Health**",
                         "Correlation is not causation", "confidence percentages",
                         "do not claim recovery", "fresh post-change evidence"):
            with self.subTest(required=required):
                self.assertIn(required, entry)

    def test_scripts_and_sensitive_operations_never_baseline_authorized(self):
        entry = compact("SKILL.md")
        boundaries = compact("references/execution-boundaries.md")
        for required in ("never baseline auto-run", "separate explicit approval",
                         "kubeconfig fetching", "network probes/traffic", "credential resets",
                         "package/dependency installs", "raw log/stack dumps"):
            with self.subTest(required=required):
                self.assertIn(required, entry)
        for stem in {Path(p).stem for p in UPSTREAM if p.startswith("scripts/")}:
            self.assertIn("`" + stem + "`", boundaries)
        for required in ("privileged", "debug pods persist", "Dry-run with pod input",
                         "Raw logs", "Phase-only", "PowerShell scan", "exit 0",
                         "dynamic installation", "not an enforcement mechanism"):
            with self.subTest(required=required):
                self.assertIn(required, boundaries)

    def test_surgical_recipes_do_not_reintroduce_primary_path_bypasses(self):
        for path in ("references/app-service/README.md",
                     "references/container-apps/README.md"):
            recipe = compact(path)
            self.assertIn("execution boundaries", recipe)
            self.assertIn("separate explicit local-execution approval", recipe)
            self.assertNotIn("directly as your first action", recipe)
        aks = read("troubleshooting/aks/aks-troubleshooting.md")
        self.assertNotIn("az aks get-credentials", aks)
        self.assertNotIn("install or configure it before", aks)
        functions = read("references/functions/README.md")
        self.assertNotIn("instrumentationKey=properties.", functions)
        self.assertNotIn("connectionString=properties.", functions)
        self.assertNotIn("az functionapp config appsettings list", functions)
        self.assertIn("co-location only identifies candidates", functions)
        ig = compact("troubleshooting/aks/references/inspektor-gadget.md")
        self.assertIn("does **not** count as execution approval", ig)
        self.assertIn("**mutates cluster state**", ig)
        optional = compact("troubleshooting/aks/optional-aks-operations.md")
        self.assertNotIn("ask before using the host-supported plugin manager", optional)
        self.assertIn("not install", optional)

    def test_discovered_schema_notes_bind_names_ids_and_scopes_without_execution(self):
        boundaries = compact("references/execution-boundaries.md")
        for required in ("Discovered schema snapshot (discovery only)",
                         "`applens_resource_diagnose`",
                         "`question`, `resource` (resource **name**)",
                         "No `resourceId` input",
                         "`subscription`, `resource-group`, `resource-type`, `tenant`",
                         "`resourcehealth_availability-status_get`",
                         "exact confirmed resource ID",
                         "Never substitute an unscoped availability-status list",
                         "`monitor_resource_log_query`",
                         "`resource-id`, `table`, `query`",
                         "Optional `hours` and `limit`",
                         "A workspace query is a different scope/operation",
                         "None of these diagnostic/query operations was executed"):
            with self.subTest(required=required):
                self.assertIn(required, boundaries)
        entry = read("SKILL.md")
        for operation in ("applens_resource_diagnose",
                          "resourcehealth_availability-status_get",
                          "monitor_resource_log_query"):
            self.assertNotIn(operation, entry)

    def test_query_library_uses_capped_scoped_aggregates_not_raw_dumps(self):
        queries = re.findall(r"```kql\n(.*?)```", read("references/kql-queries.md"), re.DOTALL)
        self.assertEqual(len(queries), 4)
        for query in queries:
            with self.subTest(query=query.splitlines()[1]):
                for required in ("TimeGenerated between", "_ResourceId =~",
                                 "<confirmed-resource-id>", "summarize", "take 50"):
                    self.assertIn(required, query)
                for forbidden in ("Message", "StackTrace", " Target", "project"):
                    self.assertNotIn(forbidden, query)

    def test_offline_tests_disclaim_routing_and_host_execution(self):
        for path in ("SKILL.md", "references/provenance.md"):
            text = compact(path)
            with self.subTest(path=path):
                self.assertIn("Offline integrity/contract tests", text)
                self.assertIn("routing", text)
                self.assertIn("VS Code/Copilot CLI", text)


if __name__ == "__main__":
    unittest.main()
