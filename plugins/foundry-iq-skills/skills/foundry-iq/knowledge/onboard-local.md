# Onboard local content

**Domain:** Knowledge
**Reads:** workload profile — corpus and content type, query shape, freshness.

The outcome is the first cited answer over approved local content, through the
smallest architecture that works, without requiring the user to open the Azure
portal. Prefer `connect-blob` when a production collection already exists in Azure
Blob Storage. Compose `retrieve-grounded` next to produce the first cited answer.

## 1. Gather and propose

1. Inspect the requested folder read-only. Infer supported types, exclusions, and
   approximate size. Ask only if the approved folder boundary is ambiguous.
2. Decide whether a persistent layer is warranted at all. A handful of files the
   agent can already open, needed once, is answered from local context; indexing
   it buys nothing and leaves a resource to own. Corpus size, repeated retrieval
   failure, reuse across sessions, or a freshness requirement warrants
   persistence. Report the decision either way.
3. Size the rest with `references/architecture-choices.md`: a classic Search
   index is enough for bounded lookups over one corpus, and a knowledge base is
   for decomposition, iterative retrieval, or synthesis across evidence. Compose
   `process-content` when diagrams, figures, or tables in the corpus carry
   information the questions need.
4. Inspect Azure context, policy, and reusable resources. Ask for subscription or
   region only when discovery leaves multiple plausible choices. Skip this when
   step 2 concluded no persistence is warranted.
5. Apply `references/defaults-and-approvals.md`.

When step 2 concluded persistence is not warranted, propose no Azure resources.
Answer from the approved local content directly, name the trigger that would
change the decision, and stop here. There is no knowledge source, index,
knowledge base, or MCP endpoint on this path.

When persistence is warranted, propose:

   - Serverless Azure AI Search using consumption pricing.
   - Public networking for the on-ramp only.
   - `disableLocalAuth: true` and Microsoft Entra ID authentication.
   - An `azureBlob` knowledge source for POC-staged local files.
   - One knowledge base with `reasoningEffort: low` and answer synthesis
     disabled, plus session consumption through the knowledge-base MCP endpoint,
     when the knowledge-base path was selected. When the classic path was
     selected, propose the index and query it through the supported Search
     data-plane surface instead.

Include expected setup time, pricing model, resource names, and rollback scope.
Then present one plan covering cost, data movement, identities, networking,
verification, and cleanup, and ask once for approval before upload or
provisioning.

Raise reasoning effort or enable answer synthesis only after measurement shows
extractive results at low effort do not answer the workload's questions.

## 2. Create and configure

Skip this section entirely on the no-persistence path; there is nothing to
create. Report the decision, the grounded answer from local content, and the
trigger that would justify revisiting it.

Use a supported API or SDK surface for deterministic control-plane and data-plane
operations. Keep the knowledge-source and knowledge-base definitions portable to
dedicated Search so graduation does not change their API shape.

Stage only approved files. Preserve relative paths as citation identities and
exclude secrets, build output, source-control internals, and user-specified globs.
Never log file contents.

Create or update resources idempotently, wait for ingestion, and verify document
counts, failed items, freshness, one natural-language retrieval that exercises the
vector path (a paraphrased query the source does not word-match, not a keyword
lookup), and one resolvable citation before reporting success. If that query does
not return the expected document, the vector column is empty or the wrong
embedding is wired — fix ingestion before reporting success. Persist generated definitions and cleanup commands in the
working project when the user requested implementation.

Acquire Entra tokens just in time. Refresh before expiry (normally inside the
roughly 60-minute bearer lifetime), retry one authentication failure only after a
fresh token, and surface persistent `401` or `403` responses with the missing
audience, role, or identity rather than hiding them.

## Output contract

Return inputs discovered, the persistence and architecture decisions with their
evidence, defaults applied, and the first grounded result. On the persistent
path, also return the approved plan, staged corpus summary, resource identifiers,
verified AAD-only configuration, ingestion evidence, elapsed setup time, and
cleanup instructions. On the no-persistence path, return the trigger that would
warrant persistence instead, and report no resources.
