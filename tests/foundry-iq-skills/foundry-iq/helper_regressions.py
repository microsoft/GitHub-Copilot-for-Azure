"""Offline regression tests for the shipped helpers; no Azure SDK or service access."""
import copy
import json
import math
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

if sys.version_info < (3, 12):
    raise RuntimeError("Foundry IQ helper regressions require Python 3.12 or newer.")

HELPERS = Path(__file__).resolve().parents[3] / "plugins" / "foundry-iq-skills" / "skills" / "foundry-iq" / "helpers"
sys.path.insert(0, str(HELPERS))

import _bootstrap_io as storage
import _cleanup_dependencies as dependencies
import _cleanup_receipts as receipts
import _common as common
import _blob_source_read as blob_read
import _embedding as embedding
import _file_inventory as inventory
import _file_source_config as file_config
import _private_json as private_json
import _prompt_read as prompt_read
import _search_read as search_read
import _source_readback as source_readback
import cleanup_plan
import file_source
import file_upload
import prompt_cleanup
import search_reconcile


class FakePath:
    def __init__(self, name, parents=()):
        self.name = name
        self.parents = parents

    def __str__(self):
        return self.name

    def __truediv__(self, name):
        return FakePath(self.name + "/" + name, (self,))


def fake_os():
    return SimpleNamespace(
        name="posix", O_RDONLY=0, O_WRONLY=1, O_CREAT=64, O_EXCL=128,
        O_DIRECTORY=65536, O_NOFOLLOW=131072, getuid=lambda: 1000,
        open=MagicMock(), close=MagicMock(), fstat=MagicMock(),
        fdopen=MagicMock(), fsync=MagicMock(),
    )


DIRECTORY = SimpleNamespace(st_dev=1, st_ino=2, st_uid=1000, st_mode=stat.S_IFDIR | 0o700)
LEAF = FakePath("leaf", (FakePath("ancestor"),))


class ResourceTests(unittest.TestCase):
    def test_ancestors_remain_pinned_and_release_in_reverse_order_on_every_exit(self):
        for mode in ("normal", "open", "metadata", "body", "close", "body-and-close", "helper-body-and-close"):
            with self.subTest(mode=mode):
                operating_system = fake_os()
                operating_system.open.side_effect = [101, 102]
                operating_system.fstat.return_value = DIRECTORY
                primary = OSError("caller failed")
                if mode == "open":
                    operating_system.open.side_effect = [101, OSError("open failed")]
                if mode == "helper-body-and-close":
                    primary = common.HelperFailure("test-blocker", "Caller failed.", blocked_at="verification")
                if mode == "metadata":
                    operating_system.fstat.side_effect = [DIRECTORY, OSError("metadata failed")]
                if "close" in mode:
                    operating_system.close.side_effect = [OSError("close failed"), None]
                error = None
                with patch.object(storage, "os", operating_system):
                    try:
                        with storage._pinned_directory(LEAF, private=False) as descriptor:
                            self.assertEqual(descriptor, 102)
                            operating_system.close.assert_not_called()
                            self.assertEqual(operating_system.open.call_args.kwargs, {"dir_fd": 101})
                            if "body" in mode:
                                raise primary
                    except (OSError, common.HelperFailure) as observed:
                        error = observed
                self.assertEqual([c.args[0] for c in operating_system.close.call_args_list],
                                 [101] if mode == "open" else [102, 101])
                self.assertEqual(error is None, mode == "normal")
                if "body" in mode:
                    self.assertIs(error, primary)
                if mode == "body-and-close":
                    self.assertIn("cleanup", " ".join(primary.__notes__))
                if mode == "helper-body-and-close":
                    self.assertEqual(primary.code, "test-blocker")
                    self.assertIn("cleanup", " ".join(primary.warnings))

    def test_directory_owner_does_not_retry_a_failed_close(self):
        operating_system = fake_os()
        operating_system.open.return_value = 101
        operating_system.close.side_effect = OSError("close failed")
        with patch.object(storage, "os", operating_system):
            owner = storage._DirectoryDescriptor(LEAF, None)
            with self.assertRaises(OSError):
                with owner:
                    self.assertEqual(owner.descriptor, 101)
            owner.__exit__(None, None, None)
        operating_system.close.assert_called_once_with(101)
        self.assertIsNone(owner.descriptor)

    def test_private_write_transfers_ownership_once_and_preserves_primary_error(self):
        for mode in ("normal", "metadata", "fdopen", "write", "close", "fdopen-and-close"):
            with self.subTest(mode=mode):
                operating_system = fake_os()
                operating_system.open.side_effect = [201, 202]
                operating_system.fstat.return_value = DIRECTORY
                handle = MagicMock()
                handle.__enter__.return_value = handle
                handle.fileno.return_value = 202
                operating_system.fdopen.return_value = handle
                primary = OSError("conversion failed")
                if mode == "metadata":
                    operating_system.fstat.side_effect = OSError("metadata failed")
                if "fdopen" in mode:
                    operating_system.fdopen.side_effect = primary
                if mode == "write":
                    handle.write.side_effect = OSError("write failed")
                if "close" in mode:
                    operating_system.close.side_effect = OSError("close failed")
                error = None
                with patch.object(storage, "os", operating_system), patch.object(
                    storage, "_validated_directory", return_value=(LEAF, DIRECTORY)
                ):
                    try:
                        storage.private_bytes(LEAF, "receipt.json", b"{}")
                    except common.HelperFailure as observed:
                        error = observed
                self.assertEqual([c.args[0] for c in operating_system.close.call_args_list],
                                 [202, 201] if "fdopen" in mode else [201])
                self.assertEqual(handle.__exit__.call_count, int(mode in ("normal", "write", "close")))
                self.assertEqual(error is None, mode == "normal")
                if mode == "fdopen-and-close":
                    self.assertIs(error.__cause__, primary)
                    self.assertTrue(error.warnings)

    def test_private_reader_closes_failed_conversion_without_double_close(self):
        for mode in ("normal", "fdopen", "fdopen-and-close", "read", "identity"):
            with self.subTest(mode=mode):
                operating_system = fake_os()
                operating_system.open.return_value = 301
                selected = SimpleNamespace(st_dev=1, st_ino=2, st_uid=1000,
                                           st_mode=stat.S_IFREG | 0o600, st_nlink=1)
                path = MagicMock()
                path.lstat.return_value = selected
                operating_system.fstat.return_value = selected
                handle = MagicMock()
                handle.__enter__.return_value = handle
                handle.fileno.return_value = 301
                handle.read.return_value = b'{"retained":true}'
                operating_system.fdopen.return_value = handle
                primary = OSError("conversion failed")
                if "fdopen" in mode:
                    operating_system.fdopen.side_effect = primary
                if mode == "fdopen-and-close":
                    operating_system.close.side_effect = OSError("close failed")
                if mode == "read":
                    handle.read.side_effect = OSError("read failed")
                if mode == "identity":
                    operating_system.fstat.return_value = SimpleNamespace(st_dev=1, st_ino=999)
                error = None
                with patch.object(private_json, "os", operating_system), patch.object(
                    private_json, "Path", return_value=path
                ), patch.object(storage, "private_directory"):
                    try:
                        self.assertEqual(private_json.read_private("receipt"), {"retained": True})
                    except common.HelperFailure as observed:
                        error = observed
                self.assertEqual(operating_system.close.call_count, int("fdopen" in mode))
                self.assertEqual(handle.__exit__.call_count, int("fdopen" not in mode))
                self.assertEqual(error is None, mode == "normal")
                if "fdopen" in mode:
                    self.assertIs(error.__cause__, primary)
                if mode == "fdopen-and-close":
                    self.assertIn("cleanup", " ".join(primary.__notes__))

    def test_private_json_rejects_ambiguous_or_nonfinite_evidence(self):
        for raw in ('{"x":1,"x":2}', '{"x":NaN}', "[]", "{"):
            with self.subTest(raw=raw), self.assertRaises(common.HelperFailure) as caught:
                private_json._json(raw)
            self.assertEqual(caught.exception.code, "recheck-evidence-invalid")
        self.assertEqual(private_json._json('{"x":{"value":3}}'), {"x": {"value": 3}})

    @unittest.skipIf(os.name == "nt", "POSIX mode/link checks; mocked ownership tests also run on Windows")
    def test_real_private_reader_rejects_links_and_public_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            root.chmod(0o700)
            evidence = root / "evidence.json"
            evidence.write_text('{"value":1}', encoding="utf-8")
            evidence.chmod(0o600)
            self.assertEqual(private_json.read_private(evidence), {"value": 1})
            link = root / "linked.json"
            link.symlink_to(evidence)
            with self.assertRaises(common.HelperFailure):
                private_json.read_private(link)
            evidence.chmod(0o644)
            with self.assertRaises(common.HelperFailure):
                private_json.read_private(evidence)


def source_plan(standard=False):
    plan = {
        "operation": "reconcile", "resource_type": "knowledge-source", "action": "create",
        "endpoint": "https://example.search.windows.net", "name": "documents",
        "api_version": "2026-08-01-preview", "owner": "test-owner", "cleanup_approved": False,
        "desired": {"name": "documents", "kind": "file",
                    "fileParameters": {"ingestionParameters": {"contentExtractionMode": "minimal"}}},
    }
    if standard:
        plan["ai_services_api_key_environment"] = "HELPER_TEST_CU_KEY"
        plan["desired"]["fileParameters"]["ingestionParameters"] = {
            "contentExtractionMode": "standard", "aiServices": {"uri": "https://example.services.ai.azure.com"},
        }
    return plan


def envelope(plan):
    fingerprint = common.digest(plan)
    return {"schema_version": "1.0", "plan": plan, "_computed_fingerprint": fingerprint,
            "approval": {"confirmed": True, "fingerprint": fingerprint}}


class ProvenanceTests(unittest.TestCase):
    def test_incomplete_generated_identity_retains_ack_before_failing_without_replay(self):
        for generated in (None, {"index": ""}, {"index": "valid-index"}):
            with self.subTest(generated=generated):
                plan = source_plan()
                document = envelope(plan)
                capture = receipts.Capture.__new__(receipts.Capture)
                capture.plan_digest = document["_computed_fingerprint"]
                capture.owner = plan["owner"]
                capture.records = {}
                events = []
                capture._persist = lambda record: events.append(record["state"])
                current = copy.deepcopy(plan["desired"])
                current["@odata.etag"] = '"v1"'
                if generated is not None:
                    current["fileParameters"]["createdResources"] = generated
                methods = []

                def transport(method, url, token, **kwargs):
                    methods.append(method)
                    if len(methods) == 1:
                        raise common.HelperFailure("absent", "absent", blocked_at="reconciliation", status=404)
                    if method == "PUT":
                        return common.HttpResult(201, current, {"request-id": "create"})
                    if "indexes(" in url:
                        return common.HttpResult(200, {"name": "valid-index", "@odata.etag": '"i1"'}, {})
                    return common.HttpResult(200, current, {})

                if generated == {"index": "valid-index"}:
                    result = search_reconcile.execute(document, token_provider=lambda _: "unused",
                        transport=transport, cleanup_capture=capture,
                        on_file_acknowledged=lambda _: events.append("file-ack"))
                    self.assertEqual(result["status"], "completed")
                    self.assertEqual(events, ["acknowledged", "file-ack", "verified"])
                else:
                    with self.assertRaises(common.HelperFailure) as caught:
                        search_reconcile.execute(document, token_provider=lambda _: "unused",
                            transport=transport, cleanup_capture=capture,
                            on_file_acknowledged=lambda _: events.append("file-ack"))
                    self.assertEqual(caught.exception.code, "generated-creation-evidence-unavailable")
                    self.assertTrue(caught.exception.partial)
                    self.assertEqual(caught.exception.writes, [{"action": "created", "name": "documents"}])
                    self.assertEqual(events, ["acknowledged", "file-ack"])
                    self.assertIsNone(next(iter(capture.records.values()))["acknowledgement"]["generated"])
                self.assertEqual(methods.count("PUT"), 1)
                self.assertNotIn("DELETE", methods)

    def test_unexpected_generated_validation_error_is_not_swallowed(self):
        error = common.HelperFailure("unexpected-validation-failure", "test", blocked_at="verification")
        capture = MagicMock()
        with patch.object(dependencies, "generated", side_effect=error), self.assertRaises(common.HelperFailure) as caught:
            receipts.search_ack(capture, source_plan(), common.HttpResult(201, {}, {}))
        self.assertIs(caught.exception, error)
        capture.start.assert_not_called()

    def test_credential_payload_is_scrubbed_on_success_and_transport_failure(self):
        for throws in (False, True):
            with self.subTest(throws=throws):
                plan = source_plan(standard=True)
                captured_payloads, methods = [], []
                original_serializer = common.canonical_bytes

                def serialize(value):
                    captured_payloads.append(value)
                    return original_serializer(value)

                def transport(method, url, token, **kwargs):
                    methods.append(method)
                    if len(methods) == 1:
                        raise common.HelperFailure("absent", "absent", blocked_at="reconciliation", status=404)
                    if method == "PUT":
                        body = json.loads(kwargs["body"])
                        self.assertEqual(body["fileParameters"]["ingestionParameters"]["aiServices"]["apiKey"],
                                         "synthetic-fixture")
                        if throws:
                            raise common.HelperFailure("denied", "synthetic denial", blocked_at="execution", status=403)
                    return common.HttpResult(201 if method == "PUT" else 200,
                        {**plan["desired"], "@odata.etag": '"v1"'}, {})

                with patch.dict(os.environ, {"HELPER_TEST_CU_KEY": "synthetic-fixture"}), patch.object(
                    search_reconcile, "canonical_bytes", side_effect=serialize
                ):
                    if throws:
                        with self.assertRaises(common.HelperFailure) as caught:
                            search_reconcile.execute(envelope(plan), token_provider=lambda _: "unused", transport=transport)
                        self.assertEqual(caught.exception.code, "denied")
                    else:
                        result = search_reconcile.execute(envelope(plan), token_provider=lambda _: "unused", transport=transport)
                        self.assertEqual(result["status"], "completed")
                self.assertEqual(methods.count("PUT"), 1)
                self.assertTrue(captured_payloads)
                self.assertNotIn("synthetic-fixture", json.dumps(captured_payloads))
                self.assertNotIn("apiKey", plan["desired"]["fileParameters"]["ingestionParameters"]["aiServices"])

    def test_cleanup_target_rendering_preserves_original_blocker(self):
        failure = common.HelperFailure("original-blocker", "original", blocked_at="verification", warnings=[])
        with patch.object(cleanup_plan, "_read_json", return_value={"target": "invalid-sensitive-input"}), patch.object(
            cleanup_plan, "plan_cleanup", side_effect=failure
        ), patch.object(cleanup_plan, "emit_result") as emit:
            self.assertEqual(cleanup_plan.main(["--plan", "unused.json"]), 2)
        result = emit.call_args.args[0]
        self.assertEqual(result["approval_summary"]["blocked"], ["original-blocker"])
        self.assertEqual(result["approval_summary"]["delete"], [])
        self.assertNotIn("retained_targets", result["approval_summary"])
        self.assertTrue(result["warnings"])
        self.assertNotIn("invalid-sensitive-input", json.dumps(result))


class SharedContractTests(unittest.TestCase):
    def test_search_definition_and_etags_preserve_readback_contract(self):
        desired = {"kind": "azureBlob", "parameters": {"resourceUri": "https://example/", "uri": "https://other/"}}
        readback = {**copy.deepcopy(desired), "resultsProcessing": "rerank", "@odata.etag": '"v1"',
                    "createdResources": {"index": "generated"}, "empty": [], "apiKey": "<redacted>"}
        readback["parameters"]["resourceUri"] = "https://example"
        self.assertTrue(search_read.definitions_match(desired, readback))
        self.assertFalse(search_read.definitions_match({"uri": "https://other//"}, {"uri": "https://other/"}))
        self.assertEqual(search_read.resolve_etag({"headers": ['"v1"', '"v1"'], "body": '"v1"'}), '"v1"')
        for evidence, code in (({"headers": ['"v1"'], "body": '"v2"'}, "etag-conflict"),
                               ({"headers": [""], "body": None}, "etag-invalid")):
            with self.assertRaises(common.HelperFailure) as caught:
                search_read.resolve_etag(evidence, "request")
            self.assertEqual(caught.exception.code, code)
            self.assertEqual(caught.exception.request_id, "request")

    def test_embedding_and_file_blob_readback_dispatch_remain_strict(self):
        choice = {"endpoint": "https://example.openai.azure.com/", "deployment": "embedding", "model": "text-embedding-3-small"}
        model = common.model_definition(choice)
        self.assertEqual(search_reconcile._kb_model_definition(choice), model)
        self.assertEqual(model["azureOpenAIParameters"]["resourceUri"], choice["endpoint"].rstrip("/"))
        for kind in ("file", "azureBlob"):
            parameters = "fileParameters" if kind == "file" else "azureBlobParameters"
            cu = {"endpoint": "https://example.services.ai.azure.com/", "auth": "system-assigned"}
            body = {"kind": kind, parameters: {"ingestionParameters": {
                "contentExtractionMode": "standard", "aiServices": {"uri": cu["endpoint"].rstrip("/")},
                "embeddingModel": copy.deepcopy(model),
            }}}
            plan = {"source": {**source_plan(), "desired": body}, "embedding": choice, "content_understanding": cu}
            response = common.HttpResult(200, body, {"request-id": "readback"})
            guard = source_readback.guard_readback_transport(plan, lambda *args: response)
            url = search_read.resource_url(plan["source"])
            self.assertIs(guard("GET", url, "unused"), response)
            body[parameters]["ingestionParameters"]["aiServices"]["uri"] = "https://different.services.ai.azure.com"
            with self.assertRaises(common.HelperFailure) as caught:
                guard("GET", url, "unused")
            self.assertEqual(caught.exception.request_id, "readback")
            body[parameters]["ingestionParameters"]["embeddingModel"]["azureOpenAIParameters"]["authIdentity"] = "unexpected"
            with self.assertRaises(common.HelperFailure):
                embedding.verify_source_readback(choice, body)

    def test_retry_after_parsing_does_not_shorten_server_waits(self):
        now = datetime(2026, 9, 29, tzinfo=timezone.utc)
        self.assertEqual(blob_read._retry_after("60", now=now), 60)
        self.assertEqual(blob_read._retry_after("Tue, 29 Sep 2026 00:01:00 GMT", now=now), 60)
        self.assertEqual(blob_read._retry_after(common.RetryAfter("overlong"), now=now), math.inf)
        for value in ("not a date", "9" * 200, common.RetryAfter("date", 1e100)):
            self.assertIsNone(blob_read._retry_after(value, now=now))

    def test_blob_monitor_keeps_bounded_reads_and_honors_long_retry_hints(self):
        for hint in ("invalid", "120"):
            with self.subTest(hint=hint):
                clock = [0]
                sleeps, methods = [], []

                def sleep(seconds):
                    sleeps.append(seconds)
                    clock[0] += seconds

                def transport(method, url, token, **kwargs):
                    methods.append(method)
                    self.assertLessEqual(kwargs["timeout"], 30)
                    if len(methods) == 1:
                        return common.HttpResult(429, {}, {"retry-after": hint})
                    return common.HttpResult(200, {
                        "kind": "azureBlob", "synchronizationStatus": "active",
                        "lastSynchronizationState": {
                            "startTime": "2026-09-29T00:00:00Z", "endTime": "2026-09-29T00:00:01Z",
                            "status": "success", "itemsUpdatesProcessed": 1,
                            "itemsUpdatesFailed": 0, "itemsSkipped": 0,
                        },
                    }, {})

                result = blob_read.monitor(
                    source_plan(), not_before=datetime(2026, 9, 29, tzinfo=timezone.utc),
                    limits={"deadline_seconds": 10, "max_requests": 3, "interval_seconds": 1},
                    token_provider=lambda _: "unused", transport=transport,
                    monotonic=lambda: clock[0], sleep=sleep,
                )
                self.assertEqual(set(methods), {"GET"})
                if hint == "120":
                    self.assertEqual(result["watch"]["reason"], "retry-after")
                    self.assertEqual(sleeps, [])
                    self.assertEqual(len(methods), 1)
                else:
                    self.assertEqual(result["status"], "verified")
                    self.assertEqual(len(methods), 2)
                    self.assertEqual(sleeps, [2])

    def test_prompt_identity_and_lazy_sdk_requirements(self):
        project = "/subscriptions/s/resourceGroups/g/providers/Microsoft.CognitiveServices/accounts/account/projects/project"
        plan = {"project_resource_id": project, "project_endpoint": "https://account.services.ai.azure.com/api/projects/project",
                "connection": {"name": "my connection"}}
        self.assertEqual(prompt_read._project_identity(plan), (project, plan["project_endpoint"]))
        self.assertIn("my%20connection?api-version=2025-10-01-preview", prompt_read._connection_url(plan))
        with self.assertRaises(common.HelperFailure):
            prompt_read._project_identity({**plan, "project_endpoint": "https://other.services.ai.azure.com/api/projects/project"})
        with patch.object(prompt_read, "_load_sdk", return_value=("sdk",)), patch.object(prompt_read, "version", return_value="2.4.0"):
            self.assertEqual(prompt_read._load_connection_sdk(), ("sdk",))
        with patch.object(prompt_cleanup, "version", return_value="2.3.0"), self.assertRaises(common.HelperFailure):
            prompt_cleanup.load_cleanup_sdk()

    def test_file_planning_reuse_and_upload_contracts_use_the_same_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "document.txt"
            path.write_text("synthetic document", encoding="utf-8")
            request = {"schema_version": "1.0", "endpoint": "https://example.search.windows.net",
                       "name": "documents", "owner": "test-owner", "local_root": directory, "paths": ["document.txt"],
                       "service_tier": "basic", "extraction_mode": "minimal", "vectorization": "none",
                       "rbac": {"assignments": [{"role": "owner-verified"}]},
                       "network": {"posture": "public", "evidence": "owner-verified"}}
            methods, state, server = [], None, []

            def transport(method, url, token, **kwargs):
                methods.append(method)
                self.assertEqual(method, "GET")
                if "/files?" in url:
                    return common.HttpResult(200, {"value": server}, {})
                if state is None:
                    raise common.HelperFailure("absent", "absent", blocked_at="reconciliation", status=404)
                return common.HttpResult(200, state, {})

            planned = file_source.plan_source(request, token_provider=lambda _: "unused", transport=transport)
            plan = planned["execution_input"]["plan"]
            self.assertEqual(plan["source"]["action"], "create")
            file_upload.Session._validate_document(envelope(plan))
            record = plan["ingestion"]["files"][0]
            state = {**plan["source"]["desired"], "@odata.etag": '"v1"'}
            server.append({"fileName": "document.txt", "fileSizeBytes": record["size"], "fileId": "file-1",
                           "metadata": inventory._metadata(plan["ingestion"], record)})
            reused = file_source.plan_source(request, token_provider=lambda _: "unused", transport=transport)
            reused_plan = reused["execution_input"]["plan"]
            self.assertEqual(reused_plan["source"]["action"], "reuse")
            result = file_source.execute(envelope(reused_plan), token_provider=lambda _: "unused", transport=transport)
            self.assertEqual(result["status"], "completed")
            self.assertEqual(result["resources"]["created"], [])
            self.assertEqual(len(result["resources"]["reused"]), 2)
            payload, boundary = inventory._multipart(plan["ingestion"], record, b"synthetic document", common.digest(plan))
            self.assertIn(boundary.encode("ascii"), payload)
            self.assertIn(record["sha256"].encode("ascii"), payload)
            self.assertTrue(methods)
            self.assertEqual(set(methods), {"GET"})
            state = None
            server.clear()
            writes = []

            def create_transport(method, url, token, **kwargs):
                nonlocal state
                if method == "GET":
                    return transport(method, url, token, **kwargs)
                writes.append(method)
                if method == "PUT":
                    state = {**json.loads(kwargs["body"]), "@odata.etag": '"v2"'}
                    return common.HttpResult(201, state, {"request-id": "created"})
                self.assertEqual(method, "POST")
                self.assertIn(b"synthetic document", kwargs["body"])
                server.append({"fileName": "document.txt", "fileSizeBytes": record["size"], "fileId": "file-2",
                               "metadata": inventory._metadata(plan["ingestion"], record)})
                return common.HttpResult(201, server[0], {"request-id": "uploaded"})

            created = file_source.execute(envelope(plan), token_provider=lambda _: "unused", transport=create_transport)
            self.assertEqual(created["status"], "completed")
            self.assertEqual(writes, ["PUT", "POST"])
            self.assertEqual(len(created["resources"]["created"]), 2)
            path.write_text("changed", encoding="utf-8")
            with self.assertRaises(common.HelperFailure) as caught:
                file_config._validate_plan(plan)
            self.assertEqual(caught.exception.code, "inventory-drift")

    def test_all_helpers_import_in_fresh_direct_and_package_processes_without_sdks(self):
        code = """
import importlib, pathlib, sys
root = pathlib.Path(sys.argv[1])
package = sys.argv[2] == 'package'
sys.path.insert(0, str(root.parent if package else root))
for file in sorted(root.glob('*.py')):
    importlib.import_module(('helpers.' if package else '') + file.stem)
if any(name == 'azure' or name.startswith('azure.') for name in sys.modules):
    raise RuntimeError('Import eagerly loaded an optional Azure SDK')
"""
        for mode in ("direct", "package"):
            result = subprocess.run([sys.executable, "-B", "-c", code, str(HELPERS), mode],
                                    capture_output=True, text=True, timeout=30, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    outcome = unittest.TextTestRunner(verbosity=2).run(suite)
    if not outcome.wasSuccessful():
        sys.exit(1)
    print("Helper regressions passed")
