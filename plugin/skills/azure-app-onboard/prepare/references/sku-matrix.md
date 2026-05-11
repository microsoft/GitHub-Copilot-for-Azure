# SKU Selection Matrix

Select SKU based on `context.json.intent.budget`. Cross-reference with `intent.scale` for right-sizing.

## Budget Tiers

> ⚠️ **F1 (Free) limitations:** 1 GB RAM, shared compute (60 min/day CPU), no custom domain, no always-on, no deployment slots, no VNet integration. Only suitable for low-traffic dev/test. Production apps → B1 minimum.

| Service | cost-optimized | balanced | performance |
|---------|---------------|----------|-------------|
| Container Apps | Consumption (scale-to-zero) | Consumption | Dedicated |
| App Service | F1 (Free) | B1 / S1 | P1v3 |
| Azure SQL | Basic (5 DTU) | Standard (S0) | Premium / Serverless |
| Cosmos DB | Serverless | Provisioned (400 RU) | Provisioned (autoscale) |
| Storage | Standard_LRS | Standard_GRS | Premium_LRS |
| Static Web Apps | Free | Standard | Standard |
| Key Vault | Standard | Standard | Premium (HSM) |
| Service Bus | Basic | Standard | Premium |
| Redis Cache | Basic C0 | Standard C1 | Premium P1 |
| Functions | Consumption | Flex Consumption | Premium EP1 |

## Modifier Rules

- `intent.scale = "Large"` (100K+ users) → bump minimum one tier above cost-optimized
- `intent.budget = "performance"` + `intent.scale = "Small"` → don't over-provision; use balanced tier
- Policy denies a SKU → fall back to next available tier, add to `assumptions[]`
- Cosmos DB Serverless: max 1K RU/s burst, no geo-replication — only for intermittent/dev workloads. Sustained read-heavy → Provisioned.

## Default Behavior

- Single-component app + cost-optimized → cheapest viable SKU (App Service F1, Static Web Apps Free)
- Simple web app with no DB → $0–$15/month
- Always output exact SKU codes: "App Service F1 (Free)" not "Free tier"
