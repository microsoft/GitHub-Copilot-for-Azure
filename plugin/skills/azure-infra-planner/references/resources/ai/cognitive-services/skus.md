## SKU Names

Exact `sku.name` values for Bicep (string). Available SKUs depend on `kind`. The `sku.tier` enum values are: `Basic`, `Enterprise`, `Free`, `Premium`, `Standard`.

| SKU Name | Common Usage | Notes |
|----------|--------------|-------|
| `F0` | Free tier | Available for most kinds; single instance per subscription per kind per region |
| `S0` | Standard paid tier | Most common paid SKU; available for most kinds |
| `S1` | Standard tier (higher) | Available for select kinds (e.g., SpeechServices) |
| `DC0` | Data Center tier | Connected container scenarios |

> **Guidance:** Use `F0` for development/testing, `S0` for production. Not all kinds support all SKUs — consult the specific service documentation.
