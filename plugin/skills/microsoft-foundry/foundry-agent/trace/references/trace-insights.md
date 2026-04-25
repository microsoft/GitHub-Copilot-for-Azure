# Trace Insights — Surface Agent Health from Telemetry

Surface actionable trace insights for a Foundry agent by calling the Agent Insights API, which analyzes trace telemetry from Application Insights.

## Prerequisites

- App Insights resource resolved (see [trace.md](../trace.md) Before Starting)
- User has **Reader** access on the App Insights resource
- Agent name and Foundry project ARM ID are **optional filters** — resolve them if available but do not block on them

## Step 1 — Resolve Parameters

Gather the **required** parameters from the App Insights resource ID:

| Parameter | Required | Source | Example |
|-----------|----------|--------|---------|
| `<subscription-id>` | Yes | App Insights resource ID | `bbe41737-1ade-44df-8e33-217f11b8b452` |
| `<resource-group>` | Yes | App Insights resource ID | `DiagnosticsAiAgents` |
| `<component-name>` | Yes | App Insights resource ID | `diagnostic-services-appinsights` |
| `<agent-name>` | No | `agent-metadata.yaml` agent name | `ProductSupportAgentV2` |
| `<project-id>` | No | `agent-metadata.yaml` Foundry project ARM ID | `/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/.../projects/...` |

> ⚠️ **Start broad, then narrow.** The `agent` and `projectId` parameters are optional filters. Begin without them to discover all insights across the App Insights resource, then add filters to scope to a specific agent. Agent names in telemetry may differ from the name in `agent-metadata.yaml` (e.g., hosted agents may appear as `<name>:<version>` or as internal IDs).

## Step 2 — Acquire Access Token

```powershell
$TOKEN = az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
```

> ⚠️ **Token audience must be `https://ai.azure.com`.** Using a different audience will return `400 Invalid authorization header`.

## Step 3 — Call the Insights Endpoint

Start with a **broad query** (no agent or project filter):

```powershell
$URI = "https://eastus2euap.api.azureml.ms/notification/v1-beta1/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/microsoft.insights/components/<component-name>/:insights?startDateTimeUtc=<start>"

Invoke-RestMethod -Method Post -Uri $URI `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body '{}' | ConvertTo-Json -Depth 10
```

To narrow results, append optional filters to the query string:

```
&agent=<agent-name>&projectId=<project-id>
```

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `startDateTimeUtc` | No | Start of time window (ISO 8601), e.g. `2026-04-12T00:00:00Z` |
| `endDateTimeUtc` | No | End of time window (ISO 8601) |
| `agent` | No | Filter by agent name |
| `projectId` | No | Full ARM resource ID of the Foundry project |
| `severity` | No | Filter: `Critical`, `Warning`, `Improvement` |
| `category` | No | Filter: `Aggregation`, `Anomaly`, `VersionComparison` |
| `type` | No | Comma-separated: `Latency`, `Token`, `Evaluation`, `Error`, `Tool` |
| `top` | No | Max number of insights to return |

### Request Body (Optional)

Custom thresholds can be passed in the request body:

```json
{
  "thresholds": {
    "errorRateCritical": 10,
    "toolFailureRateCritical": 20,
    "evaluatorFailureRateCritical": 20
  }
}
```

## Step 4 — Handle Empty Results

If `totalCount` is `0`, apply this fallback sequence before concluding there are no insights:

1. **Remove `agent` and `projectId` filters** — The agent name in metadata may not match what telemetry records. Hosted agents often emit names like `<name>:<version>` or internal IDs that differ from the Foundry agent name.
2. **Widen the time range** — Extend `startDateTimeUtc` to 14 or 30 days.
3. **Check for telemetry** — If still empty, query App Insights directly via [Search Traces](search-traces.md) to confirm whether any GenAI telemetry exists for this resource.

When broad results return successfully, inspect `metadata.agentName` in the returned insights to discover the actual agent names in telemetry. Report these to the user so they can refine future queries.

## Step 5 — Present Insights

Display the returned insights grouped by severity:

| Severity | Type | Summary | Recommendation |
|----------|------|---------|----------------|
| Critical | Error | Error rate at 15% (threshold: 10%) | Investigate top error types via [Analyze Failures](analyze-failures.md) |
| Warning | Latency | P95 latency increased 40% vs previous version | Drill into bottlenecks via [Analyze Latency](analyze-latency.md) |
| Improvement | Token | Average input tokens 30% higher than baseline | Consider reducing system prompt or history window |

When presenting:
- Group by severity (Critical → Warning → Improvement)
- For each insight, offer to drill deeper using the relevant trace skill reference
- Include the time window and agent name in the summary

## Step 6 — Drill Into Specific Insights

Based on the insight type, route the user to the appropriate workflow:

| Insight Type | Drill-Down Reference |
|--------------|---------------------|
| Error | [Analyze Failures](analyze-failures.md) |
| Latency | [Analyze Latency](analyze-latency.md) |
| Token | [Analyze Latency — Token Correlation](analyze-latency.md#step-4--token-usage-vs-latency-correlation) |
| Evaluation | [Eval Correlation](eval-correlation.md) |
| Tool | [Analyze Failures](analyze-failures.md) (filter by tool operations) |

## Error Handling

| Issue | Cause | Fix |
|-------|-------|-----|
| `totalCount: 0` with filters | Agent name or project ID filter too restrictive | Remove `agent` and `projectId` filters and retry (see Step 4) |
| `totalCount: 0` without filters | No GenAI telemetry in time range | Widen time range or verify traces exist via [Search Traces](search-traces.md) |
| 401 Unauthorized | Token expired or wrong audience | Re-run `az account get-access-token --resource https://ai.azure.com` |
| 400 "Invalid authorization header" | Token audience is not `https://ai.azure.com` | Ensure `--resource https://ai.azure.com` is used |
| 400 "Invalid date format" | Date string not ISO 8601 | Use format `2026-04-12T00:00:00Z` |
| 404 Not Found | Wrong URL path segments | Verify subscription, resource group, and component name |

> ⚠️ **Region limitation:** The Agent Insights API is currently deployed to `eastus2euap` only. The App Insights resource does not need to be in this region — the API uses OBO token exchange to access it server-side.
