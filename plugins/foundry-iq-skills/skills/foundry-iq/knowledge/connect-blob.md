# Connect Azure Blob content

**Domain:** Knowledge
**Reads:** workload profile — corpus and content type, entitlement model, freshness, environment and policy.

The outcome is a grounded session over an approved production Azure Blob
collection. Blob Storage is the default enterprise document source; Azure vector
databases are also common. Use `onboard-local` for individual uploads and POCs,
and `connect-enterprise-sources` for multi-source federation or a hosted agent.
Use `ground-prompt-agent` when the result must attach to an existing Foundry
Prompt Agent.

## 1. Confirm scope and controls

Confirm the subscription, region, storage account, container, prefix, document
types, existing RBAC scope, and whether policy requires private networking. Do not
scan outside the approved prefix or copy document contents into logs.

Size the retrieval path with `references/architecture-choices.md` before
proposing resources. A classic Search index over the container serves bounded
questions over one corpus; a knowledge base is for decomposition, iterative
retrieval, or synthesis across evidence. Compose `process-content` when the
container holds manuals, diagrams, or complex tables the questions depend on.

For production, propose dedicated Azure AI Search with Microsoft Entra ID,
`disableLocalAuth: true`, and private networking when policy denies public access.
Use an `azureBlob` knowledge source with
`ingestionPermissionOptions: ["rbacScope"]` so the source boundary is not widened.
Show cost class, role assignments, private-link changes, rollback scope, and obtain
approval before mutation.

## 2. Connect and ground

Create the Search service and retrieval target through a supported API or SDK.
Connect only the approved container and prefix, verify private DNS where
applicable, and preserve Blob RBAC.

Consume the result through the path selected in step 1. On the knowledge-base
path, register the native knowledge-base MCP endpoint in the current session and
call `knowledge_base_retrieve` for the user's question. On the classic path there
is no knowledge base to register; query the index through the supported Search
data-plane surface instead.

Handle transient indexing, private-link, and Entra token failures using the returned
diagnostic. Retry without enabling public access, keys, broader source scope, or
broader permissions.

## Output contract

Return the approved Blob scope, the retrieval architecture chosen and its
evidence, Search identity and network postconditions, knowledge-source readiness,
the consumption surface established for the selected path, grounded answer with
source citation, and rollback instructions.
