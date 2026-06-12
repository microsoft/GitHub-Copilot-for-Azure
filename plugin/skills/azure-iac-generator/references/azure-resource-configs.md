# Azure Resource Configuration Reference

Per-resource-type property retrieval mapping for drift detection and Bicep generation. For per-resource defaults (SKUs, sizes, settings), derive from Bicep MCP `get_az_resource_type_schema`, Azure Verified Modules, or Microsoft documentation. Do not hardcode defaults — verify at generation time.

## SKU Extraction Rules (Global)

For all resource types with `skuName` / `skuTier` properties, extract from the top-level `sku` object:
- `sku.name` → `skuName`
- `sku.tier` → `skuTier`

**Composite property** — `Microsoft.Compute/virtualMachines` `osImage`: assembled from `storageProfile.imageReference` as `publisher:offer:sku:version`.

## Per-Resource Property Maps

Detailed ARM field paths are split by category. Load the relevant file on demand:

- **Compute & Containers**: [resource-configs-compute.md](resource-configs-compute.md) — VMs, VMSS, App Service, Functions, AKS, Container Apps, ACR
- **Networking**: [resource-configs-network.md](resource-configs-network.md) — VNet, Subnet, NSG, Load Balancer, App Gateway, Public IP, NIC, Private Endpoints, VNet Gateway, Firewall, Bastion, Private DNS
- **Data & Storage**: [resource-configs-data.md](resource-configs-data.md) — Storage Accounts, SQL Server/DB, Cosmos DB, Redis
- **Platform & Integration**: [resource-configs-platform.md](resource-configs-platform.md) — Key Vault, App Insights, Log Analytics, Service Bus, Event Hub, APIM

## Auto-Detection Rules

Topology-based settings applied automatically during generation: [auto-detection-rules.md](auto-detection-rules.md)
