# App Onboard Prepare — Per-Service Pricing Patterns

Filter strings, meter names, and formulas per Azure service. For methodology and troubleshooting, see [pricing-guide.md](pricing-guide.md).

### Container Apps

No `armSkuName`. Filter: `serviceName eq 'Azure Container Apps' and armRegionName eq '{region}' and priceType eq 'Consumption' and isPrimaryMeterRegion eq true`

**Key meters:** `Standard vCPU Active Usage` (1 Second), `Standard Memory Active Usage` (1 GiB Second), `Standard vCPU Idle Usage`, `Standard Memory Idle Usage`, `Standard Requests` (1M).

**Monthly formula (Consumption, 1 vCPU, 2 GiB, 8h active/day):**
`(vCPU_active_rate × 3600 × 8 × 30) + (memory_active_rate × 2 × 3600 × 8 × 30)`

**Free grant:** 180K vCPU-sec + 360K GiB-sec + 2M requests/sub/month.

> ⚠️ **Idle cost:** When `min_replicas >= 1`: `idle_cost = (vCPU_idle_rate × 3600 × idle_hours × 30) + (memory_idle_rate × GiB × 3600 × idle_hours × 30)`. Scale-to-zero = $0 idle.

---

### App Service

**MCP call:** `pricing_get --service "Azure App Service" --region "{region}"`

**Meter-to-SKU mapping:**

| SKU | `meterName` | Notes |
|-----|-------------|-------|
| F1 | `F1 App` | Free ($0 price) |
| B1 | `B1` | |
| B2 | `B2` | |
| S1 | `S1 App` | |
| P1v3 | `P1 v3 App` | Linux/Windows have different `productName` |

**Gotcha:** `armSkuName` empty for Basic/Standard. Match on `meterName`.

**Monthly:** `retailPrice × 730`

---

### Azure SQL Database

**DTU model** — no `armSkuName`. Filter by `productName` + `meterName`.

| SKU | `productName` contains | `meterName` (unit: 1/Day) |
|-----|----------------------|-------------|
| Basic (5 DTU) | `SQL Database Single Basic` | `B DTU` |
| S0 (10 DTU) | `SQL Database Single Standard` | `S0 DTUs` |
| S1 (20 DTU) | `SQL Database Single Standard` | `S1 DTUs` |

**Monthly (DTU):** `retailPrice × 30`

**vCore model:** `productName` filters — Serverless: `'SQL Database General Purpose - Serverless - Compute Gen5'`. Hyperscale: `'SQL Database Single/Elastic Pool Hyperscale'`. Monthly: `retailPrice × 730`.

---

### Cosmos DB

Filter: `serviceName eq 'Azure Cosmos DB' and armRegionName eq '{region}' and priceType eq 'Consumption' and isPrimaryMeterRegion eq true`

| Model | Match on | Monthly formula |
|-------|----------|----------------|
| Provisioned | `meterName eq '100 RU/s'`, `productName eq 'Azure Cosmos DB'` | `(targetRU / 100) × retailPrice × 730` |
| Autoscale | `productName eq 'Azure Cosmos DB autoscale'`, `meterName` starts with `AP` | varies |
| Serverless | `productName eq 'Azure Cosmos DB serverless'`, `meterName eq '1M RUs'` | `retailPrice × estimatedMillionsOfRU` |

> ⚠️ **Provisioned 100 RU/s gotcha:** The `isPrimaryMeterRegion eq true` entry has `retailPrice: 0` (free-tier placeholder). The real price (~$0.008/hr in eastus) has `isPrimaryMeterRegion: false`. Drop `isPrimaryMeterRegion` from the filter or match on `retailPrice > 0`.

**Storage:** `meterName eq 'Data Stored'` with `productName eq 'Azure Cosmos DB'` (1 GB/Month). Note: this meter has `isPrimaryMeterRegion: false` — drop that filter or query without it.

**Free tier:** 1,000 RU/s + 25 GB per account (one per subscription).

---

### Storage

No `armSkuName`. Filter by `meterName` + `productName`.

**Filter (Hot LRS Blob):**
```
serviceName eq 'Storage' and armRegionName eq '{region}' and meterName eq 'Hot LRS Data Stored' and productName eq 'Blob Storage'
```

**Meter-to-SKU mapping:**

| SKU matrix tier | `meterName` | `productName` |
|----------------|-------------|---------------|
| Standard_LRS | `Hot LRS Data Stored` | `Blob Storage` or `General Block Blob v2` |
| Standard_GRS | `Hot GRS Data Stored` | `Blob Storage` or `General Block Blob v2` |
| Premium_LRS | `Premium LRS Data Stored` | `Premium Block Blob` |

**Monthly:** `retailPrice × estimatedGB`

---

### Key Vault

**Filter:**
```
serviceName eq 'Key Vault' and armRegionName eq '{region}' and priceType eq 'Consumption'
```

**Key meters:**

| Tier | `meterName` | Unit |
|------|-------------|------|
| Standard | `Operations` | 10K |

**Monthly (Standard):** `retailPrice × (estimatedOps / 10000)`. Negligible for typical AppOnboard apps.

---

### Service Bus

**Filter:**
```
serviceName eq 'Service Bus' and armRegionName eq '{region}'
```

> ⚠️ **Do NOT add `isPrimaryMeterRegion eq true`** — all Service Bus meters have `isPrimaryMeterRegion: false`. Adding that filter returns zero useful results.

**Key meters:**

| Tier | `meterName` | Unit | Notes |
|------|-------------|------|-------|
| Basic | `Basic Messaging Operations` | 1M | Usage-based only |
| Standard | `Standard Base Unit` | 1/Hour | Base cost (always-on) |
| Standard | `Standard Messaging Operations` | 1M | Tiered: first 13M free |
| Premium | `Premium Messaging Unit` | 1/Hour | Per messaging unit |

**Monthly (Standard):** `baseUnitRate × 730` + operations beyond free tier. Standard tiered: first 13M free.

**Gotcha:** Standard Base Unit has two entries — hourly and monthly. Use hourly × 730.

---

### Redis Cache

`armSkuName` IS populated — `pricing_get --sku` works.

**MCP call:** `pricing_get --service "Redis Cache" --sku "{armSkuName}" --region "{region}"`

**armSkuName pattern:** `Azure_Redis_Cache_{Tier}_{Size}_Cache` (e.g., `Azure_Redis_Cache_Basic_C0_Cache`, `Azure_Redis_Cache_Standard_C1_Cache`). Query the MCP tool for exact pricing.

**Gotcha:** Basic tier entries have `isPrimaryMeterRegion: false`. The standard filter strips them out. Query by `armSkuName` directly or omit `isPrimaryMeterRegion` and match on `productName eq 'Azure Redis Cache Basic'`.

**Monthly:** `retailPrice × 730`

---

### Azure Database for PostgreSQL Flexible Server

`armSkuName` IS populated — `pricing_get --sku` works. ⛔ **`skuName` is CASE-SENSITIVE:** `B1MS` works, `B1ms` returns 0 results.

**MCP call:** `pricing_get --service "Azure Database for PostgreSQL" --sku "{armSkuName}" --region "{region}"`

**armSkuName values:**

> **Approximate reference only** — always verify via `pricing_get` or retail prices API.
>
> **Naming convention:** Only the two smallest Burstable SKUs use short uppercase names (`B1MS`, `B2S`). All other Burstable SKUs (B4ms through B20ms) and all General Purpose / Memory Optimized tiers use the `Standard_` prefix (`Standard_B2ms`, `Standard_B4ms`, `Standard_D2ds_v5`). This is Azure API behavior — not a typo. Always use the exact `armSkuName` shown here.

| SKU | `armSkuName` | `retailPrice` (eastus, approx.) |
|-----|-------------|------------------------|
| Burstable B1ms (1 vCore, 2 GiB) | `B1MS` | ~$0.017/hr |
| Burstable B2s (2 vCores, 4 GiB) | `B2S` | ~$0.068/hr |
| Burstable B2ms (2 vCores, 8 GiB) | `Standard_B2ms` | ~$0.136/hr |
| General Purpose D2ds_v5 (2 vCores) | `Standard_D2ds_v5` | ~$0.178/hr |

**Storage:** Query separately — `meterName eq 'Storage Data Stored'` and `productName` containing `Flexible Server Storage`. Unit: 1 GiB/Month. Default 32 GiB included at ~$0.115/GiB/mo.

**Monthly (compute):** `retailPrice × 730`
**Monthly (storage):** `storageRate × storageSizeGB`
**Total:** compute + storage (e.g., B1ms + 32 GiB ≈ $12.41 + $3.68 = ~$16.09)

---

### Functions

**Consumption plan:** Not in the Retail Prices API. Free grant covers most AppOnboard apps: 1M executions + 400K GB-seconds/month. Beyond that, use the published rates from [azure.microsoft.com/pricing/details/functions](https://azure.microsoft.com/en-us/pricing/details/functions/).

**Flex Consumption / Premium** — `serviceName eq 'Functions'`:

**Filter:**
```
serviceName eq 'Functions' and armRegionName eq '{region}' and priceType eq 'Consumption' and isPrimaryMeterRegion eq true
```

**Key meters (Flex Consumption):**
- `On Demand Execution Time` (unit: 1 GB Second)
- `On Demand Total Executions` (unit: 10)
- `Always Ready Baseline` (unit: 1 GB Second)

**Key meters (Premium):**
- `Premium vCPU Duration` (unit: 1 Hour)
- `Premium Memory Duration` (unit: 1 GiB Hour)

**Monthly (Premium):** `vCPU_rate × 730` + `memory_rate × GiB × 730`

---

### Static Web Apps

**Not in the Retail Prices API.** Fixed pricing — query [azure.microsoft.com/pricing/details/app-service/static](https://azure.microsoft.com/en-us/pricing/details/app-service/static/):
- **Free tier:** 100 GB bandwidth, 2 custom domains
- **Standard tier:** Flat monthly per app, unlimited bandwidth, 5 custom domains

---

### Log Analytics / Application Insights

**Filter:**
```
serviceName eq 'Azure Monitor' and armRegionName eq '{region}' and priceType eq 'Consumption' and isPrimaryMeterRegion eq true
```

**Key meters:**
- `Platform Logs Data Processed` (unit: 1 GB)
- Log Analytics ingestion — match `meterName` containing `Data Ingestion`

**Free grant:** First 5 GB/month of Log Analytics data ingestion.

**Monthly:** `retailPrice × estimatedGB` (subtract 5 GB free grant).
