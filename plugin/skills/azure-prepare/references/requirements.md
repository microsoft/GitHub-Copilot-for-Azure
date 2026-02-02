# Requirements Gathering

> **⛔ BLOCKING REQUIREMENT**: You MUST complete ALL sections in this document, including subscription and location selection, BEFORE proceeding to Step 3 (Scan Codebase) or any artifact generation. Do NOT skip or assume values.

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

### 5. Azure Subscription & Location

> **⛔ BLOCKING REQUIREMENT — DO NOT SKIP**
>
> You **MUST** use the `ask_user` tool to prompt the user for subscription and location. Do NOT:
> - Assume or guess which subscription to use
> - Auto-select a subscription based on name patterns (e.g., "personal", "dev")
> - Proceed to artifact generation without explicit user confirmation
> - Use `az` or `azd` commands to set subscription/location without user approval
>
> **STOP HERE** until the user has confirmed both subscription AND location.

**Subscription Selection:**
1. First, run `az account show --query "{name:name, id:id}" -o tsv` to get the current default subscription
2. Use `ask_user` with the current subscription shown in the question, e.g.:
   - Question: "Which Azure subscription do you want to use? Your current default is: **{subscription-name}** (`{subscription-id}`)"
   - Choices: ["Use current: {subscription-name} (Recommended)", "Let me choose a different subscription"]
3. If user wants a different subscription, run `az account list --output table` and ask again with the list
4. Wait for explicit user selection before proceeding
5. Record the confirmed subscription ID in the manifest

**Location Selection:**
1. Use `ask_user` to ask: "Which Azure region/location do you prefer?" with common choices
2. Suggested choices: `eastus`, `westus2`, `westeurope`, `northeurope`, `southeastasia`
3. Consider mentioning factors: data residency, latency, service availability, cost
4. Wait for explicit user selection before proceeding
5. Record the confirmed location in the manifest

## Gather via Conversation

Use `ask_user` tool to confirm each of these with the user:

1. Project classification (POC/Dev/Prod)
2. Expected scale
3. Budget constraints
4. Compliance requirements
5. Architecture preferences (if any)
6. **Azure subscription** — REQUIRED, must use `ask_user`, do NOT auto-select
7. **Azure location/region** — REQUIRED, must use `ask_user`, do NOT assume

**Do not assume defaults without confirmation. Do NOT proceed to Step 3 or artifact generation until items 6 and 7 are confirmed by the user.**

## Document in Manifest

Record all requirements in `.azure/preparation-manifest.md` immediately after gathering.
