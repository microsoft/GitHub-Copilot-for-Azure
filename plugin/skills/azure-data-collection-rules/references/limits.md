# DCR Limits and Constraints

Documented limits from Azure Monitor service-limits page plus related Log Analytics workspace and Logs Ingestion API limits relevant to DCR authoring.

Source: [Azure Monitor service limits](https://learn.microsoft.com/en-us/azure/azure-monitor/service-limits)

## DCR Structure Limits

| Element | Limit | Source |
|---|---|---|
| Data sources per DCR | 10 | [Service limits](https://learn.microsoft.com/en-us/azure/azure-monitor/service-limits#data-collection-rules) |
| Data flows per DCR | 10 | Service limits |
| Data streams per DCR | 20 | Service limits |
| Extensions per DCR | 10 | Service limits |
| Extension settings size | 32 KB | Service limits |
| Log Analytics workspace destinations per DCR | 10 | Service limits |
| Characters in a transformation (transformKql) | 15,360 | Service limits |
| Counter specifiers per performance counter data source | 100 | Service limits |
| Facility names per Syslog data source | 20 | Service limits |
| XPath queries per Windows Event Log data source | 100 | Service limits |

## DCR Resource-Level Limits

| Element | Limit | Source |
|---|---|---|
| DCR resource name max length | 260 chars | ARM resource name limit |
| DCR name for kind "Direct" (used as DNS label) | 3-30 chars, alphanumeric + hyphens only | DCR API validation (Direct kind requires DNS-safe name) |
| Disallowed characters in DCR resource name | `<>%&:\?/` | ARM resource name validation |
| DCR associations (DCRAs) per resource | 30 | [DCR overview](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/data-collection-rule-overview) |

## Log Analytics Workspace Limits (Destination)

| Element | Limit | Source |
|---|---|---|
| Columns per table | 500 | [General workspace limits](https://learn.microsoft.com/en-us/azure/azure-monitor/service-limits#general-workspace-limits) |
| Column name length | 2-45 chars | General workspace limits + custom table docs |
| Custom log tables per workspace | 500 | General workspace limits |

## Column Name Rules (Custom Tables)

- Must start with a letter (A-Z or a-z)
- After first char: letters, digits, or underscores only
- No spaces, dots, dashes, or other punctuation
- Non-ASCII letters not supported
- Custom columns in Azure tables must end in `_CF`
- Reserved names: `id`, `BilledSize`, `IsBillable`, `InvalidTimeGenerated`, `TenantId`, `Title`, `Type`, `UniqueId`, `_ItemId`, `_ResourceGroup`, `_ResourceId`, `_SubscriptionId`, `_TimeReceived`

Source: [Add or delete tables and columns](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/create-custom-table)

## Logs Ingestion API Limits

| Element | Limit | Source |
|---|---|---|
| API call body size | 1 MB (compressed or uncompressed) | [Logs Ingestion API limits](https://learn.microsoft.com/en-us/azure/azure-monitor/service-limits#logs-ingestion-api) |
| Field value max size | 64 KB (truncated if exceeded) | Logs Ingestion API limits |
| Data per minute per DCR | 2 GB (soft, auto-scales) | Logs Ingestion API limits |
| Requests per minute per DCR | 12,000 (soft, auto-scales) | Logs Ingestion API limits |
| TimeGenerated range per API call (Auxiliary tables) | 30 minutes | Logs Ingestion API limits |

## Stream Declaration Constraints

- Custom stream names must begin with `Custom-`
- Supported column types: `string`, `int`, `long`, `real`, `boolean`, `dynamic`, `datetime`
- `guid` type not available in stream declarations (use `string`)
- Every table must have a `TimeGenerated` column (auto-added by transform if missing)

## Data Flow Constraints

- One stream can only send to one Log Analytics workspace in a single DCR
- Multiple dataFlow entries allowed for same stream if targeting different tables in the same workspace
- To send one stream to multiple workspaces, create separate DCRs


