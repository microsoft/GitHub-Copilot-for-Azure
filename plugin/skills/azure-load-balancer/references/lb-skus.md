# Azure Load Balancer SKU Comparison and Migration

## SKU Overview

Azure Load Balancer has three SKU types. Basic SKU is **deprecated** with retirement on **September 30, 2025**.

### Standard Load Balancer

The default and recommended SKU for all new deployments.

| Feature | Details |
|---------|---------|
| Backend pool size | Up to 5,000 instances (IP-based) or 1,000 (NIC-based) |
| Health probes | TCP, HTTP, HTTPS |
| Availability Zones | Zone-redundant, zonal, or cross-zone |
| Diagnostics | Azure Monitor multi-dimensional metrics |
| HA Ports | Supported on internal LB |
| Outbound rules | Explicit outbound rule configuration |
| SLA | 99.99% |
| Network Security Groups | Required on subnet or NIC |
| Public + Internal | Both supported |

### Gateway Load Balancer

Designed for transparent NVA (network virtual appliance) chaining.

| Feature | Details |
|---------|---------|
| Type | Internal only |
| Protocol | VXLAN tunnel (port 10800) |
| Chaining | Referenced from consumer LB frontend or VM NIC |
| Use cases | Firewalls, DDoS appliances, deep packet inspection, IDS/IPS |
| Backend | NVA instances |
| HA Ports | Always enabled (all protocols, all ports) |

### Cross-region Load Balancer

Global Layer 4 load balancing across Azure regions.

| Feature | Details |
|---------|---------|
| Type | Public only |
| Backend type | Regional Standard public LBs |
| Failover | Automatic on regional health probe failure |
| Latency | Anycast-based, routes to nearest healthy region |
| Static IP | Global static public IP |
| Supported regions | Most Azure public regions |

## Feature Comparison Matrix

| Feature | Basic (Deprecated) | Standard | Gateway | Cross-region |
|---------|-------------------|----------|---------|-------------|
| Backend pool size | 300 | 5,000 (IP) | 100 | Regional LBs |
| Health probes | TCP, HTTP | TCP, HTTP, HTTPS | TCP, HTTP, HTTPS | TCP, HTTP, HTTPS |
| Availability Zones | No | Yes | Yes | Inherits |
| SLA | No SLA | 99.99% | 99.99% | 99.99% |
| NSG required | No | Yes | Yes | N/A |
| Secure by default | No (open) | Yes (closed) | Yes | Yes |
| HA Ports | No | Internal only | Always | No |
| Multiple frontends | No | Yes | N/A | Yes |
| Outbound rules | No | Yes | N/A | N/A |
| Diagnostics | Basic log analytics | Multi-dim metrics | Multi-dim metrics | Multi-dim metrics |
| Cross-VNet backends | No | No | No | Cross-region |
| Global redundancy | No | No | No | Yes |

## Migration from Basic to Standard

### Pre-Migration Checklist

1. **Inventory Basic LBs** — find all Basic SKU load balancers:
   ```bash
   az network lb list --query "[?sku.name=='Basic'].[name,resourceGroup,frontendIpConfigurations[0].publicIpAddress.id]" -o table
   ```

2. **Check associated public IPs** — Basic LB requires Basic SKU PIPs; Standard requires Standard SKU PIPs:
   ```bash
   az network public-ip list --query "[?sku.name=='Basic'].[name,resourceGroup]" -o table
   ```

3. **Verify NSG configuration** — Standard LB requires NSGs. If backends have no NSGs, traffic will be blocked after migration.

4. **Review availability sets** — Basic LB allows mixed; Standard requires all backends in same VNet.

5. **Check outbound connectivity** — Basic provides default outbound; Standard does NOT. Plan outbound strategy before migrating.

### Automated Migration (Recommended)

Use the Azure Load Balancer migration PowerShell module:

```powershell
# Install the module
Install-Module -Name AzureLoadBalancerUpgrade -Force

# Migrate (creates new Standard LB, migrates config)
Start-AzBasicLoadBalancerUpgrade `
  -ResourceGroupName <rg> `
  -BasicLoadBalancerName <basic-lb-name>
```

The automated tool handles:
- Creating Standard LB with same configuration
- Upgrading associated public IPs to Standard SKU
- Migrating backend pool associations
- Re-creating health probes, rules, NAT rules

### Manual Migration Steps

If automated migration is not suitable:

1. **Create Standard public IPs** to replace Basic PIPs
2. **Create the Standard Load Balancer** with new frontend config
3. **Recreate health probes** (HTTPS probes now available)
4. **Recreate load balancing rules** with updated settings
5. **Add outbound rules** or attach NAT Gateway for outbound
6. **Add NSG rules** to allow LB health probe traffic (source: `AzureLoadBalancer`, dest: backend subnet)
7. **Migrate backend pool members** from Basic to Standard
8. **Verify health** — check probe status before removing old LB
9. **Delete Basic LB** and old Basic public IPs

### Post-Migration Validation

```bash
# Verify Standard SKU
az network lb show --name <lb-name> -g <rg> --query "sku"

# Check backend health
az network lb show --name <lb-name> -g <rg> --query "probes[].{name:name,protocol:protocol,port:port}"

# Verify outbound connectivity from a backend VM
az vm run-command invoke --name RunShellScript \
  --command-id RunShellScript \
  --resource-group <rg> \
  --vm-name <vm> \
  --scripts "curl -s ifconfig.me"
```

## Choosing the Right SKU

```
Is your workload L4 (TCP/UDP)?
├── No → Use Application Gateway (L7) or Front Door (global L7)
└── Yes
    ├── Do you need transparent NVA chaining?
    │   └── Yes → Gateway Load Balancer
    ├── Do you need global geo-redundancy at L4?
    │   └── Yes → Cross-region Load Balancer (with regional Standard LBs as backends)
    └── Regional L4 balancing
        └── Standard Load Balancer (public or internal)
```

## Source Documentation

- [Azure Load Balancer SKUs](https://learn.microsoft.com/azure/load-balancer/skus)
- [Migrate from Basic to Standard](https://learn.microsoft.com/azure/load-balancer/upgrade-basic-standard)
- [Gateway Load Balancer overview](https://learn.microsoft.com/azure/load-balancer/gateway-overview)
- [Cross-region Load Balancer](https://learn.microsoft.com/azure/load-balancer/cross-region-overview)
