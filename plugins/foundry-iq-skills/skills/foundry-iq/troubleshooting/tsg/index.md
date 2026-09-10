# Troubleshooting guide index

**Domain:** Troubleshooting — lookup guide

Every symptom the guide covers, in one place. Scan this file first, identify a
candidate, then open only the family file that contains it.

This index is generated from the entries themselves, and a contract test asserts
the two stay in sync. Do not edit it by hand.

Risk class is the approval class the repair would carry, so an obviously
expensive fix can be recognized before the full entry is loaded.

Entries are documentation-derived and not yet field-reviewed. Run the
discriminator in the entry before repairing anything.

| Symptom | Family | Risk class if repaired |
|---|---|---|
| [Cosmos DB indexer reports success, but container contents are missing](ingestion.md#cosmos-db-indexer-reports-success-but-container-contents-are-missing) | `ingestion` | `requires reindex` |
| [New or changed documents are skipped after an apparently successful incremental run](ingestion.md#new-or-changed-documents-are-skipped-after-an-apparently-successful-incremental-run) | `ingestion` | `requires reindex` |
| [Documents deleted from Blob Storage remain in the search index](ingestion.md#documents-deleted-from-blob-storage-remain-in-the-search-index) | `ingestion` | `requires reindex` |
| [Blob documents fail because the blob URL is used directly as the document key](ingestion.md#blob-documents-fail-because-the-blob-url-is-used-directly-as-the-document-key) | `ingestion` | `requires reindex` |
| [Individual documents fail because no key value is produced](ingestion.md#individual-documents-fail-because-no-key-value-is-produced) | `ingestion` | `requires reindex` |
| [Documents fail with a source-to-index field type mismatch](ingestion.md#documents-fail-with-a-source-to-index-field-type-mismatch) | `ingestion` | `breaking schema change` |
| [Blob indexing fails during content extraction](ingestion.md#blob-indexing-fails-during-content-extraction) | `ingestion` | `requires reindex` |
| [Skillset runs, but expected enriched fields are empty](ingestion.md#skillset-runs-but-expected-enriched-fields-are-empty) | `ingestion` | `requires reindex` |
| [A custom Web API skill repeatedly times out](ingestion.md#a-custom-web-api-skill-repeatedly-times-out) | `ingestion` | `config-only, reversible` |
| [Cosmos DB indexer repeatedly restarts a large custom query instead of resuming](ingestion.md#cosmos-db-indexer-repeatedly-restarts-a-large-custom-query-instead-of-resuming) | `ingestion` | `config-only, reversible` |
| [Azure SQL serverless indexer fails once with error code 40613](ingestion.md#azure-sql-serverless-indexer-fails-once-with-error-code-40613) | `ingestion` | `config-only, reversible` |
| [Documents fail while being written to an overloaded search index](ingestion.md#documents-fail-while-being-written-to-an-overloaded-search-index) | `ingestion` | `config-only, reversible` |
| [Scheduled indexer stops creating execution-history entries](ingestion.md#scheduled-indexer-stops-creating-execution-history-entries) | `ingestion` | `config-only, reversible` |
| [Large Blob indexer appears stuck with zero documents processed](ingestion.md#large-blob-indexer-appears-stuck-with-zero-documents-processed) | `ingestion` | `config-only, reversible` |
| [SQL incremental indexing silently misses concurrently updated rows](ingestion.md#sql-incremental-indexing-silently-misses-concurrently-updated-rows) | `ingestion` | `breaking schema change` |
| [Adding an exact text filter makes the result set empty even though matching documents exist](query.md#adding-an-exact-text-filter-makes-the-result-set-empty-even-though-matching-documents-exist) | `query` | `requires reindex` |
| [A filter, sort, facet, highlight, or field-scoped search request is rejected for a field that exists](query.md#a-filter-sort-facet-highlight-or-field-scoped-search-request-is-rejected-for-a-field-that-exists) | `query` | `requires reindex` |
| [A document matches, but an expected field is absent from the response](query.md#a-document-matches-but-an-expected-field-is-absent-from-the-response) | `query` | `config-only, reversible` |
| [A collection filter using `search.ismatch` fails even though the expression looks valid](query.md#a-collection-filter-using-searchismatch-fails-even-though-the-expression-looks-valid) | `query` | `config-only, reversible` |
| [Adding a negative search term unexpectedly increases the number of results](query.md#adding-a-negative-search-term-unexpectedly-increases-the-number-of-results) | `query` | `config-only, reversible` |
| [A filtered vector query returns fewer than `k` results—or zero—even though qualifying documents exist](query.md#a-filtered-vector-query-returns-fewer-than-k-resultsor-zeroeven-though-qualifying-documents-exist) | `query` | `config-only, reversible` |
| [A raw-vector query is rejected because its vector length doesn't match the field](query.md#a-raw-vector-query-is-rejected-because-its-vector-length-doesnt-match-the-field) | `query` | `requires reindex` |
| [A `kind:"text"` vector query reports that no vectorizer is available or returns no matches](query.md#a-kindtext-vector-query-reports-that-no-vectorizer-is-available-or-returns-no-matches) | `query` | `config-only, reversible` |
| [Vector search executes successfully but relevance collapses after changing embedding configuration](query.md#vector-search-executes-successfully-but-relevance-collapses-after-changing-embedding-configuration) | `query` | `requires reindex` |
| [Semantic search returns documents but no reranker score, captions, or answers](query.md#semantic-search-returns-documents-but-no-reranker-score-captions-or-answers) | `query` | `config-only, reversible` |
| [Hybrid search ranks worse than either the text or vector query run alone](query.md#hybrid-search-ranks-worse-than-either-the-text-or-vector-query-run-alone) | `query` | `config-only, reversible` |
| [Deep paging fails when `$skip` exceeds 100,000](query.md#deep-paging-fails-when-skip-exceeds-100000) | `query` | `requires reindex` |
| [Query traffic intermittently receives HTTP 429 or 503 under load](query.md#query-traffic-intermittently-receives-http-429-or-503-under-load) | `query` | `config-only, reversible` |
| [Agentic retrieval gives shallow results for complex or multi-part questions](query.md#agentic-retrieval-gives-shallow-results-for-complex-or-multi-part-questions) | `query` | `config-only, reversible` |
| [A bearer-token data-plane request is denied even though a Search role is assigned](identity.md#a-bearer-token-data-plane-request-is-denied-even-though-a-search-role-is-assigned) | `identity` | `config-only, reversible` |
| [A bearer-token request returns 401, or 403 when the service is configured to suppress bearer challenges](identity.md#a-bearer-token-request-returns-401-or-403-when-the-service-is-configured-to-suppress-bearer-challenges) | `identity` | `config-only, reversible` |
| [A valid identity gets 403 only for a particular Search operation](identity.md#a-valid-identity-gets-403-only-for-a-particular-search-operation) | `identity` | `permission change` |
| [A role is visible in IAM, but the application still gets 403 because it authenticates as another principal](identity.md#a-role-is-visible-in-iam-but-the-application-still-gets-403-because-it-authenticates-as-another-principal) | `identity` | `permission change` |
| [A role is assigned to the correct identity but the target service or index still returns 403](identity.md#a-role-is-assigned-to-the-correct-identity-but-the-target-service-or-index-still-returns-403) | `identity` | `permission change` |
| [A newly assigned role still returns 401 or 403](identity.md#a-newly-assigned-role-still-returns-401-or-403) | `identity` | `config-only, reversible` |
| [An API-key client stops working after the service is changed to roles-only](identity.md#an-api-key-client-stops-working-after-the-service-is-changed-to-roles-only) | `identity` | `config-only, reversible` |
| [An indexer cannot read its Azure Storage data source when managed identity authentication is configured](identity.md#an-indexer-cannot-read-its-azure-storage-data-source-when-managed-identity-authentication-is-configured) | `identity` | `permission change` |
| [A managed-identity Storage indexer still gets 403 only when the storage firewall is enabled](identity.md#a-managed-identity-storage-indexer-still-gets-403-only-when-the-storage-firewall-is-enabled) | `identity` | `network change` |
| [A security-filter query succeeds but returns zero documents for a user who should have matches](identity.md#a-security-filter-query-succeeds-but-returns-zero-documents-for-a-user-who-should-have-matches) | `identity` | `requires reindex` |
| [An ACL-enabled query returns only public documents or zero documents although the application can query the index](identity.md#an-acl-enabled-query-returns-only-public-documents-or-zero-documents-although-the-application-can-query-the-index) | `identity` | `config-only, reversible` |
| [ACL-protected results are missing or still visible after source permissions changed](identity.md#acl-protected-results-are-missing-or-still-visible-after-source-permissions-changed) | `identity` | `requires reindex` |
| [An inbound private endpoint exists, but the indexer still cannot reach private Storage or another data source](network.md#an-inbound-private-endpoint-exists-but-the-indexer-still-cannot-reach-private-storage-or-another-data-source) | `network` | `network change` |
| [A shared private link exists, but private indexer runs remain transient failures](network.md#a-shared-private-link-exists-but-private-indexer-runs-remain-transient-failures) | `network` | `network change` |
| [Clients in the VNet cannot use a newly created inbound private endpoint](network.md#clients-in-the-vnet-cannot-use-a-newly-created-inbound-private-endpoint) | `network` | `network change` |
| [The search hostname resolves to a public IP despite an inbound private endpoint](network.md#the-search-hostname-resolves-to-a-public-ip-despite-an-inbound-private-endpoint) | `network` | `network change` |
| [A previously working client now receives 403 after search public access was restricted](network.md#a-previously-working-client-now-receives-403-after-search-public-access-was-restricted) | `network` | `network change` |
| [An indexer cannot reach a target protected by an IP firewall](network.md#an-indexer-cannot-reach-a-target-protected-by-an-ip-firewall) | `network` | `network change` |
| [The Azure Storage trusted-service exception is enabled, but the indexer still cannot read data](network.md#the-azure-storage-trusted-service-exception-is-enabled-but-the-indexer-still-cannot-read-data) | `network` | `network change` |
| [Queries, indexers, or model calls fail immediately after NSP is switched to enforced mode](network.md#queries-indexers-or-model-calls-fail-immediately-after-nsp-is-switched-to-enforced-mode) | `network` | `network change` |
| [Search service creation is blocked because the subscription-region-tier quota is exhausted](network.md#search-service-creation-is-blocked-because-the-subscription-region-tier-quota-is-exhausted) | `network` | `config-only, reversible` |
| [A region or pricing tier is absent, or deployment fails despite available quota](network.md#a-region-or-pricing-tier-is-absent-or-deployment-fails-despite-available-quota) | `network` | `config-only, reversible` |
| [Deployment fails because the Microsoft.Search resource provider is not registered](network.md#deployment-fails-because-the-microsoftsearch-resource-provider-is-not-registered) | `network` | `permission change` |
| [Deployment is denied by organizational policy](network.md#deployment-is-denied-by-organizational-policy) | `network` | `permission change` |
| [Creating objects, indexing, scaling, or changing tier fails at a service limit](network.md#creating-objects-indexing-scaling-or-changing-tier-fails-at-a-service-limit) | `network` | `config-only, reversible` |
| [A CMK-encrypted index becomes unusable or blocks service scaling](network.md#a-cmk-encrypted-index-becomes-unusable-or-blocks-service-scaling) | `network` | `permission change` |
