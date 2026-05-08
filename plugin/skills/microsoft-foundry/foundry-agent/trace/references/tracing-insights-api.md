# Tracing Insights API

Automatically detect quality regressions and anomalies in agent traces using changepoint detection on evaluation scores stored in App Insights.

## When to Use

Use this instead of manual KQL queries when you want **automated anomaly detection** across evaluation dimensions (task adherence, intent resolution, fluency, latency, token usage). The API finds statistical changepoints in score distributions — no manual threshold tuning needed.

**Prerequisites:**
- App Insights connected to the Foundry project (with `gen_ai.evaluation.result` custom events)
- Evaluation data from portal playground sessions or batch evals (raw traces alone are not enough)

## Endpoint

> **Preview:** The Tracing Insights endpoint (`eastus2euap.api.azureml.ms`) is preview/canary infrastructure subject to change. When the production URL becomes available, update the base URL accordingly.

```
POST https://eastus2euap.api.azureml.ms/notification/v1-beta1/subscriptions/{sub}/resourceGroups/{rg}/providers/microsoft.insights/components/{component}/:insights
```

**Query parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `startDateTimeUtc` | Yes | ISO 8601 start of analysis window |
| `endDateTimeUtc` | Yes | ISO 8601 end of analysis window |
| `agent` | Yes | Agent name (URL-encoded) |
| `projectId` | Yes | ARM resource ID of the Foundry project (URL-encoded — contains slashes) |
| `top` | No | Max insights to return (default 50) |

**Auth:** `az account get-access-token --resource https://ai.azure.com`

**Body:** Must send `{}` (empty JSON object) — POST with no body returns 400.

## Example

```powershell
$token = az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
$encodedAgent = [uri]::EscapeDataString("my-agent")
$encodedProjectId = [uri]::EscapeDataString("/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}")

$uri = "https://eastus2euap.api.azureml.ms/notification/v1-beta1/subscriptions/{sub}/resourceGroups/{rg}/providers/microsoft.insights/components/{component}/:insights?startDateTimeUtc=2025-01-01T00:00:00Z&endDateTimeUtc=2025-01-18T00:00:00Z&agent=$encodedAgent&projectId=$encodedProjectId&top=50"

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
} -Body "{}"
```

## Response Structure

```json
{
  "insights": [
    {
      "id": "anomaly-evaluator-changepoint-<hash>",
      "type": "Evaluation",
      "severity": "Warning|Critical|Improvement",
      "message": "TaskAdherence scores shifted down from avg 1.0 to 0.7",
      "metadata": {
        "evaluationName": "TaskAdherence",
        "meanBefore": 1.0,
        "meanAfter": 0.714,
        "shift": -0.286,
        "confidence": 0.999
      }
    }
  ],
  "totalCount": 3,
  "criticalCount": 0,
  "warningCount": 2,
  "improvementCount": 1
}
```

## How Changepoint Detection Works

The API finds **statistical inflection points within the queried time window**. `meanBefore`/`meanAfter` represent averages on either side of the detected shift — not comparisons to a historical baseline.

- Order and diversity of queries matters — mix easy and hard scenarios
- 10+ data points give better signal for changepoint detection
- `confidence` close to 1.0 = statistically significant shift

## Next Steps

After receiving insights with `Warning` or `Critical` severity, route to [FAOS Optimization](../../observe/references/faos-optimization.md) or the [Insights-to-Optimize loop](../../observe/references/insights-to-optimize.md) to automatically improve the agent.
