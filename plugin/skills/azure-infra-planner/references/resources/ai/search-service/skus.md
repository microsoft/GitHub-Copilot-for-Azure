## SKU Names

Exact `sku.name` values for Bicep:

| SKU | Description | Max Partitions | Max Replicas |
|-----|-------------|----------------|--------------|
| `free` | Free tier — 3 indexes, 50 MB storage | 1 | 1 |
| `basic` | Basic tier — 15 indexes, 15 GB storage | 1 | 3 |
| `standard` | Standard S1 — 50 indexes, 160 GB/partition | 12 | 12 |
| `standard2` | Standard S2 — 200 indexes, 512 GB/partition | 12 | 12 |
| `standard3` | Standard S3 — 200 indexes, 1 TB/partition; supports HighDensity | 12 | 12 |
| `storage_optimized_l1` | Storage Optimized L1 — 10 indexes, 2 TB/partition | 12 | 12 |
| `storage_optimized_l2` | Storage Optimized L2 — 10 indexes, 4 TB/partition | 12 | 12 |

> **Note:** SKU **cannot** be changed after creation. You must create a new service to change SKU.
