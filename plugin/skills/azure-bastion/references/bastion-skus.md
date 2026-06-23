# Azure Bastion SKU Comparison

Azure Bastion offers four SKUs — Developer, Basic, Standard, and Premium — each designed for different scale and feature requirements. Choosing the right SKU depends on concurrent session needs, whether native client access is required, and compliance features like session recording.

## SKU Overview

### Developer SKU

The Developer SKU is a free-tier option intended for dev/test environments and individual developers.

**Use cases:**
- Single developer needing occasional VM access during development
- Lab or sandbox environments where only one person connects at a time
- Cost-sensitive scenarios where Bastion features beyond browser-based RDP/SSH are unnecessary

**Key characteristics:**
- Supports only **one concurrent connection** at a time
- Does **not** require a public IP address — deploys as a fully private resource
- Deployed per virtual network, not per subnet in the traditional sense (still uses AzureBastionSubnet)
- No host scaling — fixed at a single instance
- Browser-based RDP/SSH only — no native client, no tunnel support
- No shareable links, no IP-based connections, no Kerberos authentication
- Cannot be used in production workloads that need concurrent access

**Deployment:**
```bash
# Developer SKU — no public IP parameter needed
az network bastion create -g MyRG -n MyBastionDev --vnet-name MyVNet --sku Developer
```

### Basic SKU

The Basic SKU is the entry-level production SKU for teams that only need browser-based RDP/SSH.

**Use cases:**
- Small teams accessing VMs through the Azure portal
- Environments where native client tools are not required
- Workloads where 25+ concurrent sessions are sufficient

**Key characteristics:**
- Supports **25+ concurrent RDP sessions** and **25+ concurrent SSH sessions** with default 2 scale units
- Requires a **Standard SKU public IP** with static allocation
- Browser-based RDP/SSH via the Azure portal
- Does **not** support native client connections (`az network bastion rdp/ssh/tunnel`)
- Does **not** support shareable links
- Does **not** support IP-based connections (must target by Azure resource ID)
- Does **not** support host scaling — fixed at 2 scale units
- Does **not** support Kerberos authentication
- Can be upgraded to Standard (one-way, no downgrade)

**Deployment:**
```bash
az network public-ip create -g MyRG -n BastionPIP --sku Standard --allocation-method Static
az network bastion create -g MyRG -n MyBastion --vnet-name MyVNet \
  --public-ip-address BastionPIP --sku Basic
```

### Standard SKU

The Standard SKU is the recommended choice for most production environments. It unlocks native client support, shareable links, host scaling, and IP-based connections.

**Use cases:**
- Production environments needing native RDP/SSH client access
- Teams that need shareable link access for contractors or support staff
- High-concurrency environments requiring host scaling (2–50 scale units)
- Scenarios requiring IP-based connections to non-Azure or on-premises VMs reachable via the VNet
- Kerberos authentication for domain-joined VMs

**Key characteristics:**
- All Basic SKU features, plus:
- **Native client support** — use `az network bastion rdp`, `az network bastion ssh`, and `az network bastion tunnel`
- **Shareable links** — generate URLs for VM access without portal login
- **Host scaling** — scale from 2 to 50 scale units to handle more concurrent sessions
- **IP-based connection** — connect to VMs by private IP address, not just Azure resource ID
- **Kerberos authentication** — single sign-on for domain-joined Windows VMs
- Can be upgraded to Premium (one-way, no downgrade)

**Deployment:**
```bash
az network public-ip create -g MyRG -n BastionPIP --sku Standard --allocation-method Static
az network bastion create -g MyRG -n MyBastion --vnet-name MyVNet \
  --public-ip-address BastionPIP --sku Standard
```

### Premium SKU

The Premium SKU adds enterprise compliance and enhanced security features on top of Standard.

**Use cases:**
- Regulated industries requiring session recording for audit trails
- Zero-trust architectures needing private-only Bastion deployment (no public IP exposure)
- Organizations with strict compliance requirements (HIPAA, PCI-DSS, SOC 2)

**Key characteristics:**
- All Standard SKU features, plus:
- **Session recording** — record RDP/SSH sessions to a storage account for audit and compliance
- **Private-only deployment** — deploy Bastion without a public IP; access through private endpoints or ExpressRoute/VPN
- Highest tier — no further upgrade path available

**Deployment:**
```bash
az network public-ip create -g MyRG -n BastionPIP --sku Standard --allocation-method Static
az network bastion create -g MyRG -n MyBastion --vnet-name MyVNet \
  --public-ip-address BastionPIP --sku Premium
```

## Full Feature Comparison

| Feature | Developer | Basic | Standard | Premium |
|---------|-----------|-------|----------|---------|
| Concurrent RDP sessions | 1 | 20 (2 units) | Scales with units | Scales with units |
| Concurrent SSH sessions | 1 | 40 (2 units) | Scales with units | Scales with units |
| Public IP required | No | Yes (Standard SKU) | Yes (Standard SKU) | Optional |
| AzureBastionSubnet required | Yes (/26) | Yes (/26+) | Yes (/26+) | Yes (/26+) |
| Browser-based RDP/SSH | Yes | Yes | Yes | Yes |
| Native client (CLI tunnel) | No | No | Yes | Yes |
| Shareable links | No | No | Yes | Yes |
| Host scaling (2–50 units) | No | No | Yes | Yes |
| IP-based connection | No | No | Yes | Yes |
| Kerberos authentication | No | No | Yes | Yes |
| Session recording | No | No | No | Yes |
| Private-only deployment | No | No | No | Yes |
| File transfer (browser) | No | Yes | Yes | Yes |
| Copy/paste in browser | Yes | Yes | Yes | Yes |

## SKU Upgrade Path

Upgrades are **one-way only** — you cannot downgrade a SKU once upgraded.

```
Developer → Basic → Standard → Premium
```

- **Developer → Basic**: Requires adding a Standard SKU public IP and re-deploying.
- **Basic → Standard**: In-place upgrade via `az network bastion update` or Azure portal. No downtime for existing connections, but new features become available immediately.
- **Standard → Premium**: In-place upgrade. Session recording and private-only options become available.

```bash
# Upgrade Basic to Standard
az network bastion update -g MyRG -n MyBastion --sku Standard

# Upgrade Standard to Premium
az network bastion update -g MyRG -n MyBastion --sku Premium
```

> **Warning:** If you upgrade from Basic to Standard and later decide Standard features are unnecessary, you cannot revert to Basic. Plan SKU selection carefully.

## Pricing Considerations

Bastion pricing is based on two components:

1. **Hourly charge per deployment** — billed per Bastion host, varies by SKU tier
2. **Data transfer (outbound)** — standard Azure egress charges apply

**Scale units affect cost directly:**
- Each scale unit adds incremental hourly cost (Standard and Premium only)
- Default is 2 scale units; increasing to 10 or 50 units multiplies the per-unit hourly rate
- Developer SKU has the lowest cost (often free-tier eligible for limited hours)
- Basic SKU is fixed at 2 units — no scaling, predictable cost

**Cost optimization tips:**
- Use Developer SKU for dev/test to minimize cost
- Start with 2 scale units in Standard/Premium and scale up only when concurrency demands it
- Delete Bastion hosts in non-production environments when not in use — Bastion billing is hourly
- Consider a single Bastion host with VNet peering to serve multiple VNets

## Subnet and Public IP Requirements

All SKUs require a subnet named **exactly** `AzureBastionSubnet`:
- Minimum prefix: **/26** (64 addresses) — applies to all SKUs
- Recommended: **/26** is sufficient for most deployments; use /25 or larger only if deploying many scale units
- The subnet must not contain any other resources (no VMs, NICs, or other services)
- No UDRs (User Defined Routes) are supported on AzureBastionSubnet

**Public IP requirements:**
- Developer SKU: No public IP required
- Basic, Standard: Standard SKU public IP with static allocation is **mandatory**
- Premium: Public IP is optional (supports private-only deployment)

## NSG Rules on AzureBastionSubnet

By default, do **not** apply an NSG to AzureBastionSubnet — Bastion manages its own security. If organizational policy requires an NSG, the following rules are mandatory:

**Inbound rules (required):**
| Priority | Source | Port | Destination | Port | Protocol | Action |
|----------|--------|------|-------------|------|----------|--------|
| 120 | Internet | * | * | 443 | TCP | Allow |
| 130 | GatewayManager | * | * | 443 | TCP | Allow |
| 140 | AzureLoadBalancer | * | * | 443 | TCP | Allow |
| 150 | VirtualNetwork | * | * | 8080, 5701 | Any | Allow |

**Outbound rules (required):**
| Priority | Source | Port | Destination | Port | Protocol | Action |
|----------|--------|------|-------------|------|----------|--------|
| 120 | * | * | VirtualNetwork | 22, 3389 | Any | Allow |
| 130 | * | * | AzureCloud | 443 | TCP | Allow |
| 140 | * | * | Internet | 80 | TCP | Allow |

> **Critical:** Omitting any of these rules will break Bastion connectivity. The GatewayManager inbound rule is required for the Bastion control plane.

## Decision Tree: Choosing a SKU

```
Need VM access for development/testing only?
├── Yes, single user → Developer SKU
└── No, production use
    ├── Browser-only access is sufficient, <25 concurrent users → Basic SKU
    └── Need native client, scaling, or shareable links?
        ├── Yes, no session recording needed → Standard SKU
        └── Need session recording or private-only deployment → Premium SKU
```

**Quick recommendation:**
- **Developer** — solo dev/test, budget-conscious
- **Basic** — small team, browser-only, simple setup
- **Standard** — most production workloads (recommended default)
- **Premium** — regulated environments with audit requirements
