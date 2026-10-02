# DDoS Attack Types and Azure Mitigation

DDoS attacks attempt to exhaust the resources of a target — bandwidth, connection state tables, or application processing capacity — to make the service unavailable to legitimate users. Azure DDoS Protection mitigates three main categories of attacks.

## Attack Categories Overview

| Category | OSI Layer | Target | Goal | Example attacks |
|----------|-----------|--------|------|-----------------|
| **Volumetric** | L3/L4 | Bandwidth | Saturate the network pipe | UDP flood, DNS amplification, NTP amplification, SSDP reflection |
| **Protocol** | L3/L4 | Connection state | Exhaust state tables on servers and firewalls | SYN flood, Smurf attack, fragmented packet attacks |
| **Application layer** | L7 | Application logic | Overwhelm the application's processing capacity | HTTP flood, Slowloris, DNS query flood |

## Volumetric Attacks

Volumetric attacks are the most common type of DDoS attack. They aim to consume all available bandwidth between the target and the internet.

### UDP Flood

**How it works**: The attacker sends a massive volume of UDP packets to random ports on the target. The target must process each packet, determine that no application is listening, and send ICMP "Destination Unreachable" replies.

**Traffic volume**: Can exceed 1 Tbps in large-scale attacks.

**Azure mitigation**:
- Azure's scrubbing infrastructure absorbs the traffic at the network edge
- Traffic profiling identifies the attack pattern (random destination ports, consistent packet sizes)
- Malicious UDP traffic is dropped at the edge before reaching the customer's VNet
- Legitimate UDP traffic (DNS, VoIP) is forwarded based on learned baselines

### DNS Amplification

**How it works**: The attacker sends DNS queries with the target's spoofed source IP to open DNS resolvers. Each small query generates a much larger DNS response directed at the target (amplification factor: 28–54x).

**Azure mitigation**:
- Traffic from known amplification sources is rate-limited
- Response traffic that exceeds the baseline DNS traffic pattern is dropped
- Source IP validation helps identify and filter spoofed traffic

### NTP Amplification

**How it works**: Similar to DNS amplification but uses NTP (Network Time Protocol) servers with the `monlist` command. Amplification factor: up to 556x.

**Azure mitigation**:
- NTP response traffic exceeding baselines is identified and dropped
- Azure edge filters absorb the amplified traffic before it reaches customer resources

### SSDP Reflection

**How it works**: Exploits Universal Plug and Play (UPnP) devices to reflect traffic. Amplification factor: ~30x.

**Azure mitigation**:
- SSDP traffic patterns are fingerprinted and malicious reflections are dropped
- Rate limiting applied to unexpected SSDP traffic volumes

### Metrics to monitor during volumetric attacks

```kusto
// Total attack bandwidth (bytes dropped per second)
AzureMetrics
| where MetricName == "InboundBytesDroppedDDoS"
| summarize MaxBytesPerSec = max(Maximum) by bin(TimeGenerated, 1m)
| render timechart

// UDP vs TCP breakdown
AzureMetrics
| where MetricName in ("UDPBytesDroppedDDoS", "TCPBytesDroppedDDoS")
| summarize max(Maximum) by MetricName, bin(TimeGenerated, 1m)
| render timechart
```

## Protocol Attacks

Protocol attacks exploit weaknesses in the Layer 3/4 protocol stack to exhaust the connection state capacity of firewalls, load balancers, and servers.

### SYN Flood

**How it works**: The attacker sends a flood of TCP SYN packets (connection initiation) with spoofed source IPs. The target allocates resources for each half-open connection, filling its connection state table. Legitimate connections cannot be established.

**Traffic characteristics**: Moderate bandwidth but very high packet rate.

**Azure mitigation**:
- **SYN cookies**: Azure uses SYN cookie validation to handle SYN floods without consuming state table entries
- **Rate limiting**: SYN packets exceeding the baseline rate are rate-limited
- **Source validation**: SYN packets from spoofed addresses are identified and dropped using TCP challenge mechanisms
- The target server never sees the malicious SYN packets — Azure's infrastructure absorbs them

### Smurf Attack

**How it works**: The attacker sends ICMP Echo Request (ping) packets to a network's broadcast address with the target's spoofed source IP. Every host on the network responds to the target with ICMP Echo Replies.

**Azure mitigation**:
- Broadcast-amplified ICMP is filtered at the Azure edge
- ICMP rate limiting prevents overwhelming the target
- Modern Azure networking infrastructure does not forward broadcast traffic

### Fragmented Packet Attack

**How it works**: The attacker sends fragmented IP packets that cannot be properly reassembled. The target expends CPU and memory trying to reassemble fragments, eventually exhausting resources.

**Azure mitigation**:
- Azure's scrubbing pipeline defragments and validates packets
- Malformed fragments are dropped before reaching customer resources
- Fragment reassembly is performed at the Azure edge with strict timeouts

### Metrics to monitor during protocol attacks

```kusto
// TCP packet drops (SYN flood indicator)
AzureMetrics
| where MetricName == "TCPPacketsDroppedDDoS"
| summarize MaxPacketsPerSec = max(Maximum) by bin(TimeGenerated, 1m)
| render timechart

// Compare dropped vs forwarded TCP packets
AzureMetrics
| where MetricName in ("TCPPacketsDroppedDDoS", "TCPPacketsForwardedDDoS")
| summarize max(Maximum) by MetricName, bin(TimeGenerated, 1m)
| render timechart
```

## Application Layer Attacks

Application layer attacks target the application itself — they use legitimate-looking requests to overwhelm application processing, database queries, or authentication systems. These attacks are the hardest to distinguish from normal traffic because each individual request looks valid.

### HTTP Flood

**How it works**: The attacker sends a high volume of HTTP GET or POST requests that are individually valid but collectively overwhelm the web server, application logic, or database backend.

**Characteristics**: Low bandwidth relative to volumetric attacks, but high CPU/memory impact on the application.

**Azure mitigation**:
- **DDoS Protection** mitigates the network component (connection rate, packet rate)
- **WAF (Web Application Firewall)** is the primary defense — rate limiting, bot protection, custom rules
- **Application Gateway autoscale** absorbs legitimate traffic spikes while WAF filters malicious requests
- DDoS Protection and WAF work together: DDoS handles volumetric/protocol layers, WAF handles application layer

### Slowloris

**How it works**: The attacker opens many HTTP connections to the target and keeps them alive by sending partial HTTP headers very slowly. This ties up server connection slots without consuming much bandwidth.

**Azure mitigation**:
- Azure Load Balancer and Application Gateway have built-in connection timeout policies
- WAF can enforce minimum request rates and connection timeout thresholds
- DDoS Protection detects abnormal connection patterns and mitigates at the network level

### DNS Query Flood

**How it works**: The attacker floods a DNS server with a high volume of DNS queries, often for random subdomains (NXDOMAIN attacks) that force recursive resolution.

**Azure mitigation**:
- Azure DNS has built-in DDoS resilience with a globally distributed anycast infrastructure
- For customer-managed DNS, DDoS Protection mitigates the volumetric component
- Rate limiting and query filtering handle the application-layer component

### Defense-in-depth for application layer attacks

Application layer attacks require a layered defense approach:

```
Internet traffic
    │
    ▼
┌──────────────────┐
│ DDoS Protection  │  Mitigates volumetric + protocol components
│ (Network layer)  │  Drops obvious attack traffic
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Azure Firewall   │  Network-level filtering
│ (L3/L4 filtering)│  IP allow/deny, geoblocking
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ WAF              │  Application-level protection
│ (L7 filtering)   │  Rate limiting, bot protection, OWASP rules
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Application      │  Application-level defenses
│ (rate limiting,  │  API throttling, CAPTCHA, queueing
│  caching, CDN)   │
└──────────────────┘
```

## Azure DDoS Mitigation Process

When Azure DDoS Protection detects an attack:

### 1. Detection (seconds)
- Azure monitors traffic patterns per protected public IP
- Traffic exceeding the learned baseline triggers detection algorithms
- Multiple detection heuristics: rate-based, pattern-based, and ML-based

### 2. Traffic diversion (seconds)
- Attack traffic is diverted to Azure's scrubbing infrastructure
- Scrubbing capacity exceeds 100 Tbps globally

### 3. Mitigation (ongoing)
- Scrubbing pipeline applies: rate limiting, SYN cookie validation, packet validation, IP reputation filtering, and pattern matching
- Legitimate traffic is forwarded to the customer's VNet
- Attack traffic is dropped

### 4. Adaptation (ongoing)
- Mitigation policies adapt in real-time as attack vectors change
- DRR can manually tune mitigation for persistent attacks
- Machine learning refines traffic classification during the attack

### 5. Recovery (after attack)
- Mitigation is automatically deactivated when traffic returns to baseline
- Post-attack mitigation report is generated
- Metrics reflect the full attack timeline

## Mitigation Capacity

| Azure capability | Value |
|------------------|-------|
| Global scrubbing capacity | 100+ Tbps |
| Number of scrubbing centers | 60+ globally |
| Time to mitigate | Seconds (automatic) |
| Maximum attack size mitigated | Multi-terabit demonstrated |
| Protocols covered | All IP protocols (TCP, UDP, ICMP, etc.) |

## Best Practices by Attack Type

| Attack type | Primary defense | Supporting defense |
|-------------|----------------|-------------------|
| UDP flood | DDoS Protection | Azure Firewall (block unused UDP ports) |
| DNS amplification | DDoS Protection | Azure Firewall (restrict DNS sources) |
| SYN flood | DDoS Protection | Application Gateway/Load Balancer (connection limits) |
| HTTP flood | WAF (rate limiting + bot protection) | DDoS Protection (network layer) |
| Slowloris | WAF + Application Gateway timeouts | DDoS Protection (connection anomaly detection) |
| Multi-vector | DDoS Protection + WAF + Firewall | All layers working together |

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Application slow but DDoS metrics show no attack | Application-layer attack (not volumetric) | Enable WAF with rate limiting; review application logs |
| High traffic but `IfUnderDDoSAttack = 0` | Traffic is legitimate (not an attack) | Scale the application; this is a capacity issue not DDoS |
| Legitimate traffic being dropped during attack | Mitigation too aggressive for traffic pattern | Engage DRR for custom mitigation tuning |
| Attack metrics appear but service is unaffected | DDoS Protection working correctly — attack is being mitigated | Monitor and verify mitigation effectiveness |
| Repeated attacks from same sources | Persistent attacker | Document patterns; share with DRR for proactive tuning |

## Related

- [ddos-tiers.md](ddos-tiers.md) — Protection capabilities per tier
- [telemetry.md](telemetry.md) — Metrics and queries for attack analysis
- [rapid-response.md](rapid-response.md) — DRR engagement for complex attacks
- [Azure DDoS Protection overview](https://learn.microsoft.com/azure/ddos-protection/ddos-protection-overview)
- [DDoS best practices](https://learn.microsoft.com/azure/ddos-protection/fundamental-best-practices)
