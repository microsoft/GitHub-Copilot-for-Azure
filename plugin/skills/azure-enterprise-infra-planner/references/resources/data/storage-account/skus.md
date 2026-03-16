## SKU Names

Exact `sku.name` values for Bicep:

| SKU | Redundancy | Compatible Kinds |
|-----|------------|------------------|
| `Standard_LRS` | Locally redundant | StorageV2, Storage, BlobStorage |
| `Standard_GRS` | Geo-redundant | StorageV2, Storage, BlobStorage |
| `Standard_RAGRS` | Read-access geo-redundant | StorageV2, Storage, BlobStorage |
| `Standard_ZRS` | Zone-redundant | StorageV2 |
| `Standard_GZRS` | Geo-zone-redundant | StorageV2 |
| `Standard_RAGZRS` | Read-access geo-zone-redundant | StorageV2 |
| `Premium_LRS` | Premium locally redundant | BlockBlobStorage, FileStorage |
| `Premium_ZRS` | Premium zone-redundant | BlockBlobStorage, FileStorage |
| `StandardV2_LRS` | Standard v2 locally redundant | StorageV2 |
| `StandardV2_ZRS` | Standard v2 zone-redundant | StorageV2 |
| `StandardV2_GRS` | Standard v2 geo-redundant | StorageV2 |
| `StandardV2_GZRS` | Standard v2 geo-zone-redundant | StorageV2 |
| `PremiumV2_LRS` | Premium v2 locally redundant | BlockBlobStorage |
| `PremiumV2_ZRS` | Premium v2 zone-redundant | BlockBlobStorage |

> **Note:** SKU cannot be changed to `Standard_ZRS`, `Premium_LRS`, or `Premium_ZRS` after creation.
