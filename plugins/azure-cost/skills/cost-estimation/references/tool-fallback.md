# Estimation Tool Fallback

Use ARM MCP first. If the required operation is unavailable, name the API and
use an already authenticated Azure CLI, Azure PowerShell, or REST client.

| Workflow | Fallback API |
|---|---|
| Existing-scope forecast | Cost Management Forecast API |
| Public SKU or meter price | Azure Retail Prices API |
| Negotiated rates | Cost Management Price Sheet API |

Prefer native commands when they expose the required fields; otherwise use
`az rest`, `Invoke-AzRestMethod`, or authenticated REST. Preserve scope, period,
filters, pagination, currency, price type, and meter disambiguation. State which
fallback was used and never expose access tokens or pricesheet URLs.

Do not fall back for invalid input, denied access, throttling, or empty data.
Fallback does not relax the 92-day forecast guardrail or make retail prices
customer-specific.
