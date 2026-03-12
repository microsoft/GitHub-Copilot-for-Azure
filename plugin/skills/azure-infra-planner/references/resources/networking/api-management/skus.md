## SKU Names

Exact `sku` values for Bicep — both `name` and `capacity` are required:

| SKU Name | Description | VNet Support |
|----------|-------------|--------------|
| `Consumption` | Serverless, pay-per-call, no capacity setting | None |
| `Developer` | Development/test, no SLA | External, Internal |
| `Basic` | Entry-level production | None |
| `BasicV2` | Basic with new platform features | VNet integration |
| `Standard` | Medium-traffic production | None |
| `StandardV2` | Standard with new platform features | VNet integration |
| `Premium` | Enterprise, multi-region, VNet | External, Internal |
| `PremiumV2` | Premium with new platform features | VNet integration |
| `Isolated` | Fully isolated (single-tenant) | Internal |

> **Note:** `capacity` is required for all SKUs except `Consumption`. It represents the number of scale units.
