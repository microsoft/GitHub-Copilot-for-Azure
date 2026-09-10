# Provision a Foundry IQ knowledge base

**Domain:** Operations
**Reads:** workload profile, verified Search service, ready knowledge sources, query shape, retrieval-output decision, identity model, and quality acceptance question.

Create a knowledge base only when decomposition, iterative retrieval, ambiguity,
multiple sources, multi-hop work, or cross-evidence synthesis requires it. A
bounded lookup over one corpus stays on classic Search.

## Preconditions

- `references/architecture-choices.md` records why classic Search is insufficient.
- Every referenced knowledge source is ready and has passed its own retrieval and
  approved-source-scope checks.
- The name, source references, retrieval configuration, identity, acceptance
  question, and expected citations are defined.
- Billable or model-backed changes are approved, and the current identity has the
  least-privilege data-plane roles required to apply them.

## Apply

Use a data-plane SDK, or data-plane REST for a current contract the SDK does not
yet expose. Pin the API or package version, persist a redacted definition, and
upsert idempotently by deterministic name.

Reference only the verified source names. Start with the minimum sufficient
reasoning and extractive output; enable answer synthesis only when the workload
requires a composed answer. Preserve caller identity and source trust boundaries.
Never embed a Search credential, source credential, or end-user token in the
definition or logs. Keep trial resources inside the isolated resource group.
Use `Search Service Contributor` to create the knowledge base and `Search Index
Data Reader` for retrieval, both at the exact Search-service scope. Do not grant
the provisioning identity `Search Index Data Contributor`, and do not modify the
fixture-owned source or index definitions.

Use `PUT /knowledgebases('{name}')` on API `2026-05-01-preview`. When the workload
requires decomposition across sources but not answer synthesis, use:

```json
{
  "name": "<name>",
  "knowledgeSources": [
    { "name": "<approved-source-1>" },
    { "name": "<approved-source-2>" }
  ],
  "models": [
    {
      "kind": "azureOpenAI",
      "azureOpenAIParameters": {
        "resourceUri": "<model-endpoint>",
        "deploymentId": "<chat-deployment>",
        "modelName": "<chat-model>"
      }
    }
  ],
  "retrievalReasoningEffort": { "kind": "low" },
  "outputMode": "extractiveData"
}
```

Use `minimal` and omit `models` only for direct pass-through without source
selection or query planning. Omit `apiKey`, answer synthesis, and CORS.

## Verify

Read the knowledge base back and prove that its effective source references and
configuration match the approved definition and that every referenced fixture
source and index definition remains unchanged. Register or call its native MCP or
supported retrieval surface and run the acceptance question. Call
`POST /knowledgebases('{name}')/retrieve?api-version=2026-05-01-preview` with a
two-part message, references enabled, and `failOnError: true` for every source.
Reject activity errors; retain warnings as diagnostics because expected reranker
filtering can emit them. Correlate each reference's `activitySource` to its
activity record, and require an expected `(source, document)` pair from every
approved source.

Require all hidden expected documents, resolvable original-source citations, and
distinct source identity for private and public evidence. Also run an unrelated
query that should retrieve nothing. Rerun the upsert and prove no duplicate
knowledge base or source reference is created.

## Output contract

Return the knowledge-base name, Search service and source bindings, effective
retrieval configuration, identity behavior, acceptance and negative-query
results, citations, idempotency evidence, rollback, and ownership-scoped cleanup.
