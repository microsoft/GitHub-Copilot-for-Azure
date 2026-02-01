# Requirements Gathering

Collect project requirements through conversation before making architecture decisions.

## Categories

### 1. Classification

| Type | Description | Implications |
|------|-------------|--------------|
| POC | Proof of concept | Minimal infra, cost-optimized |
| Development | Internal tooling | Balanced, team-focused |
| Production | Customer-facing | Full reliability, monitoring |

### 2. Scale

| Scale | Users | Considerations |
|-------|-------|----------------|
| Small | <1K | Single region, basic SKUs |
| Medium | 1K-100K | Auto-scaling, multi-zone |
| Large | 100K+ | Multi-region, premium SKUs |

### 3. Budget

| Profile | Focus |
|---------|-------|
| Cost-Optimized | Minimize spend, lower SKUs |
| Balanced | Value for money, standard SKUs |
| Performance | Maximum capability, premium SKUs |

### 4. Compliance

| Requirement | Impact |
|-------------|--------|
| Data residency | Region constraints |
| Industry regulations | Security controls |
| Internal policies | Approval workflows |

### 5. Region and Service Availability

Not all Azure services are available in all regions. When selecting a region, consider:

**For Static Web Apps:**
- Static Web Apps is a **non-regional service** - static content is globally distributed via CDN
- The region parameter only controls where the **integrated API backend (Azure Functions)** is deployed
- If provisioning fails due to capacity issues, try an alternative region for the API backend
- Your static content will be served globally with low latency regardless of the region you select

**General region considerations:**
1. Service availability (check specific services at Azure regions page)
2. Data residency and compliance requirements
3. Latency to primary users (for APIs and dynamic services)
4. Pricing variations by region
5. Capacity constraints (may vary over time)

## Gather via Conversation

Ask user to confirm:
1. Project classification (POC/Dev/Prod)
2. Expected scale and regions
3. Budget constraints
4. Compliance requirements
5. Architecture preferences (if any)

**Do not assume defaults without confirmation.**

## Document in Manifest

Record all requirements in `.azure/preparation-manifest.md` immediately after gathering.
