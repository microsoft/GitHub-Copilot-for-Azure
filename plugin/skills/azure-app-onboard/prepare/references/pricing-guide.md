# App Onboard Prepare — Pricing Guide

## Free-Tier Shortcut — Skip API

> ⛔ **Check this FIRST.** If ALL services in `prepare-plan.json.services[]` use free-tier SKUs → write $0 cost estimate, add disclaimer "Estimate assumes usage within free grant limits", and skip to Step 7. No API calls needed.

| Service | Free SKU | Monthly Cost | Skip API? |
|---------|----------|-------------|-----------|
| App Service | F1 | $0.00 | Yes — no `armSkuName` exists |
| Static Web Apps | Free | $0.00 | Yes — flat tier, no API entry |
| Functions | Consumption (≤1M exec) | $0.00 | Yes — use free grant |
| Cosmos DB | Free tier (1000 RU/s) | $0.00 | Yes — one free account/sub |
| Container Apps | Consumption (≤180K vCPU-s) | $0.00 | Yes — use free grant |

For paid SKUs, continue below.

---

## App Service Quick Reference

| SKU | `armSkuName` | `retailPrice` (eastus) | Monthly |
|-----|-------------|------------------------|---------|
| B1 Linux | `B1` | ~$0.018/hr | ~$13.14 |

> ⛔ **Case-sensitive:** use `B1` not `b1` in pricing API calls.

---

API filter strings, meter names, and estimation formulas for each service referenced by the [SKU Selection Matrix](../references/sku-matrix.md). Always query live prices — never hardcode dollar amounts.

**Primary:** `mcp_azure_mcp_pricing` → `pricing_get`
**Fallback:** Direct HTTP to `https://prices.azure.com/api/retail/prices`

## Free Grants Summary

> Validate via `pricing_get` with free-tier meter filters (`retailPrice eq 0`). Values current as of writing — always confirm live.

| Service | Free Grant (per subscription/month) | Meter to Verify |
|---------|--------------------------------------|-----------------|
| Container Apps | 180K vCPU-sec + 360K GiB-sec + 2M requests | `Standard vCPU Active Usage` at `retailPrice: 0` |
| Functions | 1M executions + 400K GB-sec | `Total Executions` at `retailPrice: 0` |
| Cosmos DB | 1K RU/s + 25 GB (one account/sub) | Free tier discount on provisioned account |
| Log Analytics | 5 GB ingestion/month | `Data Ingestion` at `retailPrice: 0` for first 5 GB |
| App Service | F1 tier (no meter entry — free) | No API entry; free by SKU definition |
| Static Web Apps | Free tier (100 GB bandwidth) | No API entry; flat tier |

> ⛔ **Never claim the user has free credits remaining** — AppOnboard cannot verify credit balance. Use: "If you have Azure free credits, this deployment may be covered. Check your balance at https://portal.azure.com/#view/Microsoft_Azure_Billing/FreeServicesBlade."

## Usage-Based Services — Explicit Cost Caveats

> ⛔ **Azure OpenAI and other token-based AI services** have highly variable costs that depend on usage volume, model selection, and prompt length. AppOnboard cost estimates CANNOT accurately predict these costs.

| Service | Cost Behavior | What to Surface |
|---------|--------------|-----------------|
| Azure OpenAI | Per 1K tokens, model-dependent | "⚠️ Azure OpenAI costs depend on model and usage volume. Estimate excludes AI inference costs — monitor in Azure Portal." |
| Cognitive Services | Per transaction | "⚠️ Usage-based. Free tier includes N transactions/month." |
| Azure AI Search | Base SKU + per-document indexing | Include base SKU; add disclaimer for indexing volume |

**Rule:** When `prereq-output.json.components[]` or `context.json.intent` references OpenAI, AI, LLM, GPT, or similar: add a line item to `costEstimate.breakdown[]` with `"note": "💸 Usage-based — excluded from total. Monitor in Azure Portal."` and set `costEstimate.assumptions[]: "⚠️🤖 AI inference costs excluded — highly variable by usage"`. Do NOT silently omit AI costs — the user WILL be surprised by the bill. Surface this at EVERY approval gate: `"⚠️💰 This estimate does NOT include Azure OpenAI / AI inference costs. Those are usage-based and can be significant. Monitor spending in Azure Portal after deploy."`

## How to Use This Guide

1. **Pick the SKU** from the SKU Selection Matrix based on `context.json.intent.budget` (cost-optimized / balanced / performance).
2. **Find the service section below** — each has the exact filter string, meter name, and `armSkuName` (if available) for that SKU.
3. **Call `pricing_get`** with the filter/SKU from this guide. Never assume a price — always validate via a live API call. ⛔ **Always include `--sku` parameter in `pricing_get` calls** — the tool returns 400 if you omit it.
4. **Apply the monthly formula** listed per service (not always `× 730` — SQL DTU is `× 30`, Container Apps is per-second).
5. **Cross-check** the returned `retailPrice` against the SKU you selected. If the API returns no results, check the [API Gotchas](#api-gotchas) section — most failures are caused by empty `armSkuName` or missing `isPrimaryMeterRegion` filter.

## Quick Reference

| Service | `serviceName` (API) | Has `armSkuName`? | Pricing unit | Monthly formula |
|---------|--------------------|--------------------|--------------|-----------------|
| Container Apps | `Azure Container Apps` | No | Per-second | `vCPU rate × seconds + GiB rate × GiB × seconds` |
| App Service | `Azure App Service` | Premium only¹ | Per-hour | `retailPrice × 730` |
| Azure SQL (DTU) | `SQL Database` | No | Per-day | `retailPrice × 30` |
| Azure SQL (vCore) | `SQL Database` | Varies | Per-hour | `retailPrice × 730` |
| Cosmos DB | `Azure Cosmos DB` | No | Per 100 RU/s/hour | `(targetRU / 100) × retailPrice × 730` |
| Storage | `Storage` | No | Per GB/month | `retailPrice × estimatedGB` |
| Key Vault | `Key Vault` | No | Per 10K ops | `retailPrice × (estimatedOps / 10000)` |
| Service Bus | `Service Bus` | No | Per-hour + per 1M ops | `baseUnitRate × 730 + opsRate × (ops / 1M)` |
| Redis Cache | `Redis Cache` | Yes | Per-hour | `retailPrice × 730` |
| PostgreSQL Flexible | `Azure Database for PostgreSQL` | Yes (case-sensitive!) | Per-hour | `retailPrice × 730` + storage |
| Functions | `Functions` | Varies | Per GB-second | Consumption: free tier covers most apps |
| Static Web Apps | — | — | Not in API | Free tier / Standard is flat monthly |
| Log Analytics | `Azure Monitor` | No | Per GB ingested | `retailPrice × estimatedGB` (first 5 GB free) |

¹ `armSkuName` populated for Premium v3/v4 (e.g., `Azure_App_Service_Premium_v3_Plan_Linux_P1_v3`). Empty for Basic/Standard — match on `meterName`.

## Troubleshooting

Common API pitfalls and recovery procedures for `pricing_get` / Retail Prices API failures.

### API Gotchas

1. **`armSkuName` is empty for most PaaS.** Only Redis Cache and App Service Premium v3/v4 reliably populate it. Everything else: filter by `meterName` or `productName`.
2. **SQL DTU is per-day pricing.** Multiply by 30, not 730.
3. **Container Apps is per-second.** Convert: `rate × 3600 × hours_per_day × 30`.
4. **Functions Consumption plan is not in the API.** Free tier covers most AppOnboard apps.
5. **Static Web Apps is not in the API.** Fixed pricing from the product page.
6. **Always include `isPrimaryMeterRegion eq true`** to avoid duplicate regional meters (except SQL DTU queries which may not have this field).
7. **Always include `priceType eq 'Consumption'`** to exclude Reservation/DevTest prices.
8. **Service names are case-sensitive** in API version `2023-01-01-preview` and later.
9. **Service Bus Standard Base Unit has two entries** — hourly and monthly. Use hourly × 730.
10. **Redis Basic tier has `isPrimaryMeterRegion: false`** — the standard filter strips it out. Query by `armSkuName` directly or omit `isPrimaryMeterRegion` and match on `productName eq 'Azure Redis Cache Basic'`.

### Recovery Procedures

When `pricing_get` returns empty results: (1) Check filter — `armSkuName` populated? case-sensitive? `isPrimaryMeterRegion` applicable? (2) Try HTTP fallback: `GET https://prices.azure.com/api/retail/prices?$filter={filter}`. (3) If both fail after 2 attempts, use approximate prices from [pricing-guide-services.md](pricing-guide-services.md) with disclaimer. (4) Log to `costEstimate.apiFailures[]`.

