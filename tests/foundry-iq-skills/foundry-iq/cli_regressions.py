"""Offline CLI-to-orchestration checks. HTTP, token and SDK boundaries are synthetic."""
import contextlib
import copy
import importlib
import io
import json
import os
import runpy
import socket
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit

HELPERS = Path(os.environ.get("FOUNDRY_HELPERS", Path(__file__).resolve().parents[3]
                             / "plugins/foundry-iq-skills/skills/foundry-iq/helpers")).resolve()
PACKAGE = os.environ.get("FOUNDRY_IMPORT_MODE") == "package"
sys.path.insert(0, str(HELPERS.parent if PACKAGE else HELPERS))
PREFIX = "helpers." if PACKAGE else ""
common = importlib.import_module(PREFIX + "_common")
BOUNDARY = None


def transport(method, url, token, **kwargs):
    return BOUNDARY(method, url, **kwargs)


common.http_request = transport
common.azure_cli_token = lambda _: "synthetic-offline-token"
prompt = importlib.import_module(PREFIX + "prompt_connect")

ENDPOINT = "https://example.search.windows.net"
SUBSCRIPTION = "00000000-0000-0000-0000-000000000001"
PRINCIPAL = "00000000-0000-0000-0000-000000000002"
TENANT = "00000000-0000-0000-0000-000000000003"
SCOPE = f"/subscriptions/{SUBSCRIPTION}/resourceGroups/test/providers/Microsoft.Search/searchServices/example"
PROJECT = f"/subscriptions/{SUBSCRIPTION}/resourceGroups/test/providers/Microsoft.CognitiveServices/accounts/example/projects/project"
PROJECT_ENDPOINT = "https://example.services.ai.azure.com/api/projects/project"
ASSIGNMENT = SCOPE + "/providers/Microsoft.Authorization/roleAssignments/00000000-0000-0000-0000-000000000004"


class Model:
    def __init__(self, value=None, **kwargs):
        self.value = copy.deepcopy(value if value is not None else kwargs)

    def as_dict(self):
        return copy.deepcopy(self.value)


def approved(plan):
    return {"schema_version": "1.0", "plan": plan,
            "approval": {"confirmed": True, "fingerprint": common.digest(plan)}}


class CliTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.calls = []
        self.network = patch.object(socket.socket, "connect", side_effect=AssertionError("Live network forbidden"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.processes = patch.object(subprocess, "Popen", side_effect=AssertionError("Live CLI forbidden"))
        self.processes.start()
        self.addCleanup(self.processes.stop)

    def response(self, status, body):
        return common.HttpResult(status, copy.deepcopy(body), {"request-id": "offline-request"})

    def absent(self):
        raise common.HelperFailure("absent", "Synthetic absent resource.",
                                   blocked_at="reconciliation", status=404)

    def run_cli(self, module, flag, document):
        path = self.root / "input.json"
        path.write_text(json.dumps(document), encoding="utf-8")
        output = io.StringIO()
        with patch.object(sys, "argv", [str(HELPERS / (module + ".py")), flag, str(path)]), \
                contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as stopped:
                if PACKAGE:
                    # Remove only the entry module; its common dependencies retain fake boundaries.
                    sys.modules.pop(PREFIX + module, None)
                    runpy.run_module(PREFIX + module, run_name="__main__")
                else:
                    runpy.run_path(str(HELPERS / (module + ".py")), run_name="__main__")
        raw = output.getvalue()
        self.assertNotIn("synthetic-offline-token", raw)
        return stopped.exception.code, json.loads(raw)

    def test_search_create_and_post_ack_failure_never_replay(self):
        global BOUNDARY
        for fail_readback in (False, True):
            with self.subTest(fail_readback=fail_readback):
                self.calls = []
                desired = {"name": "documents", "kind": "file", "fileParameters": {
                    "ingestionParameters": {"contentExtractionMode": "minimal"}}}
                plan = {"operation": "reconcile", "resource_type": "knowledge-source", "action": "create",
                        "endpoint": ENDPOINT, "name": "documents", "api_version": "2026-08-01-preview",
                        "owner": "offline-tests", "cleanup_approved": False, "desired": desired}

                def boundary(method, url, **kwargs):
                    self.calls.append(method)
                    if len(self.calls) == 1:
                        self.absent()
                    if method == "PUT":
                        self.assertEqual(json.loads(kwargs["body"]), desired)
                        self.assertEqual(kwargs["headers"]["If-None-Match"], "*")
                        return self.response(201, {**desired, "@odata.etag": '"v1"'})
                    self.assertEqual(method, "GET")
                    if fail_readback:
                        raise common.HelperFailure("read-denied", "Synthetic denial.",
                                                   blocked_at="verification", status=403)
                    return self.response(200, {**desired, "@odata.etag": '"v1"'})

                BOUNDARY = boundary
                code, result = self.run_cli("search_reconcile", "--input", approved(plan))
                self.assertEqual(code, 3 if fail_readback else 0)
                self.assertEqual(result["status"], "partial" if fail_readback else "completed")
                self.assertEqual(self.calls, ["GET", "PUT", "GET"])
                if fail_readback:
                    self.assertEqual(result["completed_writes"], [{"action": "created", "name": "documents"}])
                    self.assertEqual(result["cleanup"]["status"], "separate-plan-and-approval-required")
                    self.assertEqual(result["rollback"]["exact_plan"], [])

    def test_file_planning_reuse_and_local_drift_through_cli(self):
        global BOUNDARY
        local = self.root / "document.txt"
        local.write_text("offline document", encoding="utf-8")
        request = {"schema_version": "1.0", "endpoint": ENDPOINT, "name": "documents",
                   "owner": "offline-tests", "local_root": str(self.root), "paths": ["document.txt"],
                   "service_tier": "basic", "extraction_mode": "minimal", "vectorization": "none",
                   "rbac": {"assignments": [{"role": "owner-verified"}]},
                   "network": {"posture": "public", "evidence": "synthetic fixture"}}
        state, files = None, []

        def boundary(method, url, **kwargs):
            self.calls.append(method)
            self.assertEqual(method, "GET")
            if "/files?" in url:
                return self.response(200, {"value": files})
            if state is None:
                self.absent()
            return self.response(200, state)

        BOUNDARY = boundary
        code, planned = self.run_cli("file_source", "--plan", request)
        self.assertEqual(code, 0)
        plan = planned["execution_input"]["plan"]
        state = {**plan["source"]["desired"], "@odata.etag": '"v1"'}
        record = plan["ingestion"]["files"][0]
        inventory = importlib.import_module(PREFIX + (
            "_file_inventory" if (HELPERS / "_file_inventory.py").exists() else "file_ingest"))
        files.append({"fileName": "document.txt", "fileSizeBytes": record["size"], "fileId": "file-1",
                      "metadata": inventory._metadata(plan["ingestion"], record)})
        code, reused = self.run_cli("file_source", "--plan", request)
        self.assertEqual(code, 0)
        reuse_plan = reused["execution_input"]["plan"]
        self.assertEqual(reuse_plan["source"]["action"], "reuse")
        code, result = self.run_cli("file_source", "--input", approved(reuse_plan))
        self.assertEqual((code, result["status"]), (0, "completed"))
        self.assertEqual(len(result["resources"]["reused"]), 2)
        before = len(self.calls)
        local.write_text("changed after approval", encoding="utf-8")
        code, result = self.run_cli("file_source", "--input", approved(reuse_plan))
        self.assertEqual((code, result["status"]), (2, "blocked"))
        self.assertIn("inventory-drift", json.dumps(result))
        self.assertEqual(len(self.calls), before)

    def test_blob_planner_checks_real_inventory_parser_and_blocks_drift(self):
        global BOUNDARY
        storage = f"/subscriptions/{SUBSCRIPTION}/resourceGroups/test/providers/Microsoft.Storage/storageAccounts/teststorage"
        request = {"schema_version": "1.0", "endpoint": ENDPOINT, "name": "documents",
                   "owner": "offline-tests", "storage_id": storage, "container": "documents",
                   "prefix": "", "is_adls": False, "api_version": "2026-08-01-preview",
                   "processing": "minimal-lexical", "network_access": "public", "identity": "system-assigned",
                   "permission_options": [], "ingestion_schedule": None, "description": None,
                   "rbac": {"assignments": [{"role": "owner-verified"}]},
                   "network": {"posture": "public", "evidence": "synthetic fixture"},
                   "inventory_limits": {"max_pages": 2, "max_objects": 10, "max_requests": 12, "deadline_seconds": 30},
                   "poll": {"deadline_seconds": 5, "max_requests": 2, "interval_seconds": 1}}
        for drift in (False, True):
            with self.subTest(drift=drift):
                lists = []
                self.calls = []

                def boundary(method, url, **kwargs):
                    self.calls.append(method)
                    self.assertEqual(method, "GET")
                    if urlsplit(url).hostname == "example.search.windows.net":
                        self.absent()
                    if urlsplit(url).hostname == "management.azure.com":
                        return self.response(200, {"id": storage, "properties": {
                            "isHnsEnabled": False, "primaryEndpoints": {"blob": "https://teststorage.blob.core.windows.net/"},
                            "provisioningState": "Succeeded"}})
                    lists.append(url)
                    etag = "changed" if drift and len(lists) == 2 else "original"
                    payload = ("<EnumerationResults><Blobs><Blob><Name>document.txt</Name><Properties>"
                               f"<Etag>{etag}</Etag><Content-Length>16</Content-Length>"
                               "</Properties></Blob></Blobs><NextMarker/></EnumerationResults>").encode()
                    return self.response(200, payload)

                BOUNDARY = boundary
                code, result = self.run_cli("blob_source", "--plan", request)
                self.assertEqual((code, result["status"]), (2, "blocked") if drift else (0, "planned"))
                self.assertEqual(len(lists), 2)
                self.assertEqual(result["writes_performed"], [])

    def test_prompt_sdk_boundary_preserves_agent_and_blocks_prerequisite_conflict(self):
        global BOUNDARY
        tool = {"type": "mcp", "server_label": "knowledge-base",
                "server_url": ENDPOINT + "/knowledgebases/documents/mcp?api-version=2026-08-01-preview",
                "project_connection_id": "connection", "allowed_tools": ["knowledge_base_retrieve"],
                "require_approval": "never"}
        definition = {"kind": "prompt", "model": "model", "instructions": prompt.GROUNDING,
                      "tools": [tool], "temperature": 0.25}
        plan = {"operation": "connect", "sdk_major": 2, "project_resource_id": PROJECT,
                "project_endpoint": PROJECT_ENDPOINT, "owner": "offline-tests", "cleanup_approved": False,
                "grounding_instructions": prompt.GROUNDING, "allowed_tools": ["knowledge_base_retrieve"],
                "require_approval": "never", "permission_forwarding": {"mode": "not-applicable"},
                "connection": {"name": "connection", "target": tool["server_url"], "action": "reuse"},
                "agent": {"name": "agent", "version": "1", "model": "model",
                          "expected_definition_digest": common.digest(definition)},
                "rbac_verified": {"verified": True, "assignment_id": ASSIGNMENT, "principal_id": PRINCIPAL,
                                  "scope": SCOPE, "role": "Search Index Data Reader"}}
        item = types.SimpleNamespace(name="agent", version="1", definition=Model(**definition),
                                     metadata={"preserved": "yes"}, description="Existing version")
        events = []
        versions = [item]
        readback_failure = False

        class Client:
            def __init__(self, **kwargs):
                self.agents = self
                events.append("open")

            def list_versions(self, **kwargs):
                return list(versions)

            def get_version(self, **kwargs):
                if kwargs["agent_version"] == "2" and readback_failure:
                    raise common.HelperFailure("agent-read-denied", "Synthetic readback denial.",
                                               blocked_at="verification", status=403)
                return next(value for value in versions if value.version == kwargs["agent_version"])

            def create_version(self, agent_name, definition, **kwargs):
                events.append("create")
                created = types.SimpleNamespace(name=agent_name, version="2", definition=definition, **kwargs)
                versions.append(created)
                return created

            def close(self):
                events.append("close")

        class MCPTool(Model):
            def __init__(self, **kwargs):
                super().__init__(type="mcp", **kwargs)

        modules = {name: types.ModuleType(name) for name in (
            "azure", "azure.ai", "azure.ai.projects", "azure.ai.projects.models",
            "azure.core", "azure.core.exceptions", "azure.identity")}
        modules["azure.ai.projects"].AIProjectClient = Client
        models = modules["azure.ai.projects.models"]
        models.MCPTool, models.PromptAgentDefinition, models.StructuredInputDefinition = MCPTool, Model, Model
        modules["azure.core.exceptions"].AzureError = type("AzureError", (Exception,), {})
        modules["azure.identity"].AzureCliCredential = object
        metadata = importlib.import_module("importlib.metadata")
        for mode in ("reuse", "conflict", "create", "create-readback-failure"):
            with self.subTest(mode=mode):
                events.clear()
                versions[:] = [item]
                readback_failure = mode == "create-readback-failure"
                initial = copy.deepcopy(definition)
                if mode.startswith("create"):
                    initial["tools"] = [{"type": "function", "name": "preserve-other-tool"}]
                item.definition = Model(initial)
                plan["agent"]["expected_definition_digest"] = common.digest(initial)
                self.calls = []

                def boundary(method, url, **kwargs):
                    self.calls.append(method)
                    self.assertEqual(method, "GET")
                    if "/connections/" in url:
                        return self.response(200, {**prompt.connection_definition(plan), "etag": '"c1"'})
                    if "/roleAssignments/" in url:
                        return self.response(200, {"id": ASSIGNMENT, "properties": {
                            "principalId": PRINCIPAL, "scope": SCOPE,
                            "roleDefinitionId": "/providers/Microsoft.Authorization/roleDefinitions/1407120a-92aa-4202-b7e9-c0e197c71c8f"}})
                    if "/projects/project?" in url:
                        return self.response(200, {"id": PROJECT, "identity": {
                            "type": "SystemAssigned", "principalId": PRINCIPAL, "tenantId": TENANT},
                            "properties": {"provisioningState": "Succeeded", "endpoints": {"project": PROJECT_ENDPOINT}}})
                    if "/searchServices/" in url:
                        return self.response(200, {"id": SCOPE, "properties": {
                            "status": "disabled" if mode == "conflict" else "running", "provisioningState": "Succeeded"}})
                    return self.response(200, {"name": "documents", "knowledgeSources": [{"name": "source"}],
                                               "models": [], "retrievalReasoningEffort": {"kind": "minimal"},
                                               "outputMode": "extractiveData"})

                BOUNDARY = boundary
                with patch.dict(sys.modules, modules), patch.object(metadata, "version", return_value="2.4.0"):
                    loader_owner = importlib.import_module(PREFIX + (
                        "_prompt_read" if (HELPERS / "_embedding.py").exists() else "prompt_connect"))
                    with patch.object(loader_owner, "version", return_value="2.4.0"):
                        code, result = self.run_cli("prompt_connect", "--input", approved(plan))
                expected = (2, "blocked") if mode == "conflict" else (
                    (3, "partial") if readback_failure else (0, "completed"))
                self.assertEqual((code, result["status"]), expected)
                self.assertEqual(events, ["open", "create", "close"] if mode.startswith("create") else ["open", "close"])
                self.assertEqual(item.definition.as_dict(), initial)
                if mode.startswith("create"):
                    created = versions[-1]
                    self.assertEqual(created.metadata, item.metadata)
                    self.assertEqual(created.description, item.description)
                    self.assertEqual(created.definition.as_dict()["temperature"], 0.25)
                    self.assertEqual(created.definition.as_dict()["tools"][0], initial["tools"][0])
                if mode == "reuse":
                    self.assertEqual(len(result["resources"]["reused"]), 2)
                    self.assertIn("not-run", result["verification"]["agent_invocation"])
                if readback_failure:
                    self.assertEqual(result["completed_writes"], [{"action": "created", "agent": "agent", "version": "2"}])
                    self.assertEqual(result["rollback"]["exact_plan"], [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
