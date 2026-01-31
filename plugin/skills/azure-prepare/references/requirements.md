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

**IMPORTANT:** Not all Azure services are available in all regions. For Static Web Apps specifically:
- Use regions like `eastus2`, `westus2`, `centralus`, `westeurope`, or `eastasia` for reliable availability
- Avoid `eastus` as it may not have Static Web Apps capacity
- Verify service availability: https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/

When selecting a region, consider:
1. Service availability (especially for Static Web Apps, Container Apps, etc.)
2. Data residency and compliance requirements
3. Latency to primary users
4. Pricing variations by region

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
