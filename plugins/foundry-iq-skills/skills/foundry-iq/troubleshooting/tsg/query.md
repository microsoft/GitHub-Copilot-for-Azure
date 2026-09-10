# Query and retrieval-quality failures

**Domain:** Troubleshooting — lookup guide

Filters, field attributes, vector and hybrid retrieval, semantic ranking, paging, throttling, and agentic retrieval depth.

Loaded by [diagnose-and-repair](../diagnose-and-repair.md) after the failure
family is classified. Do not load every family; load the one that matches.

## How to use this file

1. Find the entry whose **Signature** matches what was actually observed. A
   symptom that merely resembles an entry is not a match.
2. Run the **Discriminator** before doing anything else. It is a read-only check
   that confirms this diagnosis and rules out the **Lookalikes**. If the
   discriminator does not confirm, the entry does not apply — read the lookalikes
   and start again rather than applying the fix anyway.
3. Apply the **Fix** only after the discriminator confirms, and treat the **Risk
   class** as the approval class from `references/defaults-and-approvals.md`.
4. Prove the repair with **Verify**. A symptom that stops reproducing is not
   evidence the cause was addressed.

A symptom match alone never justifies a mutation. Matching a symptom to the
nearest entry and applying its fix is the specific failure this file is
structured to prevent.

`Confidence: documented` means the behavior is stated in the cited Microsoft
source. `Confidence: inferred` means it was reasoned from the source but not
stated verbatim; treat those as hypotheses to confirm, not as facts.

**Review status: documentation-derived, not yet field-reviewed.** Entries trace
to Microsoft documentation and pass structural checks, but no domain expert has
confirmed that a discriminator is genuinely diagnostic or that a stated limit is
current. This is why step 2 is not optional: run the discriminator, and when it
does not confirm, diagnose from evidence instead of applying the nearest fix.

## Symptom index

- [Adding an exact text filter makes the result set empty even though matching documents exist](#adding-an-exact-text-filter-makes-the-result-set-empty-even-though-matching-documents-exist)
- [A filter, sort, facet, highlight, or field-scoped search request is rejected for a field that exists](#a-filter-sort-facet-highlight-or-field-scoped-search-request-is-rejected-for-a-field-that-exists)
- [A document matches, but an expected field is absent from the response](#a-document-matches-but-an-expected-field-is-absent-from-the-response)
- [A collection filter using `search.ismatch` fails even though the expression looks valid](#a-collection-filter-using-searchismatch-fails-even-though-the-expression-looks-valid)
- [Adding a negative search term unexpectedly increases the number of results](#adding-a-negative-search-term-unexpectedly-increases-the-number-of-results)
- [A filtered vector query returns fewer than `k` results—or zero—even though qualifying documents exist](#a-filtered-vector-query-returns-fewer-than-k-resultsor-zeroeven-though-qualifying-documents-exist)
- [A raw-vector query is rejected because its vector length doesn't match the field](#a-raw-vector-query-is-rejected-because-its-vector-length-doesnt-match-the-field)
- [A `kind:"text"` vector query reports that no vectorizer is available or returns no matches](#a-kindtext-vector-query-reports-that-no-vectorizer-is-available-or-returns-no-matches)
- [Vector search executes successfully but relevance collapses after changing embedding configuration](#vector-search-executes-successfully-but-relevance-collapses-after-changing-embedding-configuration)
- [Semantic search returns documents but no reranker score, captions, or answers](#semantic-search-returns-documents-but-no-reranker-score-captions-or-answers)
- [Hybrid search ranks worse than either the text or vector query run alone](#hybrid-search-ranks-worse-than-either-the-text-or-vector-query-run-alone)
- [Deep paging fails when `$skip` exceeds 100,000](#deep-paging-fails-when-skip-exceeds-100000)
- [Query traffic intermittently receives HTTP 429 or 503 under load](#query-traffic-intermittently-receives-http-429-or-503-under-load)
- [Agentic retrieval gives shallow results for complex or multi-part questions](#agentic-retrieval-gives-shallow-results-for-complex-or-multi-part-questions)

## Evaluation design coverage

These fault identifiers are priority inputs for future real-service Vally
scenarios. Their presence here is not evidence that the diagnosis path has run.

- `VECTOR_DIMENSION_MISMATCH` — [A raw-vector query is rejected because its vector length doesn't match the field](#a-raw-vector-query-is-rejected-because-its-vector-length-doesnt-match-the-field)

### Adding an exact text filter makes the result set empty even though matching documents exist

**Observed where:** Query response, portal Search Explorer, evaluation metrics
**Signature:** HTTP 200 with zero results after adding `$filter`; the unfiltered query returns the expected documents.
**Discriminator:** Run `search=*`, `count=true`, and the filter using the field’s complete stored value with identical casing. If `Category eq 'Sunny day'` matches but `Category eq 'sunny'` or `'Sunny'` does not, exact, case-sensitive filter semantics confirm the diagnosis. Also verify `fields[].filterable=true` with Get Index.
**Causes (ranked):** 1. String filters aren't lexically analyzed or word-broken. 2. Case differs from the indexed value. 3. The application supplied a token or substring instead of the complete value.
**Fix:** Send the complete value with matching case. A normalizer can provide case-insensitive filtering, but assigning one to an existing field can require a new field or index rebuild.
**Risk class:** `requires reindex`
**Verify:** The same query plus the corrected filter returns the known document key and a nonzero count.
**Lookalikes:** A nonfilterable field normally makes the query invalid rather than producing a valid empty set; Get Index distinguishes it. A vector postfilter false negative is distinguished by running the same request with `vectorFilterMode=preFilter`.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-filters
**Confidence:** `documented`

### A filter, sort, facet, highlight, or field-scoped search request is rejected for a field that exists

**Observed where:** SDK exception, REST response, portal Search Explorer
**Signature:** Query validation failure when the field is referenced; no exact error string is asserted here.
**Discriminator:** Call Get Index and inspect the target field: filters require `filterable=true`, `$orderby` requires `sortable=true`, facets require `facetable=true`, and full-text search/highlighting requires `searchable=true`. A false attribute matching the failed operation confirms the diagnosis.
**Causes (ranked):** 1. Azure SDK field attributes defaulted off because they weren't explicitly enabled. 2. The schema intentionally disabled the capability to reduce storage. 3. A collection field was incorrectly expected to support sorting.
**Fix:** Add a replacement field with the required attribute or rebuild the index with corrected attributes and reload data. Existing `searchable`, `filterable`, `sortable`, and `facetable` attributes can't be changed.
**Risk class:** `requires reindex`
**Verify:** Get Index shows the required attribute enabled, and the previously rejected read-only query succeeds.
**Lookalikes:** `retrievable=false` only hides a field from results and can be changed without rebuilding. Invalid OData syntax still fails when the schema attribute is correct.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-how-to-create-search-index
**Confidence:** `documented`

### A document matches, but an expected field is absent from the response

**Observed where:** Query response or SDK result object
**Signature:** The document key appears, but the expected field is omitted or unavailable through `select`.
**Discriminator:** Get Index and inspect `fields[].retrievable`; then rerun without `select`. If the field remains absent and `retrievable=false`, retrieval attribution is the cause. If it appears without `select`, the original `select` list caused the omission.
**Causes (ranked):** 1. `select` omitted the field. 2. `retrievable=false`. 3. The indexed document has a null or absent value.
**Fix:** Add the field to `select`, or update the existing field to `retrievable=true`. Unlike search/filter/sort/facet attributes, `retrievable` can be changed without rebuilding.
**Risk class:** `config-only, reversible`
**Verify:** The known document is returned with the field and its expected value.
**Lookalikes:** Missing source data produces null/absence even when `retrievable=true`; Lookup Document distinguishes it. A nonsearchable field can still be returned if retrievable.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-how-to-create-search-index
**Confidence:** `documented`

### A collection filter using `search.ismatch` fails even though the expression looks valid

**Observed where:** REST error, SDK exception, portal Search Explorer
**Signature:** `"The function 'ismatch' has no parameters bound to the range variable 's'. Only bound field references are supported inside lambda expressions ('any' or 'all'). However, you can change your filter so that the 'ismatch' function is outside the lambda expression and try again."`
**Discriminator:** Inspect the filter for `search.ismatch` or `search.ismatchscoring` inside `collection/any(...)` or `collection/all(...)`. Its presence inside the lambda confirms this diagnosis.
**Causes (ranked):** 1. Full-text search functions are unsupported inside collection lambdas. 2. A complex collection lambda references a field not bound to its current range variable. 3. Primitive collection Boolean form violates the type-specific `any`/`all` rules.
**Fix:** Move `search.ismatch[scoring]` outside the lambda and combine it with the collection predicate at top level. For primitive collections, rewrite to the documented equality/inequality and DNF/CNF forms.
**Risk class:** `config-only, reversible`
**Verify:** The rewritten filter returns HTTP 200 and the expected document keys.
**Lookalikes:** A nonfilterable collection field fails before lambda semantics matter; Get Index distinguishes it. A malformed `not` expression has a different documented incompatible-type error.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-query-troubleshoot-collection-filters
**Confidence:** `documented`

### Adding a negative search term unexpectedly increases the number of results

**Observed where:** Query response or relevance evaluation
**Signature:** With default `searchMode=any`, a query such as `pool -ocean` matches documents containing `pool` **or** documents not containing `ocean`.
**Discriminator:** Run the identical simple-syntax query twice with `searchMode=any` and `searchMode=all`. If `all` changes the behavior to “pool AND NOT ocean” and sharply reduces the count, this diagnosis is confirmed.
**Causes (ranked):** 1. `searchMode=any` interprets `-term` as `OR NOT`. 2. The caller omitted `searchMode`, whose default is `any`.
**Fix:** Set `searchMode=all` for searches where negative terms should be conjunctive.
**Risk class:** `config-only, reversible`
**Verify:** No returned document contains the excluded term, and every result satisfies the positive criteria.
**Lookalikes:** Analyzer differences can make the excluded term tokenize differently; the Analyze API distinguishes that. OData `not` follows separate precedence rules.
**Source:** https://learn.microsoft.com/en-us/azure/search/query-simple-syntax
**Confidence:** `documented`

### A filtered vector query returns fewer than `k` results—or zero—even though qualifying documents exist

**Observed where:** Vector query response or recall evaluation
**Signature:** `postFilter` or `strictPostFilter` returns fewer than `k`; `strictPostFilter` can return zero for selective filters or small `k`.
**Discriminator:** Rerun the same read-only request with `vectorFilterMode=preFilter`. If expected filtered documents appear, while the filter itself also succeeds under `search=*`, postfilter false negatives are confirmed.
**Causes (ranked):** 1. `strictPostFilter` filters only the unfiltered global top `k`. 2. `postFilter` filters each shard's unfiltered local top `k`. 3. A small `k` combined with a selective filter.
**Fix:** Use `preFilter` when recall matters. If postfiltering is required for latency, increase `k` and use `top` to limit the response.
**Risk class:** `config-only, reversible`
**Verify:** `preFilter` returns `k` qualifying results when at least `k` exist, and all satisfy the filter.
**Lookalikes:** An incorrect exact-match filter remains empty under `preFilter`. A vector similarity threshold can also reduce results below `k`; remove `threshold` to distinguish it.
**Source:** https://learn.microsoft.com/en-us/azure/search/vector-search-filters
**Confidence:** `documented`

### A raw-vector query is rejected because its vector length doesn't match the field

**Observed where:** REST error or SDK exception
**Signature:** Query failure reporting a vector dimension mismatch; no exact service message is asserted.
**Discriminator:** Count the submitted `vectorQueries[].vector` elements and compare that number with Get Index `fields[].dimensions` for the targeted field. Unequal values confirm the diagnosis.
**Causes (ranked):** 1. The query uses a different embedding deployment or dimension setting. 2. The embedding model was upgraded without updating query configuration. 3. The application concatenated multiple embeddings.
**Fix:** Generate the query embedding with the model and dimensions expected by the existing field. If the field dimension itself is wrong, create/rebuild the index and regenerate document embeddings.
**Risk class:** `requires reindex`
**Verify:** The vector length equals `fields[].dimensions`, and the query returns up to `k` neighbors.
**Lookalikes:** A missing vectorizer/profile affects `kind:"text"` queries even when dimensions are correct. Same-length embeddings from a different model execute but generally produce poor relevance rather than a dimension error.
**Source:** https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-configure-vectorizer
**Confidence:** `documented`

### A `kind:"text"` vector query reports that no vectorizer is available or returns no matches

**Observed where:** REST error, SDK exception, or vector query response
**Signature:** Documented categories are **“Vectorizer not found”** or **“Empty results”**; no longer exact error sentence is asserted.
**Discriminator:** Get Index and trace the full chain: target field `searchable=true` and `vectorSearchProfile=<P>`; `vectorSearch.profiles[name=P].vectorizer=<V>`; and `vectorSearch.vectorizers[name=V]` exists. A broken link confirms the diagnosis.
**Causes (ranked):** 1. Profile references a nonexistent vectorizer name. 2. The field points to the wrong profile. 3. `fields` targets a nonvector or nonsearchable vector field.
**Fix:** Add or correct the named vectorizer and its profile reference while preserving the field's existing algorithm/profile where possible. Use `kind:"vector"` with a client-generated vector if integrated vectorization isn't intended.
**Risk class:** `config-only, reversible`
**Verify:** A test `kind:"text"` query with `k:3` returns three similarity-ranked documents.
**Lookalikes:** If the chain is valid but generated dimensions differ from the field, it is a dimension mismatch. HTTP 401/403 or 429 from the embedding provider indicates model access or provider throttling instead.
**Source:** https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-configure-vectorizer
**Confidence:** `documented`

### Vector search executes successfully but relevance collapses after changing embedding configuration

**Observed where:** Offline relevance metrics, top-`k` inspection, or hybrid arm comparison
**Signature:** The query still returns `k` neighbors, but similarity scores and judged relevance are poor despite a dimension-compatible vector.
**Discriminator:** Compare the index-time embedding skill/application model and dimensions with the query-time vectorizer/application deployment. Then A/B the same query using the original model. A recovery only with the original model confirms incompatible embedding spaces.
**Causes (ranked):** 1. Query and document embeddings came from different models. 2. Multiple targeted vector fields were produced by different models. 3. The similarity metric doesn't match the embedding model.
**Fix:** Use the same model and dimension configuration at index and query time. If indexed vectors were produced by the wrong model, regenerate them and reindex; Azure OpenAI embeddings should use cosine similarity.
**Risk class:** `requires reindex`
**Verify:** A held-out relevance set recovers expected recall/precision, and every queried field uses embeddings from the same model as the query.
**Lookalikes:** Dimension mismatch fails instead of merely degrading quality. Approximate HNSW recall is distinguished by rerunning with `exhaustive:true`; filter false negatives are distinguished with `preFilter`.
**Source:** https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-query
**Confidence:** `inferred`

### Semantic search returns documents but no reranker score, captions, or answers

**Observed where:** Query response or portal Search Explorer
**Signature:** Ordinary `value` results are present, but `@search.rerankerScore` and `@search.captions` are absent and `@search.answers` is absent or empty.
**Discriminator:** Inspect the request. If `search` is `*`/empty, or neither `queryType:"semantic"` nor `semanticQuery` is set, semantic processing wasn't invoked. Also verify that the named `semanticConfiguration` exists in Get Index.
**Causes (ranked):** 1. `search=*` or an empty query provides nothing to rank semantically. 2. Semantic ranking wasn't enabled in the request. 3. The semantic configuration is missing or mismatched. 4. Captions/answers weren't explicitly requested.
**Fix:** Supply a nonempty plain-text query, enable semantic ranking, specify the existing semantic configuration, and request `captions:"extractive"` or `answers:"extractive"`.
**Risk class:** `config-only, reversible`
**Verify:** Results include `@search.rerankerScore`; requested captions appear. For answers, use a question whose configured semantic fields contain answer-like verbatim text.
**Lookalikes:** If reranker scores and captions exist but `@search.answers: []`, semantic ranking worked—the corpus/query lacked a sufficiently confident answer. An `orderby` with semantic ranking produces HTTP 400 rather than silently omitting semantic output.
**Source:** https://learn.microsoft.com/en-us/azure/search/semantic-how-to-query-request
https://learn.microsoft.com/en-us/azure/search/semantic-answers
**Confidence:** `documented`

### Hybrid search ranks worse than either the text or vector query run alone

**Observed where:** Relevance evaluation metrics or top-results comparison
**Signature:** The combined ranking differs substantially from either arm; hybrid `@search.score` values aren't comparable to standalone BM25 or vector scores.
**Discriminator:** Run three read-only requests: text-only, vector-only, and hybrid with `debug:"all"`. Inspect per-arm subscores and ranks. If relevant documents enter one candidate list but lose during RRF—or never enter because of small `k`/text recall—the fusion configuration is the cause.
**Causes (ranked):** 1. Unbalanced candidate windows (`k` versus `maxTextRecallSize`). 2. Vector `weight` over- or under-emphasizes an arm. 3. Multiple vector queries/fields each contribute a separate RRF list. 4. Semantic ranking receives fewer than 50 vector candidates.
**Fix:** Tune one variable at a time: use `k` around 30–50, use `k=50` with semantic ranking, adjust positive vector weights, and cautiously tune preview `maxTextRecallSize`.
**Risk class:** `config-only, reversible`
**Verify:** The target evaluation metric exceeds or matches the better standalone arm, and debug subscores show useful contributions from both arms.
**Lookalikes:** Embedding-model mismatch makes the vector arm poor even standalone. A scoring profile can alter initial and final semantic order; inspect `@search.rerankerBoostedScore`.
**Source:** https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking
https://learn.microsoft.com/en-us/azure/search/hybrid-search-how-to-query
**Confidence:** `documented`

### Deep paging fails when `$skip` exceeds 100,000

**Observed where:** REST error or SDK exception
**Signature:** The Search API documents: `"This value cannot be greater than 100,000."`
**Discriminator:** Inspect the effective `skip` value. A value above 100,000 confirms the limit; values within the limit point elsewhere.
**Causes (ranked):** 1. Page-number pagination multiplied into a `skip` above 100,000. 2. The application is attempting to scan the index using offset pagination.
**Fix:** Page by a totally ordered unique field using `orderby` plus a range filter based on the last returned value. Use an existing `filterable` and `sortable` unique field; adding those attributes to an existing field requires a new field or rebuild.
**Risk class:** `requires reindex`
**Verify:** Sequential pages continue beyond the former offset without using `skip>100000`, and document keys don't repeat in a stable index.
**Lookalikes:** Duplicate pages with legal `skip` values can occur when documents change between independent page requests. High but legal `skip` can cause latency without crossing the hard limit.
**Source:** https://learn.microsoft.com/en-us/rest/api/searchservice/documents/search-post?view=rest-searchservice-2026-04-01
https://learn.microsoft.com/en-us/azure/search/search-pagination-page-layout
**Confidence:** `documented`

### Query traffic intermittently receives HTTP 429 or 503 under load

**Observed where:** SDK exceptions, HTTP telemetry, Azure Monitor, load-test results
**Signature:** HTTP `429 Too Many Requests` or increasing HTTP `503 Service unavailable` frequency during query load.
**Discriminator:** Correlate failures with query QPS/latency and service capacity. If rates fall when request concurrency or query complexity is reduced, the search service is saturated. For integrated vectorization, inspect logs to determine whether the 429 came from Azure AI Search or the embedding provider.
**Causes (ranked):** 1. Insufficient replicas/search units for query throughput. 2. Expensive hybrid, vector, semantic, wildcard, regex, facet, or high-`skip` queries. 3. Semantic-ranker concurrent-request queue exhaustion. 4. Azure OpenAI vectorizer quota exhaustion.
**Fix:** Retry transient failures with bounded exponential backoff; reduce expensive query settings and concurrency first. Add replicas/search units if throttling persists. For vectorizer-originated 429s, reduce model request rate or raise the provider's TPM quota.
**Risk class:** `config-only, reversible`
**Verify:** Under the same representative load, 429/503 rates meet the target and p95/p99 latency stabilizes without dropped requests.
**Lookalikes:** Authentication failures are persistent 401/403, not load-correlated. A malformed query consistently returns 400. Provider 429s are identified in vectorizer diagnostics rather than search-service saturation metrics.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-capacity-planning
https://learn.microsoft.com/en-us/azure/search/search-limits-quotas-capacity
https://learn.microsoft.com/en-us/azure/search/hybrid-search-how-to-query
**Confidence:** `documented`

### Agentic retrieval gives shallow results for complex or multi-part questions

**Observed where:** Knowledge-base retrieve response, activity log, or grounded-answer evaluation
**Signature:** The response uses direct retrieval without decomposition, or only one planning pass, despite a question requiring multiple focused searches.
**Discriminator:** Get the knowledge base and inspect `retrievalReasoningEffort`; call retrieve with `includeActivity:true`. `minimal` has no `modelQueryPlanning` activity and searches every source directly; `low` shows one planning pass; `medium` can show a classifier-triggered second iteration with revised queries.
**Causes (ranked):** 1. `minimal` disables LLM query planning and expansion. 2. `low` performs only one planning pass. 3. The request overrides the knowledge-base default. 4. The application expects an index scoring profile, which agentic retrieve doesn't apply.
**Fix:** On API `2026-05-01-preview`, override or update `retrievalReasoningEffort` to `low` or `medium` based on measured quality, latency, and cost. Use `minimal` only for direct/predictable retrieval.
**Risk class:** `config-only, reversible`
**Verify:** Activity shows the intended effort and planning behavior; a complex-query evaluation set improves without exceeding latency and token budgets.
**Lookalikes:** Wrong source selection appears directly in source-specific activity records. If direct `/docs/search` honors a scoring profile but knowledge-base retrieve does not, that difference is documented agentic behavior, not insufficient reasoning effort.
**Source:** https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-set-retrieval-reasoning-effort
https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve
**Confidence:** `documented`

## Known gaps

These failures are believed to occur in the field but could not be verified from
documentation. They are recorded rather than guessed at.
Do not synthesize an entry for them; fill them from real support data.

- Exact service error text for referencing nonsearchable, nonfilterable, nonsortable, or nonfacetable fields wasn't verified.
- Exact raw-vector dimension-mismatch error wording wasn't verified.
- Query-time behavior for documents containing null or empty vector fields across all supported API versions wasn't verified.
- Exact `Retry-After` behavior for every query-time 429/503 path wasn't verified.
