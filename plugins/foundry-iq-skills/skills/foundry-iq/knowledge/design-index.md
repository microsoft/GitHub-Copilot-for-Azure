# Design a search index

**Domain:** Knowledge
**Reads:** workload profile — query shape, corpus and content type, entitlement model.

Design from the approved source schema, representative records, intended query
experience, and user-provided evaluation dataset when available. The consumer
does not change this primitive: an index designed for an application boundary
and one designed for an agent's retrieval tool differ only in the query contract
the profile records.

1. Identify a stable unique string key. Map source fields and classify only fields
   needed for search, retrieval, filters, facets, sorting, suggestions, security,
   or consumer display.
2. Apply analyzers based on actual language and token behavior. Do not make large
   content, secrets, or unused metadata retrievable by default.
3. Add vector fields only after selecting an embedding model; derive dimensions
   from that model rather than guessing. Keep original text available for hybrid
   retrieval and citations. A query-time vectorizer embeds queries, not documents:
   populate the document vectors at ingestion — an indexer with an embedding
   skillset, or precomputed vectors on push — or the field stays empty and every
   vector query returns nothing.
4. Configure semantic title, content, and keyword priorities from the schema.
   Select the retrieval configuration with
   `references/architecture-choices.md`; add scoring profiles, synonyms,
   suggesters, or geo fields only when the experience requires them.
5. Produce representative keyword, filter, vector, hybrid, facet, and negative
   queries that exercise the contract.

Schema creation is billable-resource mutation and requires the consolidated
approval. For an existing production index, classify changes as compatible or
breaking. Put breaking changes in a new versioned index and use an alias for
cutover; never drop or silently reinterpret production fields.

Return the field rationale, index and semantic/vector definitions, compatibility
assessment, generated artifact location, query examples, verification results,
and migration or rollback plan.
