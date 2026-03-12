## SKU Names

Exact `sku.name` values for Bicep (string). The `sku.tier` enum values are: `Basic`, `Free`, `Premium`, `Standard`.

| SKU Name | Tier | Notes |
|----------|------|-------|
| `Basic` | `Basic` | Default for standard ML workspaces |
| `Standard` | `Standard` | Used for Hub/Project workspaces |
| `Free` | `Free` | Limited-feature tier |
| `Premium` | `Premium` | Advanced features |

> **Guidance:** Most ML workspaces use `Basic`/`Basic`. Hub and Project workspaces typically use `Basic`/`Basic` as well. `Free` and `Premium` appear in the ARM schema enum but are not distinct ML pricing tiers — use `Basic` or `Standard` for production.
