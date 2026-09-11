---
name: azure-dns
description: "Manage Azure DNS zones (public and private), DNS records, Private DNS Resolver, and name resolution for Azure workloads. WHEN: DNS zone, DNS record, custom domain, private DNS, name resolution, DNS resolver, conditional forwarding. DO NOT USE FOR: Traffic Manager DNS routing (use azure-traffic-manager), CDN/Front Door custom domains (use azure-front-door), private endpoint DNS only (use azure-private-link)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure DNS Skill

## When to Use This Skill

- User wants to host a public DNS zone in Azure
- User needs to create or manage DNS records (A, AAAA, CNAME, MX, TXT, SRV, NS, SOA)
- User wants to set up Azure Private DNS zones for internal name resolution
- User needs DNS resolution between Azure VNets and on-premises networks
- User asks about Azure DNS Private Resolver for hybrid DNS
- User wants to configure conditional forwarding or DNS forwarding rulesets
- User needs to delegate a subdomain to Azure DNS
- User wants auto-registration of VM names in a Private DNS zone

## Rules

1. Azure DNS uses authoritative name servers — you must delegate your domain to Azure DNS NS records at your registrar.
2. Private DNS zones require VNet links to work — a zone with no links resolves nothing.
3. Auto-registration in Private DNS zones registers VM names automatically — enable only on appropriate VNet links.
4. Only ONE Private DNS zone with auto-registration can be linked to a VNet.
5. CNAME records cannot coexist with other record types at the same name (RFC requirement).
6. Use alias records for zone apex (@ records) pointing to Azure resources — CNAME is not allowed at apex.
7. DNS Private Resolver requires a dedicated subnet (/28 minimum for inbound, /28 minimum for outbound).
8. TTL values affect DNS cache — use low TTL (60-300s) during migrations, higher (3600s) for stable records.
9. Azure DNS supports DNSSEC for public zones — recommend enabling for security-critical domains.
10. For hybrid DNS (on-premises ↔ Azure), always design the forwarding direction carefully to avoid loops.

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Azure Public DNS | Hosting public-facing DNS zones | `azure__dns` → `zone_list`, `record_set_list` | `az network dns zone`, `az network dns record-set` |
| Azure Private DNS | Internal name resolution within VNets | — | `az network private-dns zone`, `az network private-dns record-set` |
| DNS Private Resolver | Hybrid DNS between Azure and on-premises | — | `az dns-resolver create`, `az dns-resolver inbound-endpoint create` |

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__dns` | `zone_list` | List all DNS zones in a subscription or resource group |
| `azure__dns` | `record_set_list` | List record sets in a DNS zone |

## CLI Fallback

```bash
# Public DNS zone
az network dns zone create -g MyRG -n contoso.com
az network dns zone show -g MyRG -n contoso.com
az network dns zone list -g MyRG -o table

# DNS records
az network dns record-set a create -g MyRG -z contoso.com -n www
az network dns record-set a add-record -g MyRG -z contoso.com -n www -a 1.2.3.4
az network dns record-set cname set-record -g MyRG -z contoso.com -n blog -c blog.azurewebsites.net
az network dns record-set mx add-record -g MyRG -z contoso.com -n @ -e mail.contoso.com -p 10
az network dns record-set txt add-record -g MyRG -z contoso.com -n @ -v "v=spf1 include:spf.protection.outlook.com -all"

# Private DNS zone
az network private-dns zone create -g MyRG -n contoso.internal
az network private-dns link vnet create -g MyRG --zone-name contoso.internal \
  -n MyVNetLink --virtual-network MyVNet --registration-enabled true
az network private-dns record-set a add-record -g MyRG -z contoso.internal -n myvm -a 10.0.1.5

# DNS Private Resolver
az dns-resolver create -g MyRG -n MyResolver --id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/MyVNet
az dns-resolver inbound-endpoint create -g MyRG --resolver-name MyResolver -n InboundEndpoint \
  --ip-configurations "[{private-ip-allocation-method:Dynamic,id:/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/MyVNet/subnets/InboundSubnet}]"
az dns-resolver outbound-endpoint create -g MyRG --resolver-name MyResolver -n OutboundEndpoint \
  --id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/MyVNet/subnets/OutboundSubnet
az dns-resolver forwarding-ruleset create -g MyRG -n MyRuleset \
  --outbound-endpoints "[{id:/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/dnsResolvers/MyResolver/outboundEndpoints/OutboundEndpoint}]"
az dns-resolver forwarding-rule create -g MyRG --ruleset-name MyRuleset -n ForwardOnPrem \
  --domain-name "corp.contoso.com." --forwarding-rule-state Enabled \
  --target-dns-servers "[{ip-address:10.1.0.4,port:53}]"
```

## Key Concepts

### DNS Record Types Quick Reference

| Type | Purpose | Example |
|------|---------|---------|
| A | IPv4 address mapping | www → 1.2.3.4 |
| AAAA | IPv6 address mapping | www → 2001:db8::1 |
| CNAME | Alias to another name | blog → blog.azurewebsites.net |
| MX | Mail exchange routing | @ → mail.contoso.com (priority 10) |
| TXT | Text data (SPF, DKIM, verification) | @ → "v=spf1 ..." |
| SRV | Service locator | _sip._tcp → sipserver:5060 |
| NS | Delegation to name servers | sub → ns1.azure-dns.com |
| SOA | Start of authority (auto-managed) | Zone metadata |
| CAA | Certificate authority authorization | @ → letsencrypt.org |
| PTR | Reverse DNS lookup | 4.3.2.1 → www.contoso.com |

### Azure DNS Limits

| Resource | Limit |
|----------|-------|
| Public DNS zones per subscription | 250 |
| Record sets per public DNS zone | 10,000 |
| Records per record set | 20 |
| Private DNS zones per subscription | 1,000 |
| VNet links per Private DNS zone | 1,000 |
| Auto-registration VNet links per Private DNS zone | 100 |
| Private DNS zones per VNet (with auto-registration) | 1 |
| Private DNS zones per VNet (resolution only) | 1,000 |
| DNS Private Resolver inbound endpoints | 10 per resolver |
| DNS Private Resolver outbound endpoints | 10 per resolver |
| Forwarding rules per ruleset | 1,000 |

## References

- [Public DNS Zones](references/public-dns-zones.md)
- [Private DNS Zones](references/private-dns-zones.md)
- [DNS Private Resolver](references/dns-private-resolver.md)
- [Record Types Reference](references/record-types.md)
