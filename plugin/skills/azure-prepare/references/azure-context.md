# Azure Context (Subscription & Location)

Detect and confirm Azure subscription and location before generating artifacts.

---

## Step 1: Detect Defaults

Check for user-configured defaults first:

```bash
azd config get defaults
```

Returns JSON with any configured defaults:
```json
{
  "subscription": "25fd0362-aa79-488b-b37b-d6e892009fdf",
  "location": "eastus2"
}
```

Use these as **recommended** values if present.

## Step 2: Detect Current Subscription

If no defaults, check environment and CLI:

```powershell
# Check for existing azd environment
azd env get-values 2>$null | Select-String "AZURE_SUBSCRIPTION_ID"

# Fall back to az CLI default
az account show --query "{name:name, id:id}" -o json
```

```bash
# Check for existing azd environment
azd env get-values 2>/dev/null | grep AZURE_SUBSCRIPTION_ID

# Fall back to az CLI default
az account show --query "{name:name, id:id}" -o json
```

## Step 3: Confirm Subscription with User

Use `ask_user` with the **actual subscription name and ID**:

✅ **Correct:**
```
Question: "Which Azure subscription would you like to deploy to?"
Choices: [
  "Use current: jongdevdiv (25fd0362-aa79-488b-b37b-d6e892009fdf) (Recommended)",
  "Let me specify a different subscription"
]
```

❌ **Wrong** (never do this):
```
Choices: [
  "Use default subscription",  // ← Does not show actual name
  "Let me specify"
]
```

If user wants a different subscription:
```bash
az account list --output table
```

---

## Step 4: Detect Current Location

If no defaults from Step 1, check environment:

```powershell
azd env get-values 2>$null | Select-String "AZURE_LOCATION"
```

```bash
azd env get-values 2>/dev/null | grep AZURE_LOCATION
```

## Step 5: Confirm Location with User

1. Consult [region-availability.md](region-availability.md) for services with limited availability
2. Present only regions that support ALL selected services
3. Use `ask_user`:

```
Question: "Which Azure region would you like to deploy to?"
Based on your architecture ({list services}), these regions support all services:
Choices: [
  "eastus2 (Recommended)",
  "westus2",
  "westeurope"
]
```

⚠️ Do NOT include regions that don't support all services — deployment will fail.

---

## Record in Plan

After confirmation, record in `.azure/plan.md`:

```markdown
## Azure Context
- **Subscription**: jongdevdiv (25fd0362-aa79-488b-b37b-d6e892009fdf)
- **Location**: eastus2
```
