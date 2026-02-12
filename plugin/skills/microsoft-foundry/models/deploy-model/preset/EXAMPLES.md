# Examples: preset

Real-world scenarios demonstrating different preset deployment workflows.

---

## Example 1: Fast Path — Current Region Has Capacity

**Scenario:** User requests "Deploy gpt-4o for my production project." Project is in East US, which has capacity.

**Key Flow:**
```bash
# Parse project resource ID → extract subscription, RG, account, project
az account set --subscription "<sub-id>"

# Check current region capacity
az rest --method GET \
  --url ".../locations/eastus/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=gpt-4o&modelVersion=2024-08-06"
# ✓ eastus has capacity — skip region selection

# Deploy
az cognitiveservices account deployment create \
  --name "banide-1031" --resource-group "rg-production" \
  --deployment-name "gpt-4o-20260205-143022" \
  --model-name "gpt-4o" --model-version "2024-08-06" \
  --model-format "OpenAI" --sku-name "GlobalStandard" --sku-capacity 100000
```

**Outcome:** Deployed in ~45s. No region selection needed. 100K TPM default capacity.

---

## Example 2: Alternative Region — No Capacity in Current Region

**Scenario:** User requests "Deploy gpt-4-turbo to my dev environment." Project `dev-ai-hub` is in West US 2, which has no capacity.

**Key Flow:**
- Current region (westus2) capacity check fails
- Query all regions → present available options (e.g., East US 2: 120K, Sweden Central: 100K)
- User selects East US 2 → list projects in that region → user picks `my-ai-project-prod`
- Deploy to selected region/project

**Key Command:**
```bash
az rest --method GET \
  --url ".../providers/Microsoft.CognitiveServices/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=gpt-4-turbo&modelVersion=2024-06-15"
```

**Outcome:** Deployed in ~2 min. User chose region and project interactively.

---

## Example 3: Create New Project in Optimal Region

**Scenario:** User needs "gpt-4o-mini in Europe for data residency." No existing project in target European region.

**Key Flow:**
- Current region lacks capacity → user selects Sweden Central
- No projects found in swedencentral → prompt to create new project
- Create AI Services hub + AI Foundry project (`john-doe-aiproject-a7f3`) in swedencentral
- Deploy to newly created project

**Outcome:** Deployed in ~4 min including project creation. Full available capacity (150K TPM).

---

## Example 4: Insufficient Quota Everywhere

**Scenario:** User requests "Deploy gpt-4 to any available region." All regions have exhausted quota.

**Key Flow:**
- All region capacity checks return 0
- Skill presents actionable next steps:
  1. Request quota increase — defer to the [quota skill](../../../quota/quota.md)
  2. List existing deployments that may be consuming quota
  3. Suggest alternatives (gpt-4o, gpt-4o-mini)

**Outcome:** Graceful failure with guidance. No deployment created.

---

## Example 5: First-Time User — No Project

**Scenario:** User wants to deploy gpt-4o but has no AI Foundry project.

**Key Flow:**
- `az cognitiveservices account list` returns no AIProject resources
- Prompt user to select region and provide project name/RG
- Create resource group, AI Services hub, and AI Foundry project
- Check capacity in new region → deploy

**Outcome:** Full onboarding in ~5 min. Resource group + project + deployment created.

---

## Example 6: Deployment Name Conflict

**Scenario:** Generated deployment name already exists.

**Key Flow:**
- `az cognitiveservices account deployment create` fails with "already exists" error
- Append random hex suffix (e.g., `-7b9e`) and retry

**Outcome:** Retry succeeds automatically. User notified of final name.

---

## Example 7: Multi-Version Model Selection

**Scenario:** User requests "Deploy the latest gpt-4o." Multiple versions available.

**Key Flow:**
```bash
az cognitiveservices account list-models \
  --name "my-ai-project-prod" --resource-group "rg-production" \
  --query "[?name=='gpt-4o'].{Name:name, Version:version}" -o table
# Returns: 2024-02-15, 2024-05-13, 2024-08-06 ← Latest selected
```

**Outcome:** Latest stable version auto-selected. Capacity aggregated across versions.

---

## Summary of Scenarios

| Scenario | Duration | Key Features |
|----------|----------|--------------|
| **Example 1: Fast Path** | ~45s | Current region has capacity, direct deploy |
| **Example 2: Alternative Region** | ~2m | Region selection, project switch |
| **Example 3: New Project** | ~4m | Project creation in optimal region |
| **Example 4: No Quota** | N/A | Graceful failure, actionable guidance |
| **Example 5: First-Time User** | ~5m | Complete setup, onboarding |
| **Example 6: Name Conflict** | ~1m | Conflict resolution, retry logic |
| **Example 7: Multi-Version** | ~1m | Version selection, capacity aggregation |

---

## Common Patterns

```
A: Quick Deploy     Auth → Get Project → Check Current Region (✓) → Deploy
B: Region Select    Auth → Get Project → Current Region (✗) → Query All → Select Region → Select/Create Project → Deploy
C: Full Onboarding  Auth → No Projects → Create Project → Select Model → Deploy
D: Error Recovery   Deploy (✗) → Analyze Error → Apply Fix → Retry
```

---

## Tips

1. **Example 1** — typical workflow (fast path)
2. **Example 2** — region selection when current region is full
3. **Example 4** — error handling and quota exhaustion
4. **Example 5** — onboarding new users with no project
5. **Example 6** — deployment name conflict resolution
6. **Example 7** — multi-version model handling
