## SKU Names

The `sku` block requires both `name` and `tier`:

### SKU Tiers

| Tier | Description |
|------|-------------|
| `Burstable` | Cost-effective for low-utilization workloads. B-series VMs. |
| `GeneralPurpose` | Balanced compute and memory. D-series VMs. |
| `MemoryOptimized` | Memory-heavy workloads. E-series VMs. |

### Common SKU Names

| SKU Name | Tier | vCores | Memory |
|----------|------|--------|--------|
| `Standard_B1s` | Burstable | 1 | 1 GiB |
| `Standard_B1ms` | Burstable | 1 | 2 GiB |
| `Standard_B2s` | Burstable | 2 | 4 GiB |
| `Standard_D2ds_v4` | GeneralPurpose | 2 | 8 GiB |
| `Standard_D4ds_v4` | GeneralPurpose | 4 | 16 GiB |
| `Standard_D8ds_v4` | GeneralPurpose | 8 | 32 GiB |
| `Standard_E2ds_v4` | MemoryOptimized | 2 | 16 GiB |
| `Standard_E4ds_v4` | MemoryOptimized | 4 | 32 GiB |
| `Standard_E8ds_v4` | MemoryOptimized | 8 | 64 GiB |
