# DDoS Rapid Response (DRR)

The DDoS Rapid Response (DRR) team is a dedicated Microsoft team that provides expert assistance during active DDoS attacks. DRR is available exclusively to customers with **DDoS Network Protection** (not available with IP Protection or Infrastructure Protection).

## What DRR Provides

| Service | Description |
|---------|-------------|
| **Attack investigation** | Real-time analysis of the attack pattern, vectors, and source distribution |
| **Custom mitigation tuning** | Adjust mitigation policies beyond the automatic baseline to better handle the specific attack |
| **Post-attack analysis** | Detailed report of the attack with recommendations for improving resilience |
| **Application profiling** | Work with your team to create custom traffic profiles that reduce false positives during mitigation |
| **Proactive engagement** | For critical events (planned launches, large-scale events), DRR can pre-position mitigation resources |

## When to Engage DRR

Engage DRR when:
- **An active attack is impacting availability** — legitimate traffic is being dropped despite automatic mitigation
- **A sustained attack is ongoing** — the attack has lasted more than 30 minutes and automatic mitigation is not fully effective
- **Attack patterns are evolving** — the attacker is adapting (changing vectors, source IPs, protocols) to circumvent mitigation
- **Before a high-profile event** — product launch, major sale, regulatory deadline where DDoS resilience is critical (proactive engagement)
- **Post-attack review needed** — after a significant attack, for a detailed analysis and recommendations

Do NOT engage DRR for:
- Normal traffic spikes (Black Friday, viral content) — these are scaling issues, not attacks
- Application bugs causing high resource usage — troubleshoot with application team
- Attacks on resources without DDoS Network Protection enabled

## How to Engage DRR

### Step 1: Verify prerequisites

Before contacting DRR, confirm:

- [ ] DDoS Network Protection is enabled on the affected VNet
- [ ] Diagnostic logs are enabled on the affected public IP(s)
- [ ] You can see `IfUnderDDoSAttack = 1` in Azure Monitor metrics
- [ ] You have the resource IDs of affected public IPs
- [ ] You can describe the business impact (what services are affected, how many users impacted)

### Step 2: Open a Severity A support ticket

```
Azure Portal → Help + support → New support request
  Issue type: Technical
  Service: DDoS Protection
  Problem type: DDoS attack in progress
  Severity: A – Critical (or Sev B for proactive engagement)
```

**In the ticket, include:**
1. Subscription ID
2. Resource group and VNet name
3. Public IP resource IDs under attack
4. Time the attack started (UTC)
5. Attack symptoms (dropped connections, high latency, service unavailable)
6. Current mitigation metrics (packets dropped, packets forwarded)
7. Any patterns observed (specific source IPs, protocols, packet sizes)

### Step 3: DRR engagement process

```
Support ticket opened (Sev A)
    │
    ▼
DRR team acknowledges (within 15 minutes for Sev A)
    │
    ▼
Initial triage — DRR reviews metrics and logs
    │
    ▼
Mitigation tuning — DRR adjusts mitigation policies
    │
    ▼
Ongoing monitoring — DRR monitors until attack subsides
    │
    ▼
Post-attack report — DRR provides analysis and recommendations
```

### Response time SLA

| Severity | Initial response | Updates |
|----------|-----------------|---------|
| Sev A (Critical) | Within 15 minutes | Continuous during active attack |
| Sev B (Important) | Within 2 hours | Periodic updates |

## What to Prepare Before an Attack

Prepare these items before you ever need DRR — having them ready dramatically speeds up engagement:

### 1. Document your protected resources

Create and maintain a list of:
- All VNets with DDoS Network Protection enabled
- All public IPs and the services they front (Application Gateway, Load Balancer, VMs)
- Normal traffic baselines (average bandwidth, packet rates, connection rates)
- Business criticality of each service

### 2. Enable all diagnostic logging

```bash
# For every protected public IP, ensure all 3 log categories + metrics are enabled
az monitor diagnostic-settings create \
  --name "ddos-full-logging" \
  --resource <public-ip-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[
    {"category": "DDoSProtectionNotifications", "enabled": true},
    {"category": "DDoSMitigationFlowLogs", "enabled": true},
    {"category": "DDoSMitigationReports", "enabled": true}
  ]' \
  --metrics '[{"category": "AllMetrics", "enabled": true}]'
```

### 3. Configure alerts

```bash
# Create an alert for every protected public IP
az monitor metrics alert create \
  --name "ddos-attack-<resource-name>" \
  --resource-group <rg-name> \
  --scopes <public-ip-resource-id> \
  --condition "max IfUnderDDoSAttack > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id> \
  --severity 1
```

### 4. Establish an incident response runbook

Your DDoS incident response runbook should include:

1. **Detection** — Who gets the alert? What is the escalation path?
2. **Assessment** — Check Azure Monitor metrics to confirm DDoS attack (vs. legitimate traffic spike)
3. **Communication** — Notify stakeholders (internal status page, executive team)
4. **Engagement** — Open Sev A support ticket if automatic mitigation is insufficient
5. **Monitoring** — Track mitigation effectiveness using metrics and flow logs
6. **Resolution** — Confirm attack has stopped; verify service restoration
7. **Post-incident** — Review DRR report; update runbook and defensive posture

### 5. Test your response process

- Run tabletop exercises with your team simulating a DDoS attack
- Verify alert notifications reach the right people
- Practice opening a Sev A support ticket (without actually submitting if not under attack)
- Ensure your team knows the DRR engagement process

## Proactive DRR Engagement

For planned high-profile events, you can engage DRR proactively:

### When to use proactive engagement
- Major product launches
- Large-scale marketing events (Super Bowl ads, etc.)
- Financial events (IPO, earnings calls)
- Government elections or census operations
- Any event where DDoS attack risk is elevated

### How to request proactive engagement
1. Open a Sev B support ticket at least **2 weeks** before the event
2. Describe the event, expected traffic patterns, and critical resources
3. DRR will work with you to profile your application and pre-tune mitigation
4. During the event, DRR monitors your resources and intervenes immediately if an attack occurs

## Cost Protection Claims

DDoS Network Protection includes cost protection — Azure credits the incremental costs of resource scale-out during a documented DDoS attack.

### Eligible costs
- Application Gateway autoscale-out instances
- VM Scale Set scale-out instances
- Azure Load Balancer SKU charges
- Bandwidth (egress) overage charges
- Public IP address charges for dynamically provisioned IPs

### How to file a claim
1. Ensure DDoS diagnostic logs were enabled during the attack
2. Download the DDoS mitigation report from Log Analytics
3. Open a support ticket (Type: Billing, Subtype: DDoS cost protection)
4. Attach the mitigation report and identify the resources that scaled out
5. Microsoft reviews the claim and credits eligible costs

### Requirements for a successful claim
- DDoS Network Protection must have been enabled at the time of the attack
- Diagnostic logs must have been enabled and must show the attack
- The scale-out must correlate with the attack timeline
- Claim must be filed within **30 days** of the attack ending

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Cannot engage DRR | Using IP Protection tier | DRR requires DDoS Network Protection |
| Sev A ticket not acknowledged within 15 min | Support routing issue | Call Azure support directly; reference your ticket number |
| No diagnostic data available during attack | Logging was not enabled | Enable all diagnostic settings NOW for future attacks |
| Cost protection claim denied | Logs not configured during attack | Ensure logging is always enabled on all protected IPs |
| DRR cannot tune mitigation | No traffic baseline established | DDoS protection needs a few days of normal traffic to establish baselines |

## Related

- [ddos-tiers.md](ddos-tiers.md) — DRR availability by tier
- [telemetry.md](telemetry.md) — Metrics and logs needed for DRR engagement
- [attack-types.md](attack-types.md) — Attack types DRR can help mitigate
- [Azure DDoS Rapid Response](https://learn.microsoft.com/azure/ddos-protection/ddos-rapid-response)
