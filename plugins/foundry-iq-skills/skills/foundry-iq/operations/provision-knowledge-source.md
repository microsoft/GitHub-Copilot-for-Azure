# Provision a Foundry IQ knowledge source

**Domain:** Operations
**Reads:** workload profile, approved source scope, source identity and entitlement model, Search service verdict, ingestion mode, and freshness requirement.

Create one source definition per approved corpus boundary. A source is not a
reason to widen access, copy content into logs, or create a second Search service.

## Preconditions

- A compatible Search service is verified or approved for provisioning.
- The exact approved source scope, source type, identity, freshness target, and
  required content processing are known.
- Data movement, role assignments, model processing, and billable ingestion have
  one approved plan.
- Existing source definitions have been checked for an exact reusable match.

## Apply

Use a data-plane SDK, or data-plane REST when the SDK lacks the current contract.
Pin the API or package version and persist a redacted, source-controlled
definition. Upsert idempotently by deterministic name and reject a same-name
definition whose source boundary differs.

For `azureBlob`, bind only the approved account, container, and prefix and preserve
RBAC scope. For `webKnowledgeSource`, allow only the approved domains, treat
content as untrusted, and never send private content to it. Other source types
must preserve their native identity and entitlement contract.

Acquire Microsoft Entra tokens just in time. Never retrieve, print, or persist a
storage key, connection string, Search credential, or source credential. Keep
every trial mutation inside its isolated resource group.

At the exact Search-service scope, use `Search Service Contributor` to create the
source and its generated objects and `Search Index Data Contributor` for generated
index writes. Grant the Search system identity only `Storage Blob Data Reader` on
the approved storage account and `Cognitive Services User` on the approved model
account.

For a keyless `azureBlob` source on API `2026-05-01-preview`, use `PUT
/knowledgesources('{name}')` and this contract:

```json
{
  "name": "<name>",
  "kind": "azureBlob",
  "azureBlobParameters": {
    "connectionString": "ResourceId=<storage-resource-id>;",
    "containerName": "<container>",
    "folderPath": "<approved-prefix>",
    "isADLSGen2": false,
    "ingestionParameters": {
      "identity": null,
      "contentExtractionMode": "minimal",
      "embeddingModel": {
        "kind": "azureOpenAI",
        "azureOpenAIParameters": {
          "resourceUri": "<model-endpoint>",
          "deploymentId": "<embedding-deployment>",
          "modelName": "<embedding-model>"
        }
      },
      "chatCompletionModel": {
        "kind": "azureOpenAI",
        "azureOpenAIParameters": {
          "resourceUri": "<model-endpoint>",
          "deploymentId": "<chat-deployment>",
          "modelName": "<chat-model>"
        }
      }
    }
  }
}
```

`identity: null` selects the Search system-assigned identity. Omit `apiKey`.
Do not edit the generated datasource, indexer, skillset, or index directly.

## Verify

Poll `GET /knowledgesources('{name}')/status` on the pinned API until
`synchronizationStatus` is `active` and a synchronization state has an `endTime`.
Require zero failed items and no errors. Inspect document counts, freshness, the
generated datasource/indexer/skillset/index linkage, and the effective approved
source scope. Retrieve every hidden expected document, not just the first indexed
document, and require resolvable original-source citations. A multi-source trial
verifies each source independently before testing the knowledge base.

Rerun the upsert and prove no duplicate source or widened scope appears. On
failure, surface the returned identity, network, parsing, or quota diagnostic
without switching to credentials or broader access.

## Output contract

Return the source name and type, approved and effective scopes, Search service
binding, identity and ingestion configuration, readiness and retrieval evidence,
failed-item diagnostics, idempotency evidence, rollback, and ownership-scoped
cleanup.
