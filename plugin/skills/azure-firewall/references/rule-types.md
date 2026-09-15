# Azure Firewall Rule Types and Processing Order

Azure Firewall processes traffic through three rule types, each evaluated in a specific order. Understanding this order is critical for writing rules that behave as expected.

## Rule Processing Order

```
Incoming traffic
  │
  ▼
┌─────────────┐    Match → Translate + Allow
│  DNAT Rules │
└──────┬──────┘
       │ No match
       ▼
┌──────────────┐   Match → Allow/Deny
│ Network Rules│
└──────┬───────┘
       │ No match
       ▼
┌──────────────────┐   Match → Allow/Deny
│ Application Rules│
└──────────────────┘
       │ No match
       ▼
    Default Deny (all traffic blocked)
```

**Key principle**: Processing stops at the first matching rule. If a network rule allows traffic, application rules are not evaluated for that flow. The default behavior is deny-all (implicit deny).

## DNAT Rules (Destination Network Address Translation)

DNAT rules translate inbound traffic arriving on a firewall public IP to a private IP behind the firewall.

### When to use
- Expose an internal server (VM, load balancer) to the internet through the firewall
- Redirect specific ports from a public IP to internal resources
- Publish services like RDP, SSH, or custom TCP services

### Structure
| Field | Description |
|-------|-------------|
| Source address | IP/CIDR/IP Group or `*` for any |
| Destination address | Firewall public IP |
| Destination port | External-facing port |
| Translated address | Internal private IP |
| Translated port | Internal port (can differ from destination port) |
| Protocol | TCP or UDP |

### Behavior details
- DNAT rules implicitly create a corresponding network allow rule for the translated traffic — you do not need a separate network rule for DNAT'd flows
- DNAT rules are processed before network and application rules
- SNAT is applied automatically: the firewall SNATs the source to its private IP when forwarding to the translated address, ensuring return traffic routes back through the firewall
- DNAT is not supported with forced tunneling (internet-bound traffic goes to on-prem)

### Example: Expose RDP to a VM
```
Rule name: rdp-to-jumpbox
Source: 203.0.113.0/24
Destination: 20.50.1.100 (firewall public IP)
Destination port: 3389
Protocol: TCP
Translated address: 10.0.1.4
Translated port: 3389
```

## Network Rules (L3/L4)

Network rules filter traffic at the transport layer based on IP addresses, ports, and protocols.

### When to use
- Allow or deny traffic based on IP, port, and protocol (TCP, UDP, ICMP, Any)
- Control east-west traffic between VNets or subnets
- Allow outbound traffic to specific IP ranges (e.g., Azure service IPs)
- FQDN-based filtering at L4 (requires DNS proxy enabled on Standard/Premium)

### Structure
| Field | Description |
|-------|-------------|
| Source | IP/CIDR, IP Group, or service tag |
| Destination | IP/CIDR, IP Group, service tag, or FQDN (with DNS proxy) |
| Destination port | Port or port range |
| Protocol | TCP, UDP, ICMP, or Any |
| Action | Allow or Deny |

### Behavior details
- Network rules are evaluated after DNAT rules
- If a network rule matches, application rules are **not** evaluated for that flow
- FQDN in network rules requires DNS proxy to be enabled on the firewall
- Service tags (e.g., `AzureCloud`, `Storage`, `Sql`) simplify rules for Azure services
- IP Groups can be referenced to manage large IP sets across multiple rules

### Example: Allow DNS traffic
```
Rule name: allow-dns
Source: 10.0.0.0/16
Destination: 168.63.129.16
Destination ports: 53
Protocol: UDP, TCP
Action: Allow
```

## Application Rules (L7)

Application rules filter outbound HTTP/HTTPS traffic based on FQDNs, URLs (Premium), and web categories (Premium).

### When to use
- Allow or deny outbound access to specific FQDNs (e.g., `*.microsoft.com`)
- Control access to Azure PaaS services using FQDN tags (e.g., `WindowsUpdate`, `AzureBackup`)
- URL-level filtering (Premium only) — allow `example.com/api` but block `example.com/admin`
- Web category filtering (Premium only) — block categories like gambling, social media
- HTTP/HTTPS traffic where you need FQDN visibility

### Structure
| Field | Description |
|-------|-------------|
| Source | IP/CIDR or IP Group |
| Target FQDNs | Wildcard-supported FQDNs (e.g., `*.github.com`) |
| Protocols | HTTP, HTTPS, MSSQL |
| FQDN tags | Predefined tags for Azure services |
| Web categories | Content categories (Premium only) |
| Action | Allow or Deny |

### Behavior details
- Application rules are evaluated last — only if no DNAT or network rule matched
- Application rules operate as **terminating proxies** for HTTP/HTTPS; the firewall resolves the FQDN and makes the connection on behalf of the client
- Non-HTTP/HTTPS traffic (e.g., raw TCP) cannot be filtered by application rules — use network rules instead
- FQDN tags are curated by Microsoft and automatically updated (e.g., `WindowsUpdate` includes all Windows Update FQDNs)

### Example: Allow access to Azure services
```
Rule name: allow-azure-services
Source: 10.0.0.0/16
FQDN tags: AzureBackup, WindowsUpdate
Protocol: Https
Action: Allow
```

## Rule Collection Groups

Rule collection groups are the top-level organizational container in firewall policies.

### Hierarchy
```
Firewall Policy
  └── Rule Collection Group (priority: 200)
        ├── DNAT Rule Collection (priority: 100)
        │     └── DNAT Rule 1, DNAT Rule 2
        ├── Network Rule Collection (priority: 200)
        │     └── Network Rule 1, Network Rule 2
        └── Application Rule Collection (priority: 300)
              └── App Rule 1, App Rule 2
  └── Rule Collection Group (priority: 300)
        └── ...
```

### Priority processing
1. Rule collection groups are processed by priority (lowest number first)
2. Within a group, rule collections of type DNAT are processed first, then Network, then Application
3. Within a rule collection, rules are processed by order (no individual rule priority)
4. Processing stops at the first match across the entire policy

### Best practices
- Use separate rule collection groups per team, application, or environment
- Reserve low priority numbers (100-200) for infrastructure rules (DNS, NTP, monitoring)
- Use mid-range priorities (300-500) for application-specific rules
- Reserve high priority numbers (900-999) for explicit deny rules
- Limit the total number of rules for performance — consolidate with IP Groups and service tags

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Traffic blocked unexpectedly | Network rule matching before intended application rule | Check if a network deny rule has higher priority; remember network rules evaluate before application rules |
| DNAT not working | Source not matching, wrong public IP, or forced tunneling enabled | Verify source filter, destination IP matches a firewall public IP, and forced tunneling is not enabled |
| FQDN not resolving in network rules | DNS proxy not enabled | Enable DNS proxy on the firewall: `az network firewall update --dns-proxy true` |
| Application rule not matching HTTPS | TLS inspection not enabled (Premium) | Without TLS inspection, application rules match the SNI header only; enable TLS inspection for full URL matching |
| Rules not taking effect | Policy not associated with firewall | Verify the firewall policy is linked to the firewall instance |

## Related

- [firewall-policy.md](firewall-policy.md) — Policy hierarchy and management
- [firewall-skus.md](firewall-skus.md) — Feature availability per SKU
- [Azure Firewall rule processing](https://learn.microsoft.com/azure/firewall/rule-processing)
