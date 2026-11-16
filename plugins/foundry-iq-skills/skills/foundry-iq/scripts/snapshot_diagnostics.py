"""Project diagnostic JSON from stdin onto a fixed, non-content allowlist."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import TypeAlias


class SnapshotError(ValueError):
    pass


@dataclass(frozen=True)
class Scalar:
    kind: str
    values: frozenset[str] = frozenset()


@dataclass(frozen=True)
class Items:
    child: "Schema"


Schema: TypeAlias = Scalar | Items | dict[str, "Schema"]


def enum(*values: str) -> Scalar:
    return Scalar("enum", frozenset(values))


REF = Scalar("reference")
REF_KEYS = Scalar("reference-keys")
NUMBER = Scalar("number")
TOLERANCE = Scalar("failure-tolerance")
BOOL = Scalar("boolean")
TIME = Scalar("timestamp")
INTERVAL = Scalar("interval")
PRESENT = Scalar("presence")
MAX_INPUT_CHARS = 16 * 1024 * 1024
IDENTITY = {
    "@odata.type": enum(
        "#Microsoft.Azure.Search.DataUserAssignedIdentity",
        "#Microsoft.Azure.Search.DataNoneIdentity",
    ),
    "userAssignedIdentity": REF,
}
SCHEDULE = {"interval": INTERVAL, "startTime": TIME}
MODEL = {
    "kind": enum("azureOpenAI"),
    "azureOpenAIParameters": {
        "resourceUri": REF,
        "deploymentId": REF,
        "modelName": REF,
        "authIdentity": IDENTITY,
    },
}
INGESTION = {
    "identity": IDENTITY,
    "contentExtractionMode": enum("minimal", "standard"),
    "disableImageVerbalization": BOOL,
    "ingestionPermissionOptions": Items(enum("userIds", "groupIds", "rbacScope")),
    "embeddingModel": MODEL,
    "chatCompletionModel": MODEL,
    "ingestionSchedule": SCHEDULE,
    "aiServices": {"uri": REF},
    "assetStore": {"containerName": REF},
}
GENERATED = {key: REF for key in ("datasource", "indexer", "skillset", "index")}
KINDS = (
    "azureBlob", "file", "indexedSharePoint", "indexedOneLake", "searchIndex",
    "indexedSql", "remoteSharePoint", "web", "workIQ", "mcpServer",
    "fabricDataAgent", "fabricOntology",
)
ERROR = {"key": REF, "docId": REF, "name": REF, "statusCode": NUMBER}
MODE = enum("indexingAllDocs", "indexingResetDocs", "indexingResync")
EXECUTION = {
    "status": enum("transientFailure", "success", "inProgress", "reset"),
    "statusDetail": enum("resetDocs", "resync"),
    "startTime": TIME,
    "endTime": TIME,
    "itemsProcessed": NUMBER,
    "itemsFailed": NUMBER,
    "mode": MODE,
    "errorMessage": PRESENT,
    "errors": Items(ERROR),
    "warnings": Items({"key": REF, "name": REF}),
}
SYNC = {
    "startTime": TIME,
    "endTime": TIME,
    "itemsUpdatesProcessed": NUMBER,
    "itemsUpdatesFailed": NUMBER,
    "itemsSkipped": NUMBER,
    "errors": Items(ERROR),
}
LINK_STATE = {
    "status": enum("Pending", "Approved", "Rejected", "Disconnected"),
}
PROVISIONING = enum(
    "Succeeded", "succeeded", "Failed", "failed", "Updating", "Creating",
    "Deleting", "Incomplete", "Canceled", "CanceledByUser",
)
SCHEMAS: dict[str, Schema] = {
    "search-service": {
        "id": REF, "name": REF, "location": REF,
        "sku": {"name": REF},
        "identity": {
            "type": enum("None", "SystemAssigned", "UserAssigned", "SystemAssigned, UserAssigned"),
            "principalId": REF, "tenantId": REF, "userAssignedIdentities": REF_KEYS,
        },
        "properties": {
            "provisioningState": PROVISIONING,
            "disableLocalAuth": BOOL,
            "publicNetworkAccess": enum("enabled", "disabled", "Enabled", "Disabled"),
            "authOptions": {
                "apiKeyOnly": {},
                "aadOrApiKey": {
                    "aadAuthFailureMode": enum("http401WithBearerChallenge", "http403"),
                },
            },
            "networkRuleSet": {"ipRules": Items({"value": REF})},
        },
    },
    "knowledge-source": {
        "name": REF, "kind": enum(*KINDS), "@odata.etag": REF,
        "azureBlobParameters": {
            "containerName": REF, "folderPath": REF, "isADLSGen2": BOOL,
            "networkAccessMode": enum("public", "private"),
            "ingestionParameters": INGESTION, "createdResources": GENERATED,
        },
        "fileParameters": {"ingestionParameters": INGESTION, "createdResources": GENERATED},
        "indexedSharePointParameters": {
            "containerName": REF, "query": REF,
            "ingestionParameters": INGESTION, "createdResources": GENERATED,
        },
        "indexedOneLakeParameters": {
            "fabricWorkspaceId": REF, "lakehouseId": REF, "targetPath": REF,
            "ingestionParameters": INGESTION, "createdResources": GENERATED,
        },
        "searchIndexParameters": {
            "searchIndexName": REF, "semanticConfigurationName": REF,
        },
    },
    "knowledge-base": {
        "name": REF, "@odata.etag": REF,
        "knowledgeSources": Items({"name": REF}),
        "models": Items(MODEL),
        "outputMode": enum("extractiveData", "answerSynthesis"),
        "retrievalReasoningEffort": {"kind": enum("minimal", "low", "medium", "high")},
    },
    "data-source": {
        "name": REF, "@odata.etag": REF, "type": REF,
        "container": {"name": REF, "query": REF},
        "identity": IDENTITY,
        "dataChangeDetectionPolicy": {"@odata.type": REF, "highWaterMarkColumnName": REF},
        "dataDeletionDetectionPolicy": {
            "@odata.type": REF, "softDeleteColumnName": REF, "softDeleteMarkerValue": REF,
        },
    },
    "indexer": {
        "name": REF, "@odata.etag": REF, "dataSourceName": REF,
        "targetIndexName": REF, "skillsetName": REF, "disabled": BOOL,
        "schedule": SCHEDULE,
        "parameters": {
            "batchSize": NUMBER, "maxFailedItems": TOLERANCE,
            "maxFailedItemsPerBatch": TOLERANCE,
            "configuration": {
                "executionEnvironment": enum("standard", "private"),
                "parsingMode": REF, "dataToExtract": REF, "imageAction": REF,
            },
        },
        "fieldMappings": Items({"sourceFieldName": REF, "targetFieldName": REF}),
        "outputFieldMappings": Items({"sourceFieldName": REF, "targetFieldName": REF}),
    },
    "indexer-status": {
        "name": REF, "status": enum("unknown", "error", "running"),
        "lastResult": EXECUTION, "executionHistory": Items(EXECUTION),
        "currentState": {
            "mode": MODE, "resetDocumentKeys": Items(REF), "resetDatasourceDocumentIds": Items(REF),
        },
        "runtime": {
            "usedSeconds": NUMBER, "remainingSeconds": NUMBER,
            "beginningTime": TIME, "endingTime": TIME,
        },
        "limits": {
            "maxRunTime": INTERVAL, "maxDocumentExtractionSize": NUMBER,
            "maxDocumentContentCharactersToExtract": NUMBER,
        },
    },
    "knowledge-source-status": {
        "kind": enum(*KINDS),
        "synchronizationStatus": enum("creating", "active", "deleting"),
        "synchronizationInterval": INTERVAL,
        "currentSynchronizationState": SYNC, "lastSynchronizationState": SYNC,
    },
    "file-list": {
        "value": Items({
            "fileId": REF, "fileName": REF, "fileSizeBytes": NUMBER, "errorMessage": PRESENT,
        }),
        "@odata.nextLink": REF,
    },
    "role-assignments": Items({
        "id": REF, "principalId": REF,
        "principalType": enum("User", "Group", "ServicePrincipal", "ForeignGroup", "Device"),
        "roleDefinitionId": REF, "scope": REF,
        "condition": PRESENT, "conditionVersion": enum("1.0", "2.0"),
    }),
    "connection": {
        "id": REF, "name": REF,
        "properties": {
            "authType": enum("ProjectManagedIdentity", "ApiKey", "AAD", "CustomKeys"),
            "category": REF, "target": REF, "audience": REF, "isSharedToAll": BOOL,
        },
    },
    "private-link": {
        "id": REF, "name": REF,
        "properties": {
            "privateEndpoint": {"id": REF},
            "privateLinkServiceResourceId": REF, "groupId": REF,
            "privateLinkServiceConnectionState": LINK_STATE,
            "status": LINK_STATE["status"], "provisioningState": PROVISIONING,
        },
    },
    "site-permissions": {
        "value": Items({
            "id": REF, "roles": Items(enum("read", "write", "owner", "fullcontrol")),
            "grantedToIdentities": Items({"application": {"id": REF}}),
            "grantedToIdentitiesV2": Items({"application": {"id": REF}}),
        }),
        "@odata.nextLink": REF,
    },
    "dns-vnet-link": {
        "id": REF, "name": REF, "registrationEnabled": BOOL,
        "virtualNetwork": {"id": REF},
        "provisioningState": PROVISIONING,
        "virtualNetworkLinkState": enum("InProgress", "Completed"),
    },
    "network-observation": {
        "runtime": REF, "hostname": REF, "resolvedIps": Items(REF),
        "dnsLookupSucceeded": BOOL, "tcp443Reachable": BOOL,
    },
    "token-claims": {
        "tid": REF, "oid": REF, "appid": REF, "azp": REF, "aud": REF, "exp": NUMBER,
    },
    "agent": {
        "name": REF, "version": REF,
        "definition": {
            "model": REF,
            "tools": Items({
                "type": REF, "server_label": REF, "server_url": REF,
                "project_connection_id": REF, "allowed_tools": Items(REF),
                "require_approval": enum("always", "never"),
            }),
        },
    },
}
REQUIRED = {
    "search-service": {"id", "properties"},
    "knowledge-source": {"name", "kind"},
    "knowledge-base": {"name", "knowledgeSources"},
    "data-source": {"name", "type"},
    "indexer": {"name", "dataSourceName", "targetIndexName"},
    "indexer-status": {"status"},
    "knowledge-source-status": {"synchronizationStatus"},
    "file-list": {"value"},
    "connection": {"properties"},
    "private-link": {"properties"},
    "site-permissions": {"value"},
    "dns-vnet-link": {"id"},
    "network-observation": {"runtime", "hostname"},
    "token-claims": {"aud"},
    "agent": {"name", "version"},
}


def project(value: object, schema: Schema, path: str = "snapshot") -> object:
    if value is None:
        return None
    if isinstance(schema, dict):
        if not isinstance(value, dict):
            raise SnapshotError(f"Expected an object at {path}.")
        if "error" in value:
            raise SnapshotError("Handle the service error privately before taking a snapshot.")
        return {
            key: project(value[key], child, f"{path}.{key}")
            for key, child in schema.items() if key in value
        }
    if isinstance(schema, Items):
        if not isinstance(value, list):
            raise SnapshotError(f"Expected an array at {path}.")
        return [project(item, schema.child, path + "[]") for item in value]
    if schema.kind == "reference-keys" and isinstance(value, dict):
        return [project(key, REF, path) for key in sorted(value)]
    if schema.kind == "reference" and isinstance(value, str) and len(value) <= 16384:
        return {"sha256": hashlib.sha256(value.encode("utf-8")).hexdigest()}
    if schema.kind == "presence" and isinstance(value, str):
        return {"present": bool(value.strip())}
    if schema.kind in ("number", "failure-tolerance") and type(value) is int:
        if value >= (0 if schema.kind == "number" else -1):
            return value
    if schema.kind == "boolean" and type(value) is bool:
        return value
    if schema.kind == "enum" and isinstance(value, str) and value in schema.values:
        return value
    if schema.kind == "timestamp" and isinstance(value, str):
        if re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})",
            value,
        ):
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                pass
            else:
                return value
    if schema.kind == "interval" and isinstance(value, str):
        if re.fullmatch(r"\d+[dhms]", value) or (
            re.fullmatch(
                r"P(?=\d|T\d)(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?",
                value,
            )
        ):
            return value
    raise SnapshotError(f"Unsupported allowlisted value at {path}; verify the response contract.")


def snapshot(kind: str, value: object, label: str) -> dict[str, object]:
    if kind not in SCHEMAS:
        raise SnapshotError("Unknown snapshot kind.")
    if value is None:
        raise SnapshotError("Response is null; snapshot is incomplete.")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", label) or len(label) > 64:
        raise SnapshotError("Use a short, non-sensitive kebab-case label.")
    if kind in REQUIRED:
        if not isinstance(value, dict) or any(value.get(key) is None for key in REQUIRED[kind]):
            raise SnapshotError("Missing required response fields; snapshot is incomplete.")
    return {
        "schemaVersion": "1", "kind": kind, "label": label,
        "snapshot": project(value, SCHEMAS[kind]),
    }


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise SnapshotError("Duplicate JSON properties are not accepted.")
        result[key] = value
    return result


def reject_constant(value: str) -> object:
    raise SnapshotError("Non-finite JSON numbers are not accepted.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", required=True, choices=sorted(SCHEMAS))
    parser.add_argument("--label", required=True, help="Non-sensitive resource alias, not its name.")
    args = parser.parse_args()
    try:
        text = sys.stdin.read(MAX_INPUT_CHARS + 1)
        if len(text) > MAX_INPUT_CHARS:
            raise SnapshotError("Response exceeds the local snapshot input limit.")
        value = json.loads(
            text, object_pairs_hook=unique_object, parse_constant=reject_constant,
        )
        result = snapshot(args.kind, value, args.label)
    except SnapshotError as exc:
        parser.exit(2, f"Snapshot blocked: {exc}\n")
    except (ValueError, RecursionError):
        parser.exit(2, "Snapshot blocked: input cannot be safely parsed; no raw input was emitted.\n")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
