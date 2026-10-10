---
name: azure-bastion
description: "Deploy and configure Azure Bastion for secure RDP/SSH access to Azure VMs without public IP exposure, including Developer, Basic, Standard, and Premium SKUs. WHEN: bastion, connect to VM, RDP without public IP, SSH securely, remote access VM, AzureBastionSubnet. DO NOT USE FOR: VPN site-to-site connectivity (use azure-vpn-gateway), application-level load balancing (use azure-application-gateway), network security rules (use azure-virtual-network)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Bastion Skill

## When to Use This Skill

- User wants to connect to a VM via RDP or SSH without exposing a public IP
- User asks about Azure Bastion deployment or SKU selection
- User needs to configure the AzureBastionSubnet
- User wants to use native RDP/SSH clients with Bastion (tunnel mode)
- User asks about shareable links for VM access
- User needs to upgrade or downgrade a Bastion SKU
- User wants to troubleshoot Bastion connectivity issues

## Rules

1. The subnet MUST be named exactly `AzureBastionSubnet` — any other name will fail deployment.
2. AzureBastionSubnet requires a /26 or larger prefix (minimum 64 addresses) for Basic/Standard/Premium SKUs.
3. Developer SKU can use a /26 subnet and does not require a public IP, but only supports one concurrent connection.
4. Do NOT place NSG on AzureBastionSubnet unless using specific required rules — Bastion manages its own security.
5. Standard and Premium SKUs support native client connections, shareable links, and host scaling.
6. Basic SKU does NOT support native client, shareable links, or IP-based connections — recommend Standard for most production use.
7. You can upgrade from Basic → Standard → Premium, but you CANNOT downgrade SKUs.
8. Bastion uses TLS over port 443 — ensure outbound 443 is allowed from the client browser.
9. For native client RDP/SSH, users must install Azure CLI and use `az network bastion rdp` or `az network bastion ssh`.
10. Bastion connects to VMs using private IPs — VMs do NOT need public IPs.

## MCP Tools

> Azure Bastion has limited MCP tool support. Use CLI commands for all operations.

## CLI Fallback

```bash
# Create AzureBastionSubnet
az network vnet subnet create -g MyRG --vnet-name MyVNet -n AzureBastionSubnet \
  --address-prefix 10.0.255.0/26

# Create public IP for Bastion (Standard SKU required)
az network public-ip create -g MyRG -n BastionPublicIP --sku Standard --allocation-method Static

# Create Bastion host (Standard SKU)
az network bastion create -g MyRG -n MyBastion --vnet-name MyVNet \
  --public-ip-address BastionPublicIP --sku Standard

# Create Bastion host (Developer SKU — no public IP needed)
az network bastion create -g MyRG -n MyBastionDev --vnet-name MyVNet --sku Developer

# Connect via native RDP client
az network bastion rdp -g MyRG -n MyBastion --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyVM

# Connect via native SSH client
az network bastion ssh -g MyRG -n MyBastion --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyVM \
  --auth-type ssh-key --ssh-key ~/.ssh/id_rsa

# Create tunnel for custom port forwarding
az network bastion tunnel -g MyRG -n MyBastion --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyVM \
  --resource-port 3389 --port 50001

# Show Bastion details
az network bastion show -g MyRG -n MyBastion
az network bastion list -g MyRG -o table

# Update Bastion scale units (Standard/Premium only)
az network bastion update -g MyRG -n MyBastion --scale-units 4

# Enable shareable links (Standard/Premium only)
az network bastion update -g MyRG -n MyBastion --enable-shareable-link true
```

## Key Concepts

### SKU Comparison

| Feature | Developer | Basic | Standard | Premium |
|---------|-----------|-------|----------|---------|
| Concurrent sessions | 1 | 25+ | 50+ (scales) | 50+ (scales) |
| Public IP required | No | Yes | Yes | Yes |
| AzureBastionSubnet size | /26 | /26 | /26 | /26 |
| Native client support | No | No | Yes | Yes |
| Shareable links | No | No | Yes | Yes |
| Host scaling | No | No | Yes (2-50 units) | Yes (2-50 units) |
| IP-based connection | No | No | Yes | Yes |
| Kerberos authentication | No | No | Yes | Yes |
| Session recording | No | No | No | Yes |
| Private-only deployment | No | No | No | Yes |
| SKU upgrade path | → Basic | → Standard | → Premium | — |

### Scale Units and Sessions

| Scale Units | Concurrent RDP | Concurrent SSH |
|-------------|---------------|----------------|
| 2 (default) | 20 | 40 |
| 4 | 40 | 80 |
| 10 | 100 | 200 |
| 50 (max) | 500 | 1000 |

## References

- [Bastion SKU Comparison](references/bastion-skus.md)
- [Native Client Guide](references/native-client.md)
- [Shareable Links](references/shareable-links.md)
