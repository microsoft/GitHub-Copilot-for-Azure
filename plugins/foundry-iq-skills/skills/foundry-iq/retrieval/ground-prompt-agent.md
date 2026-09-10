# Ground a Foundry Prompt Agent

**Domain:** Retrieval
**Reads:** workload profile — query shape, corpus and content type, environment and policy.

Augment the existing agent so it answers from approved content with citations;
do not replace its harness. Use `operations/deploy-governed-agent` for a new
hosted agent in a governed network.

## Inspect and select

Identify the agent, model deployment, project, current tools, corpus, and query
shape. Read `references/architecture-choices.md` and compose
`discovery/reuse-or-provision` before creating resources.

| Query shape | Build | Attach through |
|---|---|---|
| Bounded questions over one corpus | Classic Search index over the approved source | The Azure AI Search tool on the agent |
| Decomposition, iterative retrieval, several sources, or cross-evidence synthesis | Knowledge source plus knowledge base | The knowledge-base MCP tool `knowledge_base_retrieve` |

Choose by query shape, not consumer type. Do not add a knowledge base for
explicit single-corpus queries or force classic retrieval onto multi-source
planning.

Compose `knowledge/process-content` when the corpus is image-heavy, and the
matching `knowledge/connect-*` source primitive.

## Attach with keyless authentication

Use Microsoft Entra ID and managed identity end to end. Never persist keys,
secret connection strings, admin credentials, or bearer tokens. Resource ID
references such as `credentials.connectionString: "ResourceId=<resource-id>"`
are non-secret and allowed. Prefer supported indexers or knowledge sources to
bespoke ingestion. Pin API versions, assign least privilege, and follow
`references/defaults-and-approvals.md` before role assignment or provisioning.

### Classic Blob implementation contract

For bounded Blob grounding, prefer the idempotent
`../scripts/ground_prompt_agent_blob.py`. Run it directly with only
`--question`; scoped Azure, Blob, project, and agent identifiers come from the
environment. Do not read the script, enumerate or modify the installed package,
run `--help`, or separately probe login. Run synchronously with the longest
supported wait; if it outlives that wait, call `read_powershell` once with the
longest delay. Use exploratory APIs only after a specific unsupported-operation
error.

The reference sequence is:

1. Create one Search service with system identity and `disableLocalAuth: true`;
   grant it **Storage Blob Data Reader** only on the approved account/container.
2. On Search API `2024-07-01`, create the `azureblob` datasource using
   `credentials.connectionString: "ResourceId=<storage-resource-id>"` and omit
   datasource `identity` to use the Search system identity.
3. Create the text index/indexer. Include searchable content and fields named
   `url` and `title`; make `url` retrievable and filterable. Map
   `metadata_storage_path` to `url` and `metadata_storage_name` to `title`, and
   confirm values before creating the agent version.
4. PUT the project Search connection at
   `.../projects/{project}/connections/{connection}` with ARM API
   `2025-04-01-preview`, `category: "CognitiveSearch"`, `authType: "AAD"`,
   Search endpoint `target`, `useWorkspaceManagedIdentity: true`, and
   `isSharedToAll: false`. After a transient 500, GET before retrying.
5. Grant the project identity **Search Index Data Contributor** and **Search
   Service Contributor** on Search. Do not speculate across principals; inspect
   runtime identity only if this path returns 403. Keep setup roles temporary.
6. Preserve the latest agent's model, instructions, and unrelated behavior.
   POST a new version with API `2025-05-15-preview` and one `azure_ai_search`
   index entry containing the full connection resource ID, `index_name`, and
   minimum query type.
7. Invoke the version. Require tool output with non-empty `url` and `title` and
   a response annotation equal to the original Blob URL, not the Search endpoint.
   If wrong, fix schema/mappings and create a fresh version.

## Verify and return

From the agent, prove the tool runs for a corpus question but not an unrelated
one, the answer is supported by retrieval, the citation resolves to the source,
prior behavior is unchanged, and retrieval uses managed identity without keys.

When retrieval fails after attachment, compose `troubleshooting/diagnose-and-repair`
rather than relaxing authentication or widening source scope.

Return the existing agent and tools discovered, the query-shape evidence and the
selected retrieval surface, the reuse decision, the source and processing
configuration, the keyless identity and role assignments, the grounded answer
with a resolvable citation, the unchanged-behavior check, and rollback.
