# DNS Resolution Troubleshooting Guide

Diagnose and fix Azure DNS resolution failures including Private DNS zone issues, split-brain DNS, conditional forwarding failures, and DNS Private Resolver problems.

## How Azure DNS Resolution Works

By default, Azure VMs use Azure-provided DNS at `168.63.129.16`. This resolver handles:
- Public DNS resolution (internet names)
- Azure Private DNS zone resolution (if zones are linked to the VNet)
- Azure-internal names (`<vm-name>.internal.cloudapp.net`)

If custom DNS servers are configured on the VNet, ALL DNS queries go to those servers instead.

## Step 1 — Identify the DNS Configuration

```bash
# Check VNet DNS settings
az network vnet show \
  --resource-group <rg> \
  --name <vnet> \
  --query "{dnsServers:dhcpOptions.dnsServers, addressSpace:addressSpace.addressPrefixes}"
```

| Result | Meaning |
|--------|---------|
| `dnsServers: []` or `null` | Azure-provided DNS (168.63.129.16) — default |
| `dnsServers: ["10.0.0.4"]` | Custom DNS — all queries go to this server |
| `dnsServers: ["10.0.0.4", "168.63.129.16"]` | Primary custom, fallback to Azure DNS |

## Step 2 — Test DNS from Inside the VM

Always test from the VM itself, not from your local machine.

### Linux VM

```bash
az vm run-command invoke \
  --resource-group <rg> \
  --name <vm-name> \
  --command-id RunShellScript \
  --scripts "
    echo '=== resolv.conf ==='
    cat /etc/resolv.conf
    echo '=== nslookup test ==='
    nslookup <hostname>
    echo '=== dig test ==='
    dig <hostname> +short
    echo '=== dig with specific server ==='
    dig @168.63.129.16 <hostname> +short
  "
```

### Windows VM

```bash
az vm run-command invoke \
  --resource-group <rg> \
  --name <vm-name> \
  --command-id RunPowerShellScript \
  --scripts "
    Write-Output '=== DNS Client Config ==='
    Get-DnsClientServerAddress -AddressFamily IPv4 | Format-Table
    Write-Output '=== Resolve-DnsName ==='
    Resolve-DnsName '<hostname>' -ErrorAction SilentlyContinue | Format-Table
    Write-Output '=== Test with Azure DNS ==='
    Resolve-DnsName '<hostname>' -Server 168.63.129.16 -ErrorAction SilentlyContinue | Format-Table
  "
```

## Common DNS Problems

### Problem: Private DNS Zone Not Resolving

**Symptom:** `nslookup <name>.privatelink.blob.core.windows.net` returns NXDOMAIN or the public IP instead of the private endpoint IP.

**Diagnosis:**

```bash
# Check if the private DNS zone exists
az network private-dns zone show \
  --resource-group <rg> \
  --name <zone-name>

# Check if the zone is linked to the VNet
az network private-dns link vnet list \
  --resource-group <rg> \
  --zone-name <zone-name> \
  --output table

# Check the A record exists
az network private-dns record-set a list \
  --resource-group <rg> \
  --zone-name <zone-name> \
  --output table
```

**Common causes and fixes:**

1. **Zone not linked to VNet:**
```bash
az network private-dns link vnet create \
  --resource-group <rg> \
  --zone-name <zone-name> \
  --name <link-name> \
  --virtual-network <vnet-resource-id> \
  --registration-enabled false
```

2. **A record missing (private endpoint created but DNS record not auto-registered):**
```bash
# Check the private endpoint's network interface for its IP
az network private-endpoint show \
  --resource-group <rg> \
  --name <pe-name> \
  --query "customDnsConfigurations[].{fqdn:fqdn, ipAddress:ipAddresses[0]}"

# Manually create the A record if needed
az network private-dns record-set a add-record \
  --resource-group <rg> \
  --zone-name <zone-name> \
  --record-set-name <record-name> \
  --ipv4-address <private-endpoint-ip>
```

3. **Custom DNS server not forwarding to Azure DNS:**
If the VNet uses a custom DNS server, that server must forward `privatelink.*` zones to `168.63.129.16` for Private DNS zone resolution to work.

### Problem: Split-Brain DNS

**Symptom:** A hostname resolves to the public IP from outside Azure but should resolve to the private IP from inside Azure.

**How it works:** Azure Private DNS zones take precedence over public DNS when linked to the VNet. For example, `storageaccount.blob.core.windows.net` has a CNAME to `storageaccount.privatelink.blob.core.windows.net`. If a Private DNS zone for `privatelink.blob.core.windows.net` is linked to the VNet, the private IP is returned.

**Diagnosis:**
```bash
# From inside the VM — should return private IP
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "dig storageaccount.blob.core.windows.net +short"

# Check the CNAME chain
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "dig storageaccount.blob.core.windows.net +trace"
```

**Fix:** Ensure the correct Private DNS zone is linked to the VNet:

| Azure Service | Private DNS Zone Name |
|---------------|----------------------|
| Blob Storage | `privatelink.blob.core.windows.net` |
| Azure SQL | `privatelink.database.windows.net` |
| Key Vault | `privatelink.vaultcore.azure.net` |
| Azure Container Registry | `privatelink.azurecr.io` |
| Azure Web Apps | `privatelink.azurewebsites.net` |
| Cosmos DB | `privatelink.documents.azure.com` |
| Event Hubs | `privatelink.servicebus.windows.net` |

Full list: [Azure Private Endpoint DNS configuration](https://learn.microsoft.com/azure/private-link/private-endpoint-dns)

### Problem: Conditional Forwarding Failures

**Symptom:** On-premises clients cannot resolve Azure Private DNS zone names. Or Azure VMs cannot resolve on-premises DNS names.

**Architecture review:**
- Azure VMs use Azure DNS → which resolves Private DNS zones natively
- On-premises clients use on-premises DNS → must forward Azure zones to a DNS resolver in Azure
- The DNS resolver can be: Azure DNS Private Resolver, a custom DNS VM, or Azure Firewall DNS proxy

**Diagnosis for on-premises → Azure resolution:**

```bash
# Check if DNS Private Resolver exists and has an inbound endpoint
az dns-resolver inbound-endpoint list \
  --resource-group <rg> \
  --dns-resolver-name <resolver-name> \
  --output table

# The inbound endpoint IP is what on-premises DNS should forward to
```

**Diagnosis for Azure → on-premises resolution:**

```bash
# Check if a DNS forwarding ruleset exists
az dns-resolver forwarding-ruleset list \
  --resource-group <rg> \
  --output table

# Check forwarding rules
az dns-resolver forwarding-rule list \
  --resource-group <rg> \
  --dns-forwarding-ruleset-name <ruleset-name> \
  --output table

# Verify the ruleset is linked to the VNet
az dns-resolver vnet-link list \
  --resource-group <rg> \
  --dns-forwarding-ruleset-name <ruleset-name> \
  --output table
```

### Problem: DNS Private Resolver Issues

**Symptom:** DNS Private Resolver deployed but queries are not being forwarded or resolved.

**Diagnosis checklist:**

```bash
# 1. Verify resolver is provisioned successfully
az dns-resolver show \
  --resource-group <rg> \
  --name <resolver-name> \
  --query "{state:provisioningState, resourceGuid:resourceGuid}"

# 2. Check inbound endpoints (for receiving queries)
az dns-resolver inbound-endpoint list \
  --resource-group <rg> \
  --dns-resolver-name <resolver-name> \
  --query "[].{name:name, ip:ipConfigurations[0].privateIpAddress, subnet:ipConfigurations[0].subnet.id}"

# 3. Check outbound endpoints (for forwarding queries)
az dns-resolver outbound-endpoint list \
  --resource-group <rg> \
  --dns-resolver-name <resolver-name> \
  --query "[].{name:name, subnet:subnet.id}"

# 4. Check forwarding rules
az dns-resolver forwarding-rule list \
  --resource-group <rg> \
  --dns-forwarding-ruleset-name <ruleset-name> \
  --query "[].{domain:domainName, targets:targetDnsServers[].ipAddress, state:provisioningState}"
```

**Common fixes:**
- Inbound endpoint must be in a **dedicated subnet** (no other resources)
- Outbound endpoint must be in a **different dedicated subnet**
- Forwarding rules must include the trailing dot (e.g., `contoso.com.`)
- Target DNS servers must be reachable from the outbound endpoint's subnet (check NSGs and routing)

### Problem: Auto-Registration Not Working

**Symptom:** VM hostname not appearing in the Private DNS zone despite auto-registration being enabled.

```bash
# Check if the VNet link has registration enabled
az network private-dns link vnet show \
  --resource-group <rg> \
  --zone-name <zone-name> \
  --name <link-name> \
  --query "registrationEnabled"

# Check registered records
az network private-dns record-set a list \
  --resource-group <rg> \
  --zone-name <zone-name> \
  --output table
```

**Constraints:**
- Only **one** Private DNS zone per VNet can have auto-registration enabled
- Only VMs in the linked VNet get auto-registered — not PaaS services
- The zone name must be valid (e.g., `contoso.internal`)

## Diagnostic Commands Quick Reference

```bash
# Resolve using Azure DNS directly
dig @168.63.129.16 <hostname>

# Resolve using a specific DNS server
dig @<dns-server-ip> <hostname>

# Trace the full resolution path
dig <hostname> +trace

# Check reverse DNS
dig -x <ip-address>

# Test DNS over TCP (if UDP is blocked)
dig <hostname> +tcp

# Windows equivalents
nslookup <hostname>
nslookup <hostname> 168.63.129.16
Resolve-DnsName <hostname> -Server 168.63.129.16
```

## Related Resources

- [Azure DNS Private Resolver](https://learn.microsoft.com/azure/dns/dns-private-resolver-overview)
- [Private endpoint DNS configuration](https://learn.microsoft.com/azure/private-link/private-endpoint-dns)
- [Name resolution for resources in Azure virtual networks](https://learn.microsoft.com/azure/virtual-network/virtual-networks-name-resolution-for-vms-and-role-instances)
- For detailed DNS service configuration → use `azure-dns` skill
- For private endpoint issues → use `azure-private-link` skill
