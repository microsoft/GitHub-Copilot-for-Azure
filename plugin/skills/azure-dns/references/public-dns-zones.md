# Azure Public DNS Zones

## Overview

Azure DNS hosts your public DNS zones on Microsoft's global network of name servers, providing high availability and fast query performance. When you host a zone in Azure DNS, you manage your DNS records using the same credentials, APIs, tools, and billing as your other Azure services.

Azure DNS does not support domain purchasing. To host a domain, you must own it and configure your domain registrar to delegate to the Azure DNS name servers assigned to your zone.

## Creating a Public DNS Zone

```bash
# Create a zone
az network dns zone create \
  --resource-group MyRG \
  --name contoso.com

# Verify the zone and note the assigned name servers
az network dns zone show \
  --resource-group MyRG \
  --name contoso.com \
  --query nameServers \
  --output tsv
```

Azure assigns four name servers from the pool (e.g., `ns1-04.azure-dns.com`, `ns2-04.azure-dns.net`, `ns3-04.azure-dns.org`, `ns4-04.azure-dns.info`). These four servers span different top-level domains for resilience.

## Delegating Your Domain to Azure DNS

Delegation is the critical step that makes Azure DNS authoritative for your domain. At your domain registrar (GoDaddy, Namecheap, Route 53, etc.), replace the existing NS records with the four Azure DNS name servers.

**Steps:**

1. Create the zone in Azure DNS (see above).
2. Note the four name servers from the zone properties.
3. Log in to your registrar's management console.
4. Replace the NS records for your domain with Azure's name servers.
5. Wait for propagation (can take up to 48 hours, typically minutes to hours).

**Verification:**

```bash
# Check delegation from the internet
nslookup -type=NS contoso.com
# Or use dig
dig NS contoso.com +short
```

If delegation is correct, the response should list your Azure DNS name servers.

**Common mistakes:**
- Forgetting the trailing dot on NS records at some registrars (e.g., `ns1-04.azure-dns.com.`).
- Changing NS records for a subdomain instead of the apex.
- Not waiting for TTL expiry on old NS records.

## Record Management

### Creating Records

```bash
# A record
az network dns record-set a add-record -g MyRG -z contoso.com -n www -a 203.0.113.10

# AAAA record
az network dns record-set aaaa add-record -g MyRG -z contoso.com -n www -a 2001:db8::1

# CNAME record
az network dns record-set cname set-record -g MyRG -z contoso.com -n blog -c blogapp.azurewebsites.net

# MX record
az network dns record-set mx add-record -g MyRG -z contoso.com -n @ -e mail.contoso.com -p 10

# TXT record (SPF)
az network dns record-set txt add-record -g MyRG -z contoso.com -n @ \
  -v "v=spf1 include:spf.protection.outlook.com -all"

# Multiple records in one record set (round-robin)
az network dns record-set a add-record -g MyRG -z contoso.com -n www -a 203.0.113.10
az network dns record-set a add-record -g MyRG -z contoso.com -n www -a 203.0.113.11
```

### Updating Records

```bash
# Update TTL on a record set
az network dns record-set a update -g MyRG -z contoso.com -n www --set ttl=300
```

### Deleting Records

```bash
# Remove a specific record from a record set
az network dns record-set a remove-record -g MyRG -z contoso.com -n www -a 203.0.113.10

# Delete an entire record set
az network dns record-set a delete -g MyRG -z contoso.com -n www --yes
```

### Listing Records

```bash
# List all record sets in a zone
az network dns record-set list -g MyRG -z contoso.com -o table

# List only A records
az network dns record-set a list -g MyRG -z contoso.com -o table
```

## Alias Record Sets

Alias records are an Azure DNS extension that allows a record set to refer to an Azure resource instead of a static IP. The key advantage: when the Azure resource's IP changes, the DNS record automatically updates.

**Supported alias targets:**
- Azure Public IP address
- Azure Traffic Manager profile
- Azure CDN endpoint
- Azure Front Door (classic)
- Another record set in the same zone

**Creating an alias record:**

```bash
# Alias A record at zone apex pointing to a public IP
az network dns record-set a create -g MyRG -z contoso.com -n @ \
  --target-resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/publicIPAddresses/MyPublicIP

# Alias CNAME pointing to a Traffic Manager profile
az network dns record-set cname create -g MyRG -z contoso.com -n app \
  --target-resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/trafficManagerProfiles/MyTMProfile
```

### Zone Apex Limitations

The DNS protocol forbids CNAME records at the zone apex (`@` or bare domain like `contoso.com`). This creates a problem when you want to point your bare domain to an Azure load balancer, App Service, or CDN that only provides a hostname.

**Alias records solve this.** You can create an alias A or AAAA record at the apex that tracks the IP of an Azure resource. The record appears as a standard A record to DNS clients, but Azure DNS automatically resolves the underlying resource IP.

```bash
# Point contoso.com (apex) to an Azure load balancer public IP
az network dns record-set a create -g MyRG -z contoso.com -n @ \
  --target-resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/publicIPAddresses/LBPublicIP
```

## TTL Guidance

TTL (Time To Live) controls how long resolvers cache your record before re-querying. Set it per record set.

| Scenario | Recommended TTL | Reason |
|----------|----------------|--------|
| Stable production records | 3600s (1 hour) | Reduces query volume and cost |
| Pre-migration (lower in advance) | 60–300s | Ensures fast cutover when IP changes |
| During migration/cutover | 60s | Minimizes stale cache impact |
| Post-migration (raise back) | 3600s | Return to normal caching |
| Alias records | 0–60s or omit | Azure DNS refreshes alias targets automatically |

**Important:** Lower the TTL *before* a planned change. If your current TTL is 3600s, lower it at least 1 hour before the change so caches expire.

```bash
# Lower TTL before migration
az network dns record-set a update -g MyRG -z contoso.com -n www --set ttl=60

# After migration stabilizes, raise TTL
az network dns record-set a update -g MyRG -z contoso.com -n www --set ttl=3600
```

## Subdomain Delegation

You can delegate a subdomain to a child zone within Azure DNS (or to another DNS provider).

```bash
# Create the child zone
az network dns zone create -g MyRG -n staging.contoso.com

# Get the child zone's name servers
az network dns zone show -g MyRG -n staging.contoso.com --query nameServers -o tsv

# In the parent zone, create NS records for the subdomain
az network dns record-set ns add-record -g MyRG -z contoso.com -n staging -d ns1-08.azure-dns.com
az network dns record-set ns add-record -g MyRG -z contoso.com -n staging -d ns2-08.azure-dns.net
az network dns record-set ns add-record -g MyRG -z contoso.com -n staging -d ns3-08.azure-dns.org
az network dns record-set ns add-record -g MyRG -z contoso.com -n staging -d ns4-08.azure-dns.info
```

Each child zone is managed independently and can be in a different resource group or subscription, enabling team-level DNS management.

## DNSSEC Support

Azure DNS supports DNSSEC (Domain Name System Security Extensions) for public zones. DNSSEC adds cryptographic signatures to DNS records, allowing resolvers to verify that responses have not been tampered with.

**Enabling DNSSEC:**

```bash
# Enable DNSSEC signing on the zone
az network dns dnssec-config create -g MyRG -z contoso.com
```

After enabling, Azure DNS signs your zone. You must then add DS (Delegation Signer) records at your registrar to complete the chain of trust.

**Important considerations:**
- DNSSEC adds computational overhead to signing — negligible for most zones.
- If you disable DNSSEC, remove DS records from your registrar first to avoid validation failures.
- Not all registrars support DS record management — verify before enabling.

## Pricing Model

Azure DNS pricing has two components:

1. **Zone hosting:** Per zone per month (first 25 zones at one rate, additional zones at a reduced rate).
2. **DNS queries:** Per million queries (first 1 billion queries at one rate, additional queries at a reduced rate).

Alias record queries against Azure resources (public IP, Traffic Manager, etc.) are free. This makes alias records cost-effective for high-traffic apex domains.

Check [Azure DNS pricing](https://azure.microsoft.com/pricing/details/dns/) for current rates.

## Troubleshooting

### Delegation Not Working

1. **Verify NS records at registrar** — use `dig NS contoso.com` from an external resolver. The response must show Azure DNS name servers.
2. **Check for typos** in name server names. They must exactly match the values from `az network dns zone show`.
3. **Wait for propagation** — old NS records may be cached. Check the TTL on the previous NS records.
4. **Test from multiple locations** — use tools like `dig @8.8.8.8 NS contoso.com` to query specific resolvers.

### Records Not Resolving

1. **Confirm the record exists:** `az network dns record-set a show -g MyRG -z contoso.com -n www`
2. **Check TTL caching:** Resolvers cache records for the TTL duration. Use `dig www.contoso.com +trace` to bypass cache.
3. **Verify delegation first** — if delegation is broken, no records resolve.
4. **Check for CNAME conflicts:** A CNAME at `www` blocks any other record type at `www`.

### TTL Cache Issues

- Records appear to return old values: the resolver is serving cached data. Wait for the TTL to expire or flush your local DNS cache (`ipconfig /flushdns` on Windows, `sudo dscacheutil -flushcache` on macOS).
- After lowering TTL, the change itself is subject to the *previous* TTL — plan ahead.

### Zone Not Appearing in Portal

- Verify the resource group and subscription. Use `az network dns zone list --output table` to find all zones.
- Check Azure RBAC — you need at least Reader on the zone to see it.
