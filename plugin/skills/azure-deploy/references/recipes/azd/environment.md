# AZD Environment Setup

> **⛔ MANDATORY**: You MUST set up an AZD environment before running any deployment commands.

## Step 1: Check Existing Environments

```bash
azd env list
```

**If an environment is already selected** (marked with `*`):
- Use the existing environment
- Skip to Step 3

**If NO environment exists or none is selected:**
- Continue to Step 2

---

## Step 2: Create New Environment

> **⛔ DO NOT use generic names like "dev", "prod", or "test"**
>
> These cause naming conflicts in Azure resource groups and resources. Always generate a unique name.

### Generate Suggested Name

Use this pattern:
```
{project-name}-{random-4-chars}
```

**Examples:**
- `dadjokes-x7k2`
- `todoapp-m3p9`
- `myapi-q5w8`

### Prompt User

**You MUST use `ask_user` to confirm the environment name:**

```
I need to create an AZD environment for this deployment.

Suggested name: {project-name}-{random-4-chars}

Would you like to use this name or enter a custom one?
```

### Create Environment

After user confirms:
```bash
azd env new <environment-name>
```

---

## Step 3: Configure Environment

Set subscription and location:

```bash
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
azd env set AZURE_LOCATION <location>
```

---

## Step 4: Verify Configuration

```bash
azd env get-values
```

Confirm these values are set:
- `AZURE_ENV_NAME`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_LOCATION`

---

## Only Then Proceed

After environment is configured, proceed with `azd up --no-prompt`.
