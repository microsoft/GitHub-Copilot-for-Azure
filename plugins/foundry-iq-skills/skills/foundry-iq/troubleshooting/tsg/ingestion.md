# Ingestion and indexing failures

**Domain:** Troubleshooting — lookup guide

Indexer execution, document-level failures, data-source connectivity, change and deletion detection, field mappings, skillsets, and document keys.

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

- [Cosmos DB indexer reports success, but container contents are missing](#cosmos-db-indexer-reports-success-but-container-contents-are-missing)
- [New or changed documents are skipped after an apparently successful incremental run](#new-or-changed-documents-are-skipped-after-an-apparently-successful-incremental-run)
- [Documents deleted from Blob Storage remain in the search index](#documents-deleted-from-blob-storage-remain-in-the-search-index)
- [Blob documents fail because the blob URL is used directly as the document key](#blob-documents-fail-because-the-blob-url-is-used-directly-as-the-document-key)
- [Individual documents fail because no key value is produced](#individual-documents-fail-because-no-key-value-is-produced)
- [Documents fail with a source-to-index field type mismatch](#documents-fail-with-a-source-to-index-field-type-mismatch)
- [Blob indexing fails during content extraction](#blob-indexing-fails-during-content-extraction)
- [Skillset runs, but expected enriched fields are empty](#skillset-runs-but-expected-enriched-fields-are-empty)
- [A custom Web API skill repeatedly times out](#a-custom-web-api-skill-repeatedly-times-out)
- [Cosmos DB indexer repeatedly restarts a large custom query instead of resuming](#cosmos-db-indexer-repeatedly-restarts-a-large-custom-query-instead-of-resuming)
- [Azure SQL serverless indexer fails once with error code 40613](#azure-sql-serverless-indexer-fails-once-with-error-code-40613)
- [Documents fail while being written to an overloaded search index](#documents-fail-while-being-written-to-an-overloaded-search-index)
- [Scheduled indexer stops creating execution-history entries](#scheduled-indexer-stops-creating-execution-history-entries)
- [Large Blob indexer appears stuck with zero documents processed](#large-blob-indexer-appears-stuck-with-zero-documents-processed)
- [SQL incremental indexing silently misses concurrently updated rows](#sql-incremental-indexing-silently-misses-concurrently-updated-rows)

## Evaluation design coverage

These fault identifiers are priority inputs for future real-service Vally
scenarios. Their presence here is not evidence that the diagnosis path has run.

- `INDEXER_BUSY` — [Large Blob indexer appears stuck with zero documents processed](#large-blob-indexer-appears-stuck-with-zero-documents-processed)

### Cosmos DB indexer reports success, but container contents are missing

**Observed where:** Indexer execution history and the target index
**Signature:** The indexer returns a successful state without indexing the expected Azure Cosmos DB items.
**Discriminator:** Read the container’s Cosmos DB indexing policy. `indexingMode: "None"` confirms this diagnosis; `"Consistent"` rules it out. Also inspect the data source `container.query` to exclude a query that filters out all items.
**Causes (ranked):** 1. Automatic Cosmos DB indexing is disabled. 2. The container uses `Lazy` indexing. 3. The data source query excludes the items.
**Fix:** Set the Cosmos DB indexing policy to `Consistent`, wait for policy transformation to complete, then reset and run the search indexer. Requires reindexing.
**Risk class:** `requires reindex`
**Verify:** The next execution has `itemsProcessed > 0`, `itemsFailed == 0`, and a Lookup Document request returns a known source item.
**Lookalikes:** A normal incremental run with no changes also reports `0/0`; distinguish it by confirming an earlier successful population and valid `initialTrackingState`/`finalTrackingState`. A future high-water mark is distinguished by inspecting those tracking-state fields.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-troubleshooting#missing-content-from-azure-cosmos-db
**Confidence:** `documented`

### New or changed documents are skipped after an apparently successful incremental run

**Observed where:** Target index and Get Indexer Status response
**Signature:** Expected source documents are absent without document-level errors.
**Discriminator:** Inspect `executionHistory[0].initialTrackingState` and `finalTrackingState` from Get Indexer Status and compare the represented high-water-mark timestamp with source values. A tracking value in the future relative to skipped rows confirms this diagnosis.
**Causes (ranked):** 1. High-water-mark value advanced into the future. 2. Source updates did not increase the configured high-water-mark column. 3. The wrong column was selected for change detection.
**Fix:** Correct the source timestamps/change-detection configuration, then reset and run the indexer. Reset clears the internal high-water mark and causes full reprocessing.
**Risk class:** `requires reindex`
**Verify:** The reset run processes the formerly skipped records, and Lookup Document returns a known affected key.
**Lookalikes:** Field mappings or enrichment can place content somewhere unexpected; distinguish those by looking up the key and inspecting its fields. Cosmos DB indexing disabled is distinguished by `indexingMode: "None"`.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-troubleshooting#missing-documents
https://learn.microsoft.com/en-us/azure/search/search-howto-run-reset-indexers#reset-indexers
**Confidence:** `documented`

### Documents deleted from Blob Storage remain in the search index

**Observed where:** Target-index Lookup Document or search results
**Signature:** A search document remains after its corresponding blob was physically deleted.
**Discriminator:** GET the data source and inspect `dataDeletionDetectionPolicy`. `null`, a policy added only after initial indexing, or native soft delete combined with Storage blob versioning confirms that automatic deletion cannot cover the orphan.
**Causes (ranked):** 1. No deletion-detection policy existed before the first run. 2. The blob was physically deleted before the indexer observed its soft-deleted state. 3. Soft-delete retention is shorter than the indexer interval. 4. Blob versioning is enabled with native soft delete.
**Fix:** Explicitly delete known orphan keys through the Documents API. For systemic cleanup, create a new index/indexer with deletion detection configured from its first run; keep soft-delete retention comfortably longer than the schedule interval.
**Risk class:** `requires reindex`
**Verify:** Lookup Document no longer returns the deleted key, and a later soft-deleted test blob is removed by the scheduled indexer before retention expires.
**Lookalikes:** A changed document not yet processed remains stale rather than orphaned; distinguish it because the source blob still exists and has a newer `LastModified`. Reset alone does not remove source-less orphan documents.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-how-to-index-azure-blob-changed-deleted
https://learn.microsoft.com/en-us/azure/search/search-howto-run-reset-indexers#reset-indexers
**Confidence:** `documented`

### Blob documents fail because the blob URL is used directly as the document key

**Observed where:** `lastResult.errors[]` or document-level execution-history errors
**Signature:** `"Invalid document key. Keys can only contain letters, digits, underscore (_), dash (-), or equal sign (=)."`
**Discriminator:** Inspect the failed error’s `key` and the indexer’s `fieldMappings`. A manual mapping from `metadata_storage_path` to the key without `base64Encode` confirms the problem. If no explicit key mapping exists, the blob indexer normally adds an encoded default mapping, so investigate another key source.
**Causes (ranked):** 1. `metadata_storage_path` was manually mapped to the key without encoding. 2. Another URL-like source field containing `/`, `:`, or other unsupported characters was mapped to the key. 3. Base64 output was produced with non-URL-safe settings.
**Fix:** Map the source key through `base64Encode` using URL-safe encoding; preserve the unencoded path in a separate field if needed. Reset and rerun to rebuild affected documents.
**Risk class:** `requires reindex`
**Verify:** The next run has no invalid-key errors, and Lookup Document succeeds with the encoded key.
**Lookalikes:** `"Document key cannot be missing or empty"` indicates a null/missing source value, not an encoding fault. `"Document key cannot be longer than 1024 characters"` requires a shorter key rather than different Base64 settings.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#error-could-not-parse-document
https://learn.microsoft.com/en-us/azure/search/search-indexer-field-mappings#base64encode-function
**Confidence:** `documented`

### Individual documents fail because no key value is produced

**Observed where:** `lastResult.errors[]` or document-level execution-history errors
**Signature:** `"Document key cannot be missing or empty"`
**Discriminator:** Read the index definition to identify the field with `key: true`, trace its indexer `fieldMappings` source, and inspect that source property on the failed item. A missing, null, or empty value confirms the diagnosis.
**Causes (ranked):** 1. The source item lacks the mapped key property. 2. A custom blob metadata key is absent on some blobs. 3. The key field mapping points to the wrong source field.
**Fix:** Populate a unique nonempty source key on every document or correct the field mapping, then rerun/reset as needed to process affected documents.
**Risk class:** `requires reindex`
**Verify:** The formerly failing key appears in the index and `itemsFailed` no longer includes that source item.
**Lookalikes:** Invalid characters produce `"Invalid document key..."`; overlong values produce `"Document key cannot be longer than 1024 characters"`. Inspect `errors[].errorMessage` to distinguish them.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#error-could-not-parse-document
https://learn.microsoft.com/en-us/azure/search/search-how-to-index-azure-blob-storage#add-search-fields-to-an-index
**Confidence:** `documented`

### Documents fail with a source-to-index field type mismatch

**Observed where:** Document-level error array in indexer execution history
**Signature:** `"Type of value has a mismatch with column type. Couldn't store in 'xyz' column. Expected type is 'abc'"` or `"The data field '_data_' ... has an invalid value 'of type 'Edm.String''. The expected type was 'Collection(Edm.String)'."`
**Discriminator:** Compare the actual source value type named in the error with the target field’s `type` from GET Index. A deterministic mismatch on the same field rules out transient source connectivity.
**Causes (ranked):** 1. Source and target field types are incompatible. 2. Different source documents use inconsistent types. 3. A JSON string is being sent where a JSON object or collection is expected. 4. A field mapping targets the wrong field.
**Fix:** Prefer a supported field mapping/conversion when lossless. Otherwise normalize the source or rebuild the index with the correct field type.
**Risk class:** `breaking schema change`
**Verify:** Reprocess a known failing document; its key is present, the field has the intended type/value, and the error disappears.
**Lookalikes:** `"Could not apply mapping function..."` means the mapping function itself received incompatible or null input. `"Could not read document"` with transport details indicates source connectivity rather than schema mismatch.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#error-type-of-value-has-a-mismatch-with-column-type-couldnt-store-in-xyz-column--expected-type-is-abc
https://learn.microsoft.com/en-us/azure/search/search-indexer-field-mappings
**Confidence:** `documented`

### Blob indexing fails during content extraction

**Observed where:** Document-level error array in execution history
**Signature:** `"Could not extract content or metadata from your document"` with details such as `"Document has unsupported content type 'image/png'"`, `"Document could not be processed - it may be encrypted or password protected."`, or `"Document is '...' bytes, which exceeds the maximum size '...' bytes..."`
**Discriminator:** Read the same error object’s `details`, then compare blob content type/size with `status.limits.maxDocumentExtractionSize`. The detail identifies unsupported, encrypted, oversized, or transient timeout cases.
**Causes (ranked):** 1. Unsupported content type. 2. Encrypted/password-protected document. 3. Blob exceeds the tier’s extraction limit. 4. Transient extraction timeout.
**Fix:** Exclude unsupported extensions, remove protection or convert the source, split oversized content, or set `indexStorageMetadataOnlyForOversizedDocuments: true` when metadata-only indexing is acceptable. Rerun repaired documents.
**Risk class:** `requires reindex`
**Verify:** The repaired blob increments `itemsProcessed` without a corresponding failure and its expected content—or metadata-only record—appears in the index.
**Lookalikes:** A scanned PDF can index successfully but yield no text; distinguish it by the absence of extraction errors and use OCR. `dataToExtract: "storageMetadata"` also intentionally omits content.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#error-could-not-extract-content-or-metadata-from-your-document
https://learn.microsoft.com/en-us/azure/search/search-how-to-index-azure-blob-storage#troubleshooting
**Confidence:** `documented`

### Skillset runs, but expected enriched fields are empty

**Observed where:** Execution-history warnings and empty target enrichment fields
**Signature:** `"Warning: Skill input was invalid"`, commonly `"Required skill input is missing. Name: text, Source: /document/merged_content"` or `"Required skill input was not of the expected type 'String'."`
**Discriminator:** Inspect the warning’s `name`, `key`, and `message`, then compare the named skill’s `context` and input `source` paths. A nonexistent path, wrong casing, incorrect type, or missing/extra `*` confirms the diagnosis.
**Causes (ranked):** 1. Incorrect skill input path. 2. Missing or extra array wildcard. 3. Source values have inconsistent types. 4. A required upstream skill was skipped and produced no output.
**Fix:** Correct the path/context, normalize input, or use a Conditional skill to provide a default. Reset the affected skill/documents or reset and rerun the indexer to regenerate outputs.
**Risk class:** `requires reindex`
**Verify:** The warning disappears for a known document and the mapped enrichment output is non-null in the target index.
**Lookalikes:** `"Warning: Could not map output field 'X' to search index"` means enrichment may exist but its output mapping is wrong. Inspect whether the in-memory skill output exists in a debug session.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#warning-skill-input-was-invalid
**Confidence:** `documented`

### A custom Web API skill repeatedly times out

**Observed where:** Document-level skill error in execution history
**Signature:** `"Skill did not execute within the time limit"`
**Discriminator:** Inspect the failing operation’s `name` to identify the skill. If it is a custom WebApiSkill, read its `timeout` and `batchSize`; an execution duration exceeding the configured/default 30 seconds confirms this branch. Built-in skills with the same message are treated as transient or support cases instead.
**Causes (ranked):** 1. Custom endpoint takes longer than the default 30 seconds. 2. `batchSize` is too large. 3. Custom code hangs or has an infinite loop. 4. A built-in skill endpoint has a transient problem.
**Fix:** First ensure the endpoint terminates consistently. Increase `timeout` up to 230 seconds and/or reduce `batchSize`; if one item still exceeds 230 seconds, rewrite or split the skill.
**Risk class:** `config-only, reversible`
**Verify:** A subsequent run completes the same document without the timeout and produces the skill’s mapped output.
**Lookalikes:** `"Could not execute skill because the Web API request failed"` indicates an HTTP/request failure; `"Web API skill response is invalid"` indicates a malformed response. Inspect the exact `errorMessage`.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#error-skill-did-not-execute-within-the-time-limit
**Confidence:** `documented`

### Cosmos DB indexer repeatedly restarts a large custom query instead of resuming

**Observed where:** Indexer execution warnings and repeated processing behavior
**Signature:** `"Warning: The current indexer configuration does not support incremental progress"`
**Discriminator:** Inspect the Cosmos data source `container.query` and indexer `parameters.configuration.assumeOrderByHighWaterMarkColumn`. A custom query not provably ordered by `_ts`, with the hint absent or false, confirms the warning.
**Causes (ranked):** 1. Custom query lacks `ORDER BY c._ts`. 2. The query has the ordering, but Azure AI Search cannot infer it. 3. `_ts` is omitted from the projection.
**Fix:** Make the query filter/project and order by `_ts`; only after verifying that ordering, set `assumeOrderByHighWaterMarkColumn: true`.
**Risk class:** `config-only, reversible`
**Verify:** The warning disappears and an interrupted run’s successor resumes from its checkpoint instead of rescanning from the beginning.
**Lookalikes:** Normal duplicate processing can result from the indexer’s conservative look-back buffer; distinguish it because no incremental-progress warning is present and duplicates occur only near tracking boundaries.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#warning-the-current-indexer-configuration-does-not-support-incremental-progress
https://learn.microsoft.com/en-us/azure/search/search-how-to-index-cosmosdb-sql#incremental-indexing-and-custom-queries
**Confidence:** `documented`

### Azure SQL serverless indexer fails once with error code 40613

**Observed where:** Indexer connection attempt or execution history
**Signature:** Error code `40613`, stating that the database is unavailable.
**Discriminator:** Read the Azure SQL database status. `Paused` or a transition from paused to online at the failure time confirms serverless auto-resume; an already-online database with repeated 40613 errors requires further SQL investigation.
**Causes (ranked):** 1. Serverless database was paused when the indexer connected. 2. Auto-resume had started but was not complete.
**Fix:** Resume or activate the database, wait until its status is online, then retry the indexer connection/run.
**Risk class:** `config-only, reversible`
**Verify:** Database status is online and the retried indexer successfully enumerates/processes rows.
**Lookalikes:** Firewall and credential failures can also appear as connection failures but do not use 40613; distinguish them by the error code and database status.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-troubleshooting#azure-sql-database-serverless-indexing-error-code-40613
**Confidence:** `documented`

### Documents fail while being written to an overloaded search index

**Observed where:** Document-level execution-history errors
**Signature:** `"Failed to establish connection to update index. Search service is under heavy load."` or `"Couldn't establish connection to the search index in a timely manner."`
**Discriminator:** Inspect `errors[].name` and `details`. A failure at `Projection.SearchIndex.MergeOrUpload` or equivalent target-index write stage, with 503/temporary-unavailability details, distinguishes target pressure from source enumeration failures.
**Causes (ranked):** 1. Concurrent indexing/query load exhausts capacity. 2. Indexer batch size is too large. 3. Temporary service maintenance or topology transition. 4. Rare transient compute/network failure.
**Fix:** Put the indexer on a retrying schedule and reduce `batchSize`; stagger competing indexers. Scale the search service only if pressure remains sustained.
**Risk class:** `config-only, reversible`
**Verify:** Later runs write the previously failed keys, `itemsFailed` returns to zero, and target-stage 503/timeout errors cease.
**Lookalikes:** Cosmos `"Request rate is large"` is source throttling; distinguish it by a `DocumentExtraction`/source-stage name and Cosmos details. Skill throttling explicitly names the cognitive service and skill.
**Source:** https://learn.microsoft.com/en-us/azure/search/cognitive-search-common-errors-warnings#error-could-not-mergeorupload--delete-document-to-the-search-index
**Confidence:** `documented`

### Scheduled indexer stops creating execution-history entries

**Observed where:** Portal indexer execution history or Get Indexer Status
**Signature:** No new runs appear even though `schedule` is configured and the data source changed.
**Discriminator:** GET the indexer and status. Confirm a non-null `schedule`, no active `lastResult` run, and no new `executionHistory` entry for more than one interval. This distinguishes a stopped schedule from a long-running invocation.
**Causes (ranked):** 1. Scheduler requires recovery after a rare maintenance/transient condition. 2. The indexer is disabled. 3. Repeated failure on the same document caused reduced scheduling frequency.
**Fix:** If disabled, enable it. Otherwise set `disabled: true`, save, then set `disabled: false`; optionally run once manually. Re-enabling establishes a new schedule baseline from the current time.
**Risk class:** `config-only, reversible`
**Verify:** A new execution-history entry appears within the next configured interval and `lastResult.status` becomes `success`.
**Lookalikes:** If `lastResult.status` is in progress with no `endTime`, the prior run is still executing and subsequent occurrences can be skipped. If history exists but reports `0/0`, the schedule is working and no changes were detected.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-howto-schedule-indexers#scheduling-behavior-faq
**Confidence:** `documented`

### Large Blob indexer appears stuck with zero documents processed

**Observed where:** Portal execution history or current Get Indexer Status result
**Signature:** The run remains in progress while the documents-succeeded/`itemsProcessed` count does not increase for an extended period, with no reported error.
**Discriminator:** Check `lastResult.status`, `startTime`, `endTime`, and `errors`. `inProgress`, no `endTime`, no errors, and a container containing a very large blob inventory confirm that enumeration—not document processing—is likely underway.
**Causes (ranked):** 1. Initial blob-list enumeration takes hours or days. 2. A very large container is processed by one indexer. 3. The run will exceed its execution window before document processing finishes.
**Fix:** Do not reset solely because the count is zero. Keep the indexer on a recurring schedule so it can resume; for sustained scale, partition blobs across containers or virtual folders and use separate parallel indexers targeting the same index.
**Risk class:** `config-only, reversible`
**Verify:** The current or later scheduled execution begins increasing `itemsProcessed`; across partitioned indexers, aggregate progress advances without document errors.
**Lookalikes:** A stopped scheduler has no active `inProgress` result. A completed incremental run with no changes has `status: "success"`, an `endTime`, and `0/0`. A source connection fault has an error rather than silent enumeration.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-how-to-large-index#schedule-indexers-for-long-running-processes
https://learn.microsoft.com/en-us/azure/search/search-how-to-large-index#run-indexers-in-parallel
**Confidence:** `documented`

### SQL incremental indexing silently misses concurrently updated rows

**Observed where:** Source-to-index comparison after successful incremental runs
**Signature:** Some SQL changes are absent even though the indexer reports success and uses a high-water-mark policy.
**Discriminator:** GET the data source and identify `highWaterMarkColumnName`; inspect that SQL column’s type. A non-`rowversion` type, especially `datetime`/`datetime2`, combined with concurrent source transactions confirms the documented reliability risk.
**Causes (ranked):** 1. A datetime or other non-rowversion high-water-mark column is used during concurrent updates. 2. Updates do not always increase the column. 3. `rowversion` is used against a read-only replica.
**Fix:** Prefer SQL integrated change tracking where supported. Otherwise migrate the high-water mark to `rowversion`, point it at the primary replica, set `convertHighWaterMarkToRowVersion: true`, and reset/rerun.
**Risk class:** `breaking schema change`
**Verify:** After full reindexing, update rows concurrently with a test run and confirm every key is present with the latest value; subsequent status shows no failures.
**Lookalikes:** A future tracking value skips all older rows; distinguish it through `initialTrackingState`/`finalTrackingState`. Query timeout from a missing SQL index produces a failed execution rather than silent success.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-how-to-index-sql-database#high-water-mark-change-detection-policy
https://learn.microsoft.com/en-us/azure/search/search-how-to-index-sql-database#converthighwatermarktorowversion
**Confidence:** `documented`

## Known gaps

These failures are believed to occur in the field but could not be verified from
documentation. They are recorded rather than guessed at.
Do not synthesize an entry for them; fill them from real support data.

- Exact indexer error signatures for Cosmos DB RU throttling beyond the documented nested detail `{"Errors":["Request rate is large"]}`.
- Production-specific causes of indexer scheduler drift not exposed through Get Indexer Status.
- Document-level signatures for malformed CSV quoting and inconsistent column counts.
- Exact errors produced when Blob soft-delete retention expires before the indexer observes deletion.
- Service-side diagnostics for intermittent duplicate enrichment billing caused by conservative change-tracking buffers.
