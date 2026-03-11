# MCP Tool Gap Analysis — Foundry Platform Roadmap Recommendations

This document identifies MCP tool capabilities that would enhance the evaluation dataset experience. Some previously missing tools are **now available** in the `foundry-mcp` server.

## Current MCP Tool Coverage

| Tool | Status | Notes |
|------|--------|-------|
| `evaluation_dataset_create` | ✅ Available | Supports `connectionName` for project-connected storage. Use with `project_connection_list`/`create` to resolve storage. |
| `evaluation_dataset_get` | ✅ Available | Lists all datasets (no name) or gets by name+version |
| `evaluation_dataset_versions_get` | ✅ Available | Lists all versions of a named dataset |
| `evaluation_agent_batch_eval_create` | ✅ Available | Full-featured, accepts `inputData` inline |
| `evaluation_dataset_batch_eval_create` | ✅ Available | Full-featured, accepts `jsonlContent` inline or `datasetFileId` |
| `evaluation_get` | ✅ Available | Cannot filter runs by dataset version |
| `evaluation_comparison_create` | ✅ Available | No trend analysis; only pairwise comparison |
| `evaluation_comparison_get` | ✅ Available | Full-featured |
| `evaluator_catalog_*` | ✅ Available | No version history or audit trail |
| `project_connection_list` | ✅ Available | Discover AzureBlob connections for dataset storage |
| `project_connection_create` | ✅ Available | Create storage connection to project |

## Resolved (Previously Requested)

| Requested Tool | Now Available As | Status |
|---------------|-----------------|--------|
| `dataset_version_list` | `evaluation_dataset_versions_get` | ✅ Resolved — lists all versions of a named dataset |
| Dataset upload path | `evaluation_dataset_create` with `connectionName` | ✅ Resolved — use project-connected AzureBlob storage |

## Remaining Requests

### Priority 1: Critical (Blocks competitive parity with LangSmith)

#### `dataset_from_traces`
**Purpose:** Server-side extraction of App Insights traces into a dataset, with filtering and schema transformation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectEndpoint` | string (required) | Azure AI Project endpoint |
| `appInsightsResourceId` | string (required) | App Insights ARM resource ID |
| `filterQuery` | string (required) | KQL filter expression |
| `timeRange` | string (required) | Time range (e.g., "7d", "30d") |
| `datasetName` | string (optional) | Target dataset name |
| `datasetVersion` | string (optional) | Target version |
| `sampleSize` | integer (optional) | Max number of traces to extract |

**Why needed:** Currently, trace-to-dataset requires client-side KQL execution, result parsing, schema transformation, and upload. A server-side tool would dramatically simplify the workflow and enable automation.

**LangSmith equivalent:** Run rules with automatic trace-to-dataset routing.

#### `evaluation_trend_get`
**Purpose:** Retrieve time-series metrics across all runs in an evaluation group.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectEndpoint` | string (required) | Azure AI Project endpoint |
| `evalId` | string (required) | Evaluation group ID |
| `evaluatorNames` | string[] (optional) | Filter to specific evaluators |

**Returns:** Array of `{ runId, agentVersion, date, metrics: { evaluatorName: { average, stddev, passRate } } }`.

**Why needed:** Currently requires multiple `evaluation_get` calls and client-side aggregation. A dedicated tool would enable trend dashboards and regression detection in a single call.

**LangSmith equivalent:** Evaluation dashboard with historical metrics and trend analysis.

#### `dataset_tag_manage`
**Purpose:** Add, remove, or list tags on dataset versions.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectEndpoint` | string (required) | Azure AI Project endpoint |
| `datasetName` | string (required) | Dataset name |
| `datasetVersion` | string (required) | Dataset version |
| `action` | string (required) | `add`, `remove`, `list` |
| `tag` | string (optional) | Tag to add/remove (e.g., `prod`, `baseline`) |

**Why needed:** Tags enable version pinning semantics (e.g., "evaluate against the `prod` dataset"). Currently requires external tracking via manifest.json.

**LangSmith equivalent:** Built-in dataset tagging with programmatic SDK access.

### Priority 3: Medium (Nice-to-have for competitive advantage)

#### `dataset_split_manage`
**Purpose:** Create and manage train/validation/test splits within a dataset.

**Why needed:** Enables targeted evaluation on specific dataset subsets without creating separate datasets. Currently requires client-side JSONL filtering.

#### `annotation_queue_create` / `annotation_queue_get`
**Purpose:** Server-side human review queues for trace candidates before dataset inclusion.

**Why needed:** Enables multi-user review workflows. Currently, curation is a single-user, local-file process.

**LangSmith equivalent:** Annotation queues with multi-user review, approval workflows, and queue management.

#### `evaluation_regression_check`
**Purpose:** Automated regression detection with configurable thresholds.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectEndpoint` | string (required) | Azure AI Project endpoint |
| `evalId` | string (required) | Evaluation group ID |
| `baselineRunId` | string (required) | Baseline run ID |
| `treatmentRunId` | string (required) | Treatment run ID |
| `regressionThreshold` | number (optional) | Percent drop that triggers regression (default: 5%) |

**Why needed:** Currently requires comparison + client-side threshold logic. A dedicated tool could integrate with CI/CD pipelines directly.

## Impact Assessment

| Requested Tool | Impact on CX Feedback | Effort Estimate |
|---------------|----------------------|-----------------|
| `dataset_version_list` | Directly addresses "organizing datasets" feedback | Low |
| `dataset_from_traces` | Directly addresses "creating datasets from traces" feedback | High |
| `evaluation_trend_get` | Directly addresses "comparing runs and metrics over time" feedback | Medium |
| `dataset_tag_manage` | Supports "hierarchical containers" feedback (via tags) | Low |
| `dataset_split_manage` | Supports "hierarchical containers" feedback (via splits) | Medium |
| `annotation_queue_*` | Enhances trace-to-dataset quality | High |
| `evaluation_regression_check` | Enables CI/CD regression gates | Medium |

## Interim Workarounds

For tools still not available, the [eval-datasets skill](../eval-datasets.md) provides client-side workarounds:

| Gap | Workaround |
|-----|-----------|
| No trace-to-dataset | KQL harvest templates + local schema transform + sync to Foundry |
| No trend analysis | Multiple `evaluation_get` calls + client-side aggregation |
| No tagging | Tags stored in manifest.json |
| No annotation queues | Local candidate files with status tracking |
| No regression check | Comparison results + threshold logic in skill |
