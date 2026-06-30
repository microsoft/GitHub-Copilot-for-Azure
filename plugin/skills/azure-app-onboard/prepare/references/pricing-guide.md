# App Onboard Prepare — Pricing Guide

> ⛔ **SELF-CHECK:** If `costEstimate.breakdown[]` has ANY `monthlyUsd > 0`, at least one `pricing_get` or `az rest` pricing API call MUST appear in this session. Estimating from memory or training data is NEVER acceptable — reference values in this file may be outdated. If API fails after 2 attempts, use the reference value WITH disclaimer: `"⚠️ Estimated from reference — live API unavailable."`

## Free-Tier Shortcut — Skip API

> ⛔ **Check this FIRST.** If ALL services use free-tier SKUs → write $0 cost estimate, add disclaimer "Estimate assumes usage within free grant limits", skip to Step 7.

| Service | Free SKU | Skip API? |
|---------|----------|-----------|
| App Service | F1 | Yes |
| Static Web Apps | Free | Yes |
| Functions | Consumption (≤1M exec) | Yes |
| Cosmos DB | Free tier (1000 RU/s) | Yes |
| Container Apps | Consumption (≤180K vCPU-s) | Yes |

---

## App Service Quick Reference

| SKU | `skuName` | Monthly |
|-----|-----------|---------|
| B1 Linux | `B1` | ~$13.14 |

> ⛔ **Case-sensitive:** use `B1` not `b1`. Use `skuName` (not `armSkuName`) for Basic/Standard.

---

## How to Use

1. Pick SKU from [sku-matrix.md](sku-matrix.md) based on budget intent.
2. Find service section in [pricing-guide-services.md](pricing-guide-services.md) for filter strings and formulas.
3. Call `mcp_azure_mcp_pricing` → `pricing_get` per paid service (parallel OK — independent queries). ⛔ Requires at least one filter: `--sku`, `--service`, `--region`, `--service-family`, or `--filter`. Use `--sku` only when `armSkuName` is populated for that service.
4. Apply per-service monthly formula.
5. Cross-check returned `retailPrice` against planned SKU.

## Usage-Based Services

When AI/OpenAI/LLM components detected: add `"💸 Usage-based — excluded from total"` to `costEstimate.breakdown[]` and `"⚠️🤖 AI inference costs excluded"` to `assumptions[]`. Surface at EVERY approval gate.

## Service Pricing Reference

See [pricing-guide-services.md](pricing-guide-services.md) for per-service filter strings, meter names, and monthly formulas.

**Key rules:**
- `armSkuName` is empty for most PaaS — filter by `meterName` or `productName`
- SQL DTU: multiply by 30 (per-day). Container Apps: per-second
- Functions Consumption / Static Web Apps: not in API
- Always include `isPrimaryMeterRegion eq true` and `priceType eq 'Consumption'`
- Service names are case-sensitive

## Troubleshooting

When `pricing_get` returns empty: (1) Check `armSkuName` populated/case-sensitive? (2) HTTP fallback: `https://prices.azure.com/api/retail/prices?$filter={filter}`. (3) After 2 failures, use [pricing-guide-services.md](pricing-guide-services.md) with disclaimer. (4) Log to `costEstimate.apiFailures[]`.

> ⛔ **Never claim user has free credits remaining.** Use: "Check balance at portal."

