## SKU Names

Exact `sku.name` values for Bicep. The `sku.tier` is derived but can be set explicitly.

### Free & Shared

| SKU Name | Tier | Description |
|----------|------|-------------|
| `F1` | `Free` | Free tier — 1 GB, 60 min/day compute |
| `D1` | `Shared` | Shared — custom domains, 240 min/day |

### Basic

| SKU Name | Tier | Cores | RAM | Description |
|----------|------|-------|-----|-------------|
| `B1` | `Basic` | 1 | 1.75 GB | Basic small |
| `B2` | `Basic` | 2 | 3.5 GB | Basic medium |
| `B3` | `Basic` | 4 | 7 GB | Basic large |

### Standard

| SKU Name | Tier | Cores | RAM | Description |
|----------|------|-------|-----|-------------|
| `S1` | `Standard` | 1 | 1.75 GB | Standard small — slots, autoscale |
| `S2` | `Standard` | 2 | 3.5 GB | Standard medium |
| `S3` | `Standard` | 4 | 7 GB | Standard large |

### Premium v3

| SKU Name | Tier | Cores | RAM | Description |
|----------|------|-------|-----|-------------|
| `P0v3` | `PremiumV3` | 1 | 4 GB | Premium v3 extra-small |
| `P1v3` | `PremiumV3` | 2 | 8 GB | Premium v3 small |
| `P2v3` | `PremiumV3` | 4 | 16 GB | Premium v3 medium |
| `P3v3` | `PremiumV3` | 8 | 32 GB | Premium v3 large |
| `P1mv3` | `PremiumMV3` | 2 | 16 GB | Memory-optimized v3 |
| `P2mv3` | `PremiumMV3` | 4 | 32 GB | Memory-optimized v3 |
| `P3mv3` | `PremiumMV3` | 8 | 64 GB | Memory-optimized v3 |
| `P4mv3` | `PremiumMV3` | 16 | 128 GB | Memory-optimized v3 |
| `P5mv3` | `PremiumMV3` | 32 | 256 GB | Memory-optimized v3 |

### Isolated v2

| SKU Name | Tier | Cores | RAM | Description |
|----------|------|-------|-----|-------------|
| `I1v2` | `IsolatedV2` | 2 | 8 GB | Isolated v2 small (ASE) |
| `I2v2` | `IsolatedV2` | 4 | 16 GB | Isolated v2 medium |
| `I3v2` | `IsolatedV2` | 8 | 32 GB | Isolated v2 large |
| `I4v2` | `IsolatedV2` | 16 | 64 GB | Isolated v2 extra-large |
| `I5v2` | `IsolatedV2` | 32 | 128 GB | Isolated v2 2x-large |
| `I6v2` | `IsolatedV2` | 64 | 256 GB | Isolated v2 3x-large |

### Functions-Specific

| SKU Name | Tier | Description |
|----------|------|-------------|
| `Y1` | `Dynamic` | Consumption plan — pay-per-execution |
| `FC1` | `FlexConsumption` | Flex Consumption — VNet support |
| `EP1` | `ElasticPremium` | Elastic Premium small — always-warm |
| `EP2` | `ElasticPremium` | Elastic Premium medium |
| `EP3` | `ElasticPremium` | Elastic Premium large |
