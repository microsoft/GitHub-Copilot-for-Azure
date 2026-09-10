# Ingest and synchronize source data

**Domain:** Knowledge
**Reads:** workload profile — corpus and content type, freshness, environment and policy.

Choose the ingestion model from source capability and freshness:

- Use an indexer for a supported Azure source when scheduled refresh, change
  tracking, AI enrichment, or integrated vectorization is required.
- Use the push API for arbitrary sources, application-owned transforms, event
  updates, or near-real-time synchronization.

When the index has a vector field, the ingestion model decides what embeds the
documents, and this is the step most often skipped. A query-time vectorizer
embeds the query only — it never populates stored document vectors. The indexer
path vectorizes documents server-side only when a skillset with an embedding step
is attached (integrated vectorization); the push path never vectorizes, so you
must compute each document's embedding with the same model and dimensions as the
field and include it in the uploaded document. An index whose documents were
pushed without vectors, or configured with a vectorizer but no document-embedding
step, has an empty vector column: keyword and semantic queries still return rows,
but every pure vector query returns nothing. Prefer the indexer-plus-skillset
path so documents and queries share one server-side embedding definition.

Ask for the approved source boundary and freshness objective only when they cannot
be inferred. Before reading private data, uploading content, creating connections,
or granting roles, include those actions in the consolidated approval.

## Execute

1. Validate source keys, required fields, representative records, delete behavior,
   and expected volume before loading.
2. Make transforms deterministic and retain source identifiers for troubleshooting
   and citations.
3. For indexers, configure incremental change/delete tracking and a schedule; use
   hourly refresh for ordinary document corpora when no stronger requirement
   exists. For push ingestion, batch within service limits, honor per-document
   outcomes and retry delays, and checkpoint successful writes.
4. Never log secrets or document contents. Report rejected document keys with
   sanitized diagnostics.
5. Rerun idempotently and verify document counts, failures, sample field
   mappings, deletes, and observed freshness. When the index has a vector field,
   prove the vector column is actually populated: run a pure vector query — query
   text embedded to a vector, or sent through the vectorizer, with no keyword
   text — and confirm an expected document returns. A hybrid or semantic check
   alone passes on keyword match and hides an empty vector column, so it is not
   sufficient evidence that vectorization works.

Return the selected model and rationale, source scope, schedule or trigger,
artifacts changed, loaded/failed/deleted counts, freshness evidence, safe retry
point, and rollback.
