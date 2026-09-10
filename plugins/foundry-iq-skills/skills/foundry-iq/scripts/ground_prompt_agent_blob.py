from __future__ import annotations

import argparse
import atexit
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

SEARCH_API_VERSION = "2024-07-01"
CONNECTION_API_VERSION = "2025-04-01-preview"
ROLE_PROPAGATION_SECONDS = 900
UNRELATED_QUESTION = "What is two plus two?"


class GroundingError(RuntimeError):
    pass


def run_az(args: Sequence[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    executable = (
        os.environ.get("AZURE_CLI_SCOPED_PATH")
        or os.environ.get("AZURE_CLI_PATH")
        or shutil.which("az")
    )
    if not executable:
        raise GroundingError("Azure CLI is not installed or is not on PATH")
    if Path(executable).suffix.casefold() in {".bat", ".cmd"}:
        azure_python = Path(executable).resolve().parent.parent / "python.exe"
        if not azure_python.is_file():
            raise GroundingError(
                "Azure CLI batch launcher has no adjacent Python runtime"
            )
        command = [str(azure_python), "-IBm", "azure.cli", *args]
    else:
        command = [executable, *args]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
        shell=False,
    )
    if check and completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "command failed").strip()
        raise GroundingError(f"az {' '.join(args[:3])} failed: {detail}")
    return completed


def az_json(args: Sequence[str]) -> Any:
    completed = run_az([*args, "--only-show-errors", "--output", "json"])
    return json.loads(completed.stdout or "null")


def az_text(args: Sequence[str]) -> str:
    completed = run_az([*args, "--only-show-errors", "--output", "tsv"])
    return completed.stdout.strip()


def request_json(
    method: str,
    url: str,
    token: str,
    body: dict[str, Any] | None = None,
    *,
    retry_seconds: int = ROLE_PROPAGATION_SECONDS,
    retry_statuses: set[int] | None = None,
) -> Any:
    retry_statuses = retry_statuses or {403, 404, 409, 429, 500, 502, 503}
    deadline = time.monotonic() + retry_seconds
    payload = None if body is None else json.dumps(body).encode("utf-8")
    while True:
        request = urllib.request.Request(
            url,
            data=payload,
            method=method,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                **({"Content-Type": "application/json"} if payload else {}),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            if error.code not in retry_statuses or time.monotonic() >= deadline:
                raise GroundingError(
                    f"{method} {urllib.parse.urlparse(url).path} failed "
                    f"({error.code}): {detail}"
                ) from error
            time.sleep(10)


def access_token(resource: str) -> str:
    token = az_text(
        [
            "account",
            "get-access-token",
            "--resource",
            resource,
            "--query",
            "accessToken",
        ]
    )
    if not token:
        raise GroundingError(f"Azure CLI returned no token for {resource}")
    return token


def deterministic_name(prefix: str, resource_group: str, limit: int = 60) -> str:
    suffix = hashlib.sha256(resource_group.encode("utf-8")).hexdigest()[:14]
    return f"{prefix}{suffix}"[:limit]


def principal() -> tuple[str, str]:
    account = az_json(["account", "show"])
    user = account.get("user") or {}
    principal_type = str(user.get("type") or "").casefold()
    if principal_type == "serviceprincipal":
        object_id = az_text(["ad", "sp", "show", "--id", str(user["name"]), "--query", "id"])
        return object_id, "ServicePrincipal"
    object_id = az_text(["ad", "signed-in-user", "show", "--query", "id"])
    return object_id, "User"


def ensure_role(
    subscription: str,
    scope: str,
    principal_id: str,
    principal_type: str,
    role: str,
) -> str | None:
    assignments = az_json(
        [
            "role",
            "assignment",
            "list",
            "--subscription",
            subscription,
            "--scope",
            scope,
            "--assignee",
            principal_id,
        ]
    )
    if any(item.get("roleDefinitionName") == role for item in assignments or []):
        return None
    completed = run_az(
        [
            "role",
            "assignment",
            "create",
            "--subscription",
            subscription,
            "--scope",
            scope,
            "--assignee-object-id",
            principal_id,
            "--assignee-principal-type",
            principal_type,
            "--role",
            role,
            "--only-show-errors",
            "--output",
            "json",
        ]
    )
    assignment = json.loads(completed.stdout or "{}")
    assignment_id = str(assignment.get("id") or "")
    if not assignment_id:
        raise GroundingError(f"role assignment {role!r} returned no id")
    return assignment_id


def remove_role_assignment(subscription: str, assignment_id: str) -> None:
    run_az(
        [
            "role",
            "assignment",
            "delete",
            "--subscription",
            subscription,
            "--ids",
            assignment_id,
            "--only-show-errors",
            "--output",
            "none",
        ]
    )


def create_search_service(
    subscription: str,
    resource_group: str,
    requested_location: str,
    fallback_location: str,
    name: str,
    sku: str,
) -> dict[str, Any]:
    existing = run_az(
        [
            "search",
            "service",
            "show",
            "--subscription",
            subscription,
            "--resource-group",
            resource_group,
            "--name",
            name,
            "--only-show-errors",
            "--output",
            "json",
        ],
        check=False,
    )
    if existing.returncode == 0:
        return json.loads(existing.stdout)

    locations = [requested_location]
    if fallback_location and fallback_location.casefold() != requested_location.casefold():
        locations.append(fallback_location)
    errors: list[str] = []
    for location in locations:
        completed = run_az(
            [
                "search",
                "service",
                "create",
                "--subscription",
                subscription,
                "--resource-group",
                resource_group,
                "--name",
                name,
                "--location",
                location,
                "--sku",
                sku,
                "--identity-type",
                "SystemAssigned",
                "--disable-local-auth",
                "true",
                "--public-network-access",
                "enabled",
                "--only-show-errors",
                "--output",
                "json",
            ],
            check=False,
        )
        if completed.returncode == 0:
            return json.loads(completed.stdout)
        errors.append((completed.stderr or completed.stdout).strip())
        if "InsufficientResourcesAvailable" not in errors[-1]:
            break
    raise GroundingError("Search service creation failed: " + " | ".join(errors))


def project_parts(project_endpoint: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(project_endpoint)
    account = (parsed.hostname or "").split(".", 1)[0]
    project = parsed.path.rstrip("/").rsplit("/", 1)[-1]
    if not account or not project:
        raise GroundingError(f"invalid Foundry project endpoint: {project_endpoint}")
    return account, project


def poll_indexer(endpoint: str, name: str, token: str) -> None:
    query = urllib.parse.urlencode({"api-version": SEARCH_API_VERSION})
    url = (
        f"{endpoint}/indexers/{name}/status?"
        + query
    )
    deadline = time.monotonic() + ROLE_PROPAGATION_SECONDS
    last: dict[str, Any] = {}
    last_run_request = 0.0
    while True:
        status = request_json("GET", url, token)
        last = status.get("lastResult") or {}
        state = str(last.get("status") or "").casefold()
        if state == "success" and int(last.get("itemsProcessed") or 0) > 0:
            return
        if time.monotonic() >= deadline:
            raise GroundingError(
                f"indexer {name} did not become ready: "
                f"{json.dumps(last, sort_keys=True)}"
            )
        now = time.monotonic()
        if (
            state in {"success", "transientfailure", "persistentfailure"}
            and now - last_run_request >= 30
        ):
            request_json(
                "POST",
                f"{endpoint}/indexers/{name}/reset?{query}",
                token,
                retry_seconds=60,
            )
            request_json(
                "POST",
                f"{endpoint}/indexers/{name}/run?{query}",
                token,
                retry_seconds=60,
            )
            last_run_request = now
        time.sleep(10)


def response_facts(response: Any) -> tuple[str, list[str], list[str]]:
    citations: list[str] = []
    tool_calls: list[str] = []
    for item in getattr(response, "output", []) or []:
        item_type = str(getattr(item, "type", "") or "")
        if item_type and item_type != "message":
            if hasattr(item, "as_dict"):
                payload = item.as_dict()
            elif hasattr(item, "model_dump"):
                payload = item.model_dump()
            else:
                payload = {
                    name: getattr(item, name)
                    for name in (
                        "type",
                        "name",
                        "tool_name",
                        "action",
                        "arguments",
                        "input",
                        "query",
                        "queries",
                    )
                    if getattr(item, name, None) is not None
                }
            if not isinstance(payload, dict):
                payload = {"type": item_type}
            stable = {
                name: payload[name]
                for name in (
                    "type",
                    "name",
                    "tool_name",
                    "action",
                    "arguments",
                    "input",
                    "query",
                    "queries",
                )
                if name in payload
            }
            tool_calls.append(
                json.dumps(stable or {"type": item_type}, sort_keys=True, default=str)
            )
        for content in getattr(item, "content", []) or []:
            for annotation in getattr(content, "annotations", []) or []:
                url = getattr(annotation, "url", None)
                if isinstance(url, str) and url:
                    citations.append(url)
    return str(getattr(response, "output_text", "") or ""), citations, tool_calls


def normalized_response(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def unrelated_behavior_preserved(
    before_text: str,
    before_citations: Sequence[str],
    after_text: str,
    after_citations: Sequence[str],
    before_tool_calls: Sequence[str],
    after_tool_calls: Sequence[str],
    blob_prefix: str,
) -> bool:
    return (
        bool(before_text)
        and bool(after_text)
        and normalized_response(before_text) == normalized_response(after_text)
        and {citation.casefold() for citation in before_citations}
        == {citation.casefold() for citation in after_citations}
        and sorted(call.casefold() for call in before_tool_calls)
        == sorted(call.casefold() for call in after_tool_calls)
        and not any(
            citation.casefold().startswith(blob_prefix)
            for citation in after_citations
        )
    )


def index_targets(
    index: Any,
    connection_id: str,
    index_name: str,
) -> bool:
    if isinstance(index, dict):
        connection = index.get("project_connection_id") or index.get(
            "projectConnectionId"
        )
        name = index.get("index_name") or index.get("indexName")
    else:
        connection = getattr(index, "project_connection_id", None)
        name = getattr(index, "index_name", None)
    return (
        str(connection or "").casefold() == connection_id.casefold()
        and str(name or "").casefold() == index_name.casefold()
    )


def search_tool_indexes(tool: Any) -> list[Any] | None:
    if isinstance(tool, dict):
        resource = tool.get("azure_ai_search") or tool.get("azureAiSearch")
        if not isinstance(resource, dict):
            return None
        indexes = resource.get("indexes")
    else:
        resource = getattr(tool, "azure_ai_search", None)
        indexes = getattr(resource, "indexes", None)
    return list(indexes) if indexes is not None else None


@dataclass(frozen=True)
class Settings:
    subscription: str
    resource_group: str
    location: str
    fallback_location: str
    storage_account: str
    storage_container: str
    project_endpoint: str
    agent_name: str
    question: str
    search_sku: str


def ground(settings: Settings) -> dict[str, Any]:
    account_name, project_name = project_parts(settings.project_endpoint)
    search_name = deterministic_name("fiqsearch", settings.resource_group)
    index_name = "source-docs-index"
    datasource_name = "source-docs-datasource"
    indexer_name = "source-docs-indexer"
    connection_name = "source-docs-search"

    storage = az_json(
        [
            "storage",
            "account",
            "show",
            "--subscription",
            settings.subscription,
            "--resource-group",
            settings.resource_group,
            "--name",
            settings.storage_account,
        ]
    )
    storage_id = str(storage.get("id") or "")
    if not storage_id:
        raise GroundingError("storage account has no resource ID")

    search = create_search_service(
        settings.subscription,
        settings.resource_group,
        settings.location,
        settings.fallback_location,
        search_name,
        settings.search_sku,
    )
    search_id = str(search.get("id") or "")
    search_principal = str((search.get("identity") or {}).get("principalId") or "")
    search_endpoint = str(search.get("endpoint") or f"https://{search_name}.search.windows.net")
    if not search_id or not search_principal:
        raise GroundingError("Search service has no system-assigned identity")
    if search.get("disableLocalAuth") is not True:
        raise GroundingError("Search local authentication is not disabled")

    project = az_json(
        [
            "cognitiveservices",
            "account",
            "project",
            "show",
            "--subscription",
            settings.subscription,
            "--resource-group",
            settings.resource_group,
            "--name",
            account_name,
            "--project-name",
            project_name,
        ]
    )
    project_principal = str((project.get("identity") or {}).get("principalId") or "")
    if not project_principal:
        raise GroundingError("Foundry project has no system-assigned identity")

    caller_id, caller_type = principal()
    ensure_role(
        settings.subscription,
        storage_id,
        search_principal,
        "ServicePrincipal",
        "Storage Blob Data Reader",
    )
    for role in (
        "Search Index Data Reader",
        "Search Index Data Contributor",
        "Search Service Contributor",
    ):
        ensure_role(
            settings.subscription,
            search_id,
            project_principal,
            "ServicePrincipal",
            role,
        )
    caller_role_assignments: list[str] = []
    for role in ("Search Index Data Contributor", "Search Service Contributor"):
        assignment_id = ensure_role(
            settings.subscription,
            search_id,
            caller_id,
            caller_type,
            role,
        )
        if assignment_id:
            caller_role_assignments.append(assignment_id)

    def remove_caller_roles() -> None:
        failures: list[str] = []
        for assignment_id in reversed(caller_role_assignments.copy()):
            try:
                remove_role_assignment(settings.subscription, assignment_id)
            except Exception as error:
                failures.append(str(error))
            else:
                caller_role_assignments.remove(assignment_id)
        if failures:
            raise GroundingError(
                "temporary caller role cleanup failed: " + "; ".join(failures)
            )

    atexit.register(remove_caller_roles)

    search_token = access_token("https://search.azure.com")
    query = urllib.parse.urlencode({"api-version": SEARCH_API_VERSION})
    datasource = {
        "name": datasource_name,
        "type": "azureblob",
        "credentials": {"connectionString": f"ResourceId={storage_id}"},
        "container": {"name": settings.storage_container},
    }
    request_json(
        "PUT",
        f"{search_endpoint}/datasources/{datasource_name}?{query}",
        search_token,
        datasource,
    )
    index = {
        "name": index_name,
        "fields": [
            {
                "name": "id",
                "type": "Edm.String",
                "key": True,
                "filterable": True,
                "retrievable": True,
            },
            {
                "name": "content",
                "type": "Edm.String",
                "searchable": True,
                "retrievable": True,
                "analyzer": "standard.lucene",
            },
            {
                "name": "url",
                "type": "Edm.String",
                "filterable": True,
                "retrievable": True,
            },
            {
                "name": "title",
                "type": "Edm.String",
                "filterable": True,
                "retrievable": True,
            },
            {
                "name": "metadata_storage_path",
                "type": "Edm.String",
                "filterable": True,
                "retrievable": True,
            },
            {
                "name": "metadata_storage_name",
                "type": "Edm.String",
                "filterable": True,
                "retrievable": True,
            },
        ],
    }
    request_json(
        "PUT",
        f"{search_endpoint}/indexes/{index_name}?{query}",
        search_token,
        index,
    )
    indexer = {
        "name": indexer_name,
        "dataSourceName": datasource_name,
        "targetIndexName": index_name,
        "fieldMappings": [
            {
                "sourceFieldName": "metadata_storage_path",
                "targetFieldName": "id",
                "mappingFunction": {"name": "base64Encode"},
            },
            {
                "sourceFieldName": "metadata_storage_path",
                "targetFieldName": "url",
            },
            {
                "sourceFieldName": "metadata_storage_path",
                "targetFieldName": "metadata_storage_path",
            },
            {
                "sourceFieldName": "metadata_storage_name",
                "targetFieldName": "title",
            },
            {
                "sourceFieldName": "metadata_storage_name",
                "targetFieldName": "metadata_storage_name",
            },
        ],
        "parameters": {
            "configuration": {
                "dataToExtract": "contentAndMetadata",
                "parsingMode": "text",
            }
        },
    }
    request_json(
        "PUT",
        f"{search_endpoint}/indexers/{indexer_name}?{query}",
        search_token,
        indexer,
    )
    request_json(
        "POST",
        f"{search_endpoint}/indexers/{indexer_name}/reset?{query}",
        search_token,
    )
    request_json(
        "POST",
        f"{search_endpoint}/indexers/{indexer_name}/run?{query}",
        search_token,
    )
    poll_indexer(search_endpoint, indexer_name, search_token)

    search_result = request_json(
        "POST",
        f"{search_endpoint}/indexes/{index_name}/docs/search?{query}",
        search_token,
        {"search": "*", "top": 1, "select": "url,title"},
    )
    documents = search_result.get("value") or []
    if not documents or not str(documents[0].get("url") or "").startswith(
        f"https://{settings.storage_account}.blob.core.windows.net/"
        f"{settings.storage_container}/"
    ):
        raise GroundingError("indexed document does not preserve the original Blob URL")

    management_token = access_token("https://management.azure.com")
    connection_id = (
        f"/subscriptions/{settings.subscription}/resourceGroups/"
        f"{settings.resource_group}/providers/Microsoft.CognitiveServices/"
        f"accounts/{account_name}/projects/{project_name}/connections/"
        f"{connection_name}"
    )
    connection_url = (
        f"https://management.azure.com{connection_id}?"
        + urllib.parse.urlencode({"api-version": CONNECTION_API_VERSION})
    )
    connection = {
        "properties": {
            "category": "CognitiveSearch",
            "authType": "AAD",
            "target": search_endpoint,
            "useWorkspaceManagedIdentity": True,
            "isSharedToAll": False,
            "metadata": {
                "ApiVersion": SEARCH_API_VERSION,
                "ResourceId": search_id,
            },
        }
    }
    try:
        request_json(
            "PUT",
            connection_url,
            management_token,
            connection,
            retry_statuses={403, 404, 409, 429, 502, 503},
        )
    except GroundingError as error:
        if "(500)" not in str(error):
            raise
        # The connection RP can persist the resource and still return 500.
        request_json("GET", connection_url, management_token)

    try:
        from azure.ai.projects import AIProjectClient
        from azure.ai.projects.models import (
            AISearchIndexResource,
            AzureAISearchQueryType,
            AzureAISearchTool,
            AzureAISearchToolResource,
            PromptAgentDefinition,
        )
        from azure.identity import AzureCliCredential
    except ImportError as error:
        raise GroundingError(
            "azure-ai-projects>=2.4 and azure-identity are required"
        ) from error

    credential = AzureCliCredential(process_timeout=30)
    client = AIProjectClient(endpoint=settings.project_endpoint, credential=credential)
    openai = client.get_openai_client()
    try:
        versions = list(client.agents.list_versions(agent_name=settings.agent_name))
        if not versions:
            raise GroundingError(f"Prompt Agent {settings.agent_name} has no versions")
        latest = max(
            versions,
            key=lambda item: (
                int(str(item.version)) if str(item.version).isdigit() else -1,
                str(item.version),
            ),
        )
        current = client.agents.get_version(
            agent_name=settings.agent_name,
            agent_version=str(latest.version),
        )
        definition = current.definition
        before = openai.responses.create(
            input=UNRELATED_QUESTION,
            extra_body={
                "agent_reference": {
                    "name": settings.agent_name,
                    "type": "agent_reference",
                }
            },
        )
        before_text, before_citations, before_tool_calls = response_facts(before)
        tools = list(getattr(definition, "tools", []) or [])
        preserved_tools: list[Any] = []
        for tool in tools:
            indexes = search_tool_indexes(tool)
            if indexes is None:
                preserved_tools.append(tool)
                continue
            remaining = [
                index
                for index in indexes
                if not index_targets(index, connection_id, index_name)
            ]
            if len(remaining) == len(indexes):
                preserved_tools.append(tool)
            elif remaining:
                preserved_tools.append(
                    AzureAISearchTool(
                        azure_ai_search=AzureAISearchToolResource(
                            indexes=remaining
                        )
                    )
                )
        tools = preserved_tools
        tools.append(
            AzureAISearchTool(
                azure_ai_search=AzureAISearchToolResource(
                    indexes=[
                        AISearchIndexResource(
                            project_connection_id=connection_id,
                            index_name=index_name,
                            query_type=AzureAISearchQueryType.SIMPLE,
                        )
                    ]
                )
            )
        )
        created = client.agents.create_version(
            agent_name=settings.agent_name,
            definition=PromptAgentDefinition(
                model=str(definition.model),
                instructions=str(definition.instructions or ""),
                tools=tools,
            ),
            description="Grounded in the approved Blob corpus through Azure AI Search.",
        )

        deadline = time.monotonic() + ROLE_PROPAGATION_SECONDS
        while True:
            try:
                grounded = openai.responses.create(
                    input=settings.question,
                    tool_choice="required",
                    extra_body={
                        "agent_reference": {
                            "name": settings.agent_name,
                            "type": "agent_reference",
                        }
                    },
                )
                grounded_text, citations, tool_calls = response_facts(grounded)
                break
            except Exception as error:
                if time.monotonic() >= deadline:
                    raise GroundingError(
                        f"Prompt Agent query did not become ready: {error}"
                    ) from error
                time.sleep(10)
        blob_prefix = (
            f"https://{settings.storage_account}.blob.core.windows.net/"
            f"{settings.storage_container}/"
        ).casefold()
        if not any(url.casefold().startswith(blob_prefix) for url in citations):
            raise GroundingError(
                f"Prompt Agent citation does not resolve to the original Blob: {citations}"
            )
        after = openai.responses.create(
            input=UNRELATED_QUESTION,
            extra_body={
                "agent_reference": {
                    "name": settings.agent_name,
                    "type": "agent_reference",
                }
            },
        )
        after_text, after_citations, after_tool_calls = response_facts(after)
        if not unrelated_behavior_preserved(
            before_text,
            before_citations,
            after_text,
            after_citations,
            before_tool_calls,
            after_tool_calls,
            blob_prefix,
        ):
            raise GroundingError(
                "unrelated Prompt Agent behavior changed: "
                f"before={before_text!r}, after={after_text!r}, "
                f"before citations={before_citations}, "
                f"after citations={after_citations}, "
                f"before tools={before_tool_calls}, "
                f"after tools={after_tool_calls}"
            )
        remove_caller_roles()
        atexit.unregister(remove_caller_roles)
        return {
            "search_service": search_name,
            "search_location": search.get("location"),
            "index": index_name,
            "datasource": datasource_name,
            "indexer": indexer_name,
            "connection_id": connection_id,
            "agent_name": settings.agent_name,
            "agent_version": str(created.version),
            "answer": grounded_text,
            "citations": citations,
            "tool_calls": tool_calls,
            "unrelated_response": after_text,
        }
    finally:
        openai.close()
        client.close()
        credential.close()


def parse_args(argv: list[str] | None = None) -> Settings:
    parser = argparse.ArgumentParser(
        description=(
            "Ground an existing Foundry Prompt Agent in one Azure Blob container "
            "through keyless classic Azure AI Search."
        )
    )
    parser.add_argument(
        "--subscription",
        default=os.environ.get("AZURE_SUBSCRIPTION_ID"),
        required=not bool(os.environ.get("AZURE_SUBSCRIPTION_ID")),
    )
    parser.add_argument(
        "--resource-group",
        default=os.environ.get("AZURE_RESOURCE_GROUP"),
        required=not bool(os.environ.get("AZURE_RESOURCE_GROUP")),
    )
    parser.add_argument(
        "--location",
        default=os.environ.get("AZURE_LOCATION", "eastus2"),
    )
    parser.add_argument("--fallback-location", default="eastus")
    parser.add_argument(
        "--storage-account",
        default=os.environ.get("AZURE_STORAGE_ACCOUNT"),
        required=not bool(os.environ.get("AZURE_STORAGE_ACCOUNT")),
    )
    parser.add_argument(
        "--storage-container",
        default=os.environ.get("AZURE_STORAGE_CONTAINER"),
        required=not bool(os.environ.get("AZURE_STORAGE_CONTAINER")),
    )
    parser.add_argument(
        "--project-endpoint",
        default=os.environ.get("FOUNDRY_PROJECT_ENDPOINT"),
        required=not bool(os.environ.get("FOUNDRY_PROJECT_ENDPOINT")),
    )
    parser.add_argument(
        "--agent-name",
        default=os.environ.get("FOUNDRY_PROMPT_AGENT_NAME"),
        required=not bool(os.environ.get("FOUNDRY_PROMPT_AGENT_NAME")),
    )
    parser.add_argument("--question", required=True)
    parser.add_argument("--search-sku", default="basic")
    args = parser.parse_args(argv)
    return Settings(
        subscription=args.subscription,
        resource_group=args.resource_group,
        location=args.location,
        fallback_location=args.fallback_location,
        storage_account=args.storage_account,
        storage_container=args.storage_container,
        project_endpoint=args.project_endpoint,
        agent_name=args.agent_name,
        question=args.question,
        search_sku=args.search_sku,
    )


def main(argv: list[str] | None = None) -> int:
    try:
        result = ground(parse_args(argv))
        json.dump(result, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 0
    except GroundingError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
