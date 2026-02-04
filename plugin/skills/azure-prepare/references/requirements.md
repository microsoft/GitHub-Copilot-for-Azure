# Requirements Gathering

> **⛔ BLOCKING REQUIREMENT**: You MUST complete ALL sections in this document, including subscription selection, BEFORE proceeding to Step 3 (Scan Codebase). Do NOT skip or assume values.
>
> **Note**: Location/region selection happens AFTER architecture planning (Step 5) so we can filter regions by service availability.

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

### 5. Azure Subscription

> **⛔ BLOCKING REQUIREMENT — DO NOT SKIP**
>
> You **MUST** detect and display the current subscription BEFORE asking the user to choose.
> Do NOT show generic options like "Use default subscription" — you MUST show the actual subscription name and ID.
>
> **Note**: Location selection happens in Step 5 (Architecture) after services are determined.

**Subscription Selection:**

1. **FIRST: Detect the current subscription** (do this BEFORE calling ask_user):
   ```powershell
   # For existing azd projects:
   azd env get-values 2>$null | Select-String "AZURE_SUBSCRIPTION_ID"
   
   # For az CLI default:
   az account show --query "{name:name, id:id}" -o json
   ```

2. **THEN: Use `ask_user` with the ACTUAL subscription name/ID in the prompt:**
   
   ✅ **CORRECT** (shows actual values):
   ```
   Question: "Which Azure subscription would you like to deploy to?"
   Choices: [
     "Use current: jongdevdiv (25fd0362-aa79-488b-b37b-d6e892009fdf) (Recommended)",
     "Let me specify a different subscription"
   ]
   ```
   
   ❌ **WRONG** (generic - do NOT do this):
   ```
   Choices: [
     "Use default subscription",    // ← WRONG: doesn't show the actual name
     "Let me specify a subscription"
   ]
   ```

3. If user wants a different subscription, run `az account list --output table` and ask again with the list
4. Wait for explicit user selection before proceeding
5. Record the confirmed subscription ID in the manifest

## Gather via Conversation

Use `ask_user` tool to confirm each of these with the user:

1. Project classification (POC/Dev/Prod)
2. Expected scale
3. Budget constraints
4. Compliance requirements (including data residency preferences)
5. Architecture preferences (if any)
6. **Azure subscription** — REQUIRED, must use `ask_user`, do NOT auto-select

**Do not assume defaults without confirmation. Do NOT proceed to Step 3 until subscription is confirmed by the user.**

> **Note**: Location/region selection is deferred to Step 5 (Architecture) so we can present only regions that support all selected Azure services.

## Document in Manifest

Record all requirements in `.azure/plan.md` immediately after gathering.
