# Pre-Deployment Checklist

> **CRITICAL**: Before running ANY provisioning commands, you MUST complete this checklist.

## 1. Verify Subscription

Check current subscription:
```bash
az account show --query "{name:name, id:id}" --output table
```

If not set or incorrect, list available subscriptions:
```bash
az account list --output table
```

## 2. Prompt User for Confirmation

**You MUST ask the user to confirm:**
1. Which Azure subscription to use
2. Which Azure region/location to deploy to

**Do NOT assume defaults. Do NOT skip this step.**

## 3. Set Subscription and Location

After user confirms:

**For AZD:**
```bash
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
azd env set AZURE_LOCATION <location>
```

**For Azure CLI / Bicep:**
```bash
az account set --subscription <subscription-id-or-name>
# Pass location as parameter: --location <location>
```

**For Terraform:**
```bash
az account set --subscription <subscription-id-or-name>
# Set in terraform.tfvars or -var="location=<location>"
```

## Common Locations

`eastus`, `eastus2`, `westus2`, `westus3`, `centralus`, `westeurope`, `northeurope`, `uksouth`, `australiaeast`, `southeastasia`

## Only Then Proceed

After subscription and location are confirmed, proceed with deployment commands.
