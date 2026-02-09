---
name: customize-deployment
description: |
  Interactive guided deployment flow for Azure OpenAI models with full customization control. Step-by-step selection of model version, SKU (GlobalStandard/Standard/ProvisionedManaged), capacity, RAI policy (content filter), and advanced options (dynamic quota, priority processing, spillover). USE FOR: custom deployment, customize model deployment, choose version, select SKU, set capacity, configure content filter, RAI policy, deployment options, detailed deployment, advanced deployment, PTU deployment, provisioned throughput. DO NOT USE FOR: quick deployment to optimal region (use deploy-model-optimal-region).
---

# Customize Model Deployment

Interactive guided workflow for deploying Azure OpenAI models with full customization control over version, SKU, capacity, content filtering, and advanced options.

## Quick Reference

| Property | Description |
|----------|-------------|
| **Flow** | Interactive step-by-step guided deployment |
| **Customization** | Version, SKU, Capacity, RAI Policy, Advanced Options |
| **SKU Support** | GlobalStandard, Standard, ProvisionedManaged, DataZoneStandard |
| **Best For** | Precise control over deployment configuration |
| **Authentication** | Azure CLI (`az login`) |
| **Tools** | Azure CLI, MCP tools (optional) |

## When to Use This Skill

Use this skill when you need **precise control** over deployment configuration:

- ✅ **Choose specific model version** (not just latest)
- ✅ **Select deployment SKU** (GlobalStandard vs Standard vs PTU)
- ✅ **Set exact capacity** within available range
- ✅ **Configure content filtering** (RAI policy selection)
- ✅ **Enable advanced features** (dynamic quota, priority processing, spillover)
- ✅ **PTU deployments** (Provisioned Throughput Units)

**Alternative:** Use `deploy-model-optimal-region` for quick deployment to the best available region with automatic configuration.

### Comparison: customize-deployment vs deploy-model-optimal-region

| Feature | customize-deployment | deploy-model-optimal-region |
|---------|---------------------|----------------------------|
| **Focus** | Full customization control | Optimal region selection |
| **Version Selection** | User chooses from available | Uses latest automatically |
| **SKU Selection** | User chooses (GlobalStandard/Standard/PTU) | GlobalStandard only |
| **Capacity** | User specifies exact value | Auto-calculated (50% of available) |
| **RAI Policy** | User selects from options | Default policy only |
| **Region** | Uses current project region | Checks capacity across all regions |
| **Use Case** | Precise deployment requirements | Quick deployment to best region |

## Prerequisites

### Azure Resources
- Azure subscription with active account
- Azure AI Foundry project resource ID
  - Format: `/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}`
  - Find in: Azure AI Foundry portal → Project → Overview → Resource ID
- Permissions: Cognitive Services Contributor or Owner

### Tools
- **Azure CLI** installed and authenticated (`az login`)
- Optional: Set `PROJECT_RESOURCE_ID` environment variable

## Workflow Overview

### Complete Flow (13 Phases)

```
1. Verify Authentication
2. Get Project Resource ID
3. Verify Project Exists
4. Get Model Name (if not provided)
5. List Model Versions → User Selects
6. List SKUs for Version → User Selects
7. Get Capacity Range → User Configures
8. List RAI Policies → User Selects
9. Configure Advanced Options (if applicable)
10. Configure Version Upgrade Policy
11. Generate Deployment Name
12. Review Configuration
13. Execute Deployment & Monitor
```

### Fast Path (Defaults)

If user accepts all defaults:
- Latest version
- GlobalStandard SKU
- Recommended capacity
- Default RAI policy
- Standard version upgrade policy

Deployment completes in ~5 interactions.

---

## Detailed Step-by-Step Instructions

### Phase 1: Verify Authentication

Check if user is logged into Azure CLI:

#### Bash
```bash
az account show --query "{Subscription:name, User:user.name}" -o table
```

#### PowerShell
```powershell
az account show --query "{Subscription:name, User:user.name}" -o table
```

**If not logged in:**
```bash
az login
```

**Verify subscription:**
```bash
# List subscriptions
az account list --query "[].[name,id,state]" -o table

# Set active subscription if needed
az account set --subscription <subscription-id>
```

---

### Phase 2: Get Project Resource ID

**Check for environment variable first:**

#### Bash
```bash
if [ -n "$PROJECT_RESOURCE_ID" ]; then
  echo "Using project: $PROJECT_RESOURCE_ID"
else
  echo "PROJECT_RESOURCE_ID not set. Please provide your project resource ID."
  read -p "Enter project resource ID: " PROJECT_RESOURCE_ID
fi
```

#### PowerShell
```powershell
if ($env:PROJECT_RESOURCE_ID) {
  Write-Output "Using project: $env:PROJECT_RESOURCE_ID"
} else {
  Write-Output "PROJECT_RESOURCE_ID not set. Please provide your project resource ID."
  $PROJECT_RESOURCE_ID = Read-Host "Enter project resource ID"
}
```

**Project Resource ID Format:**
```
/subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.CognitiveServices/accounts/{account-name}/projects/{project-name}
```

---

### Phase 3: Parse and Verify Project

**Extract components from resource ID:**

#### PowerShell
```powershell
# Parse ARM resource ID
$SUBSCRIPTION_ID = ($PROJECT_RESOURCE_ID -split '/')[2]
$RESOURCE_GROUP = ($PROJECT_RESOURCE_ID -split '/')[4]
$ACCOUNT_NAME = ($PROJECT_RESOURCE_ID -split '/')[8]
$PROJECT_NAME = ($PROJECT_RESOURCE_ID -split '/')[10]

Write-Output "Project Details:"
Write-Output "  Subscription: $SUBSCRIPTION_ID"
Write-Output "  Resource Group: $RESOURCE_GROUP"
Write-Output "  Account: $ACCOUNT_NAME"
Write-Output "  Project: $PROJECT_NAME"

# Verify project exists
az account set --subscription $SUBSCRIPTION_ID

$PROJECT_REGION = az cognitiveservices account show `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --query location -o tsv

if ($PROJECT_REGION) {
  Write-Output "✓ Project verified"
  Write-Output "  Region: $PROJECT_REGION"
} else {
  Write-Output "❌ Project not found"
  exit 1
}
```

---

### Phase 4: Get Model Name

**If model name not provided as parameter:**

#### PowerShell
```powershell
Write-Output "Select model to deploy:"
Write-Output ""
Write-Output "Common models:"
Write-Output "  1. gpt-4o (Recommended - Latest GPT-4 model)"
Write-Output "  2. gpt-4o-mini (Cost-effective, faster)"
Write-Output "  3. gpt-4-turbo (Advanced reasoning)"
Write-Output "  4. gpt-35-turbo (High performance, lower cost)"
Write-Output "  5. o3-mini (Reasoning model)"
Write-Output "  6. Custom model name"
Write-Output ""

# Use AskUserQuestion or Read-Host
$modelChoice = Read-Host "Enter choice (1-6)"

switch ($modelChoice) {
  "1" { $MODEL_NAME = "gpt-4o" }
  "2" { $MODEL_NAME = "gpt-4o-mini" }
  "3" { $MODEL_NAME = "gpt-4-turbo" }
  "4" { $MODEL_NAME = "gpt-35-turbo" }
  "5" { $MODEL_NAME = "o3-mini" }
  "6" { $MODEL_NAME = Read-Host "Enter custom model name" }
  default { $MODEL_NAME = "gpt-4o" }
}

Write-Output "Selected model: $MODEL_NAME"
```

---

### Phase 5: List and Select Model Version

**Get available versions:**

#### PowerShell
```powershell
Write-Output "Fetching available versions for $MODEL_NAME..."
Write-Output ""

$versions = az cognitiveservices account list-models `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --query "[?name=='$MODEL_NAME'].version" -o json | ConvertFrom-Json

if ($versions) {
  Write-Output "Available versions:"
  for ($i = 0; $i -lt $versions.Count; $i++) {
    $version = $versions[$i]
    if ($i -eq 0) {
      Write-Output "  $($i+1). $version (Recommended - Latest)"
    } else {
      Write-Output "  $($i+1). $version"
    }
  }
  Write-Output ""
  
  # Use AskUserQuestion tool with choices
  # For this example, using simple input
  $versionChoice = Read-Host "Select version (1-$($versions.Count), default: 1)"
  
  if ([string]::IsNullOrEmpty($versionChoice) -or $versionChoice -eq "1") {
    $MODEL_VERSION = $versions[0]
  } else {
    $MODEL_VERSION = $versions[[int]$versionChoice - 1]
  }
  
  Write-Output "Selected version: $MODEL_VERSION"
} else {
  Write-Output "⚠ No versions found for $MODEL_NAME"
  Write-Output "Using default version..."
  $MODEL_VERSION = "latest"
}
```

---

### Phase 6: List and Select SKU

**Available SKU types:**

| SKU | Description | Use Case |
|-----|-------------|----------|
| **GlobalStandard** | Multi-region load balancing, automatic failover | Production workloads, high availability |
| **Standard** | Single region, predictable latency | Region-specific requirements |
| **ProvisionedManaged** | Reserved PTU capacity, guaranteed throughput | High-volume, predictable workloads |
| **DataZoneStandard** | Data zone isolation | Data residency requirements |

#### PowerShell
```powershell
Write-Output "Available SKUs for $MODEL_NAME (version $MODEL_VERSION):"
Write-Output ""
Write-Output "  1. GlobalStandard (Recommended - Multi-region load balancing)"
Write-Output "     • Automatic failover across regions"
Write-Output "     • Best availability and reliability"
Write-Output ""
Write-Output "  2. Standard (Single region)"
Write-Output "     • Predictable latency"
Write-Output "     • Lower cost than GlobalStandard"
Write-Output ""
Write-Output "  3. ProvisionedManaged (Reserved PTU capacity)"
Write-Output "     • Guaranteed throughput"
Write-Output "     • Best for high-volume workloads"
Write-Output ""

$skuChoice = Read-Host "Select SKU (1-3, default: 1)"

switch ($skuChoice) {
  "1" { $SELECTED_SKU = "GlobalStandard" }
  "2" { $SELECTED_SKU = "Standard" }
  "3" { $SELECTED_SKU = "ProvisionedManaged" }
  "" { $SELECTED_SKU = "GlobalStandard" }
  default { $SELECTED_SKU = "GlobalStandard" }
}

Write-Output "Selected SKU: $SELECTED_SKU"
```

---

### Phase 7: Configure Capacity

**Get capacity range for selected SKU and version:**

#### PowerShell
```powershell
Write-Output "Fetching capacity information for $SELECTED_SKU..."
Write-Output ""

# Query capacity using REST API
$capacityUrl = "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/locations/$PROJECT_REGION/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=$MODEL_NAME&modelVersion=$MODEL_VERSION"

$capacityResult = az rest --method GET --url "$capacityUrl" 2>$null | ConvertFrom-Json

if ($capacityResult.value) {
  $skuCapacity = $capacityResult.value | Where-Object { $_.properties.skuName -eq $SELECTED_SKU } | Select-Object -First 1
  
  if ($skuCapacity) {
    $availableCapacity = $skuCapacity.properties.availableCapacity
    
    # Set capacity defaults based on SKU
    if ($SELECTED_SKU -eq "ProvisionedManaged") {
      # PTU deployments - different units
      $minCapacity = 50
      $maxCapacity = 1000
      $stepCapacity = 50
      $defaultCapacity = 100
      $unit = "PTU"
    } else {
      # TPM deployments
      $minCapacity = 1000
      $maxCapacity = [Math]::Min($availableCapacity, 300000)
      $stepCapacity = 1000
      $defaultCapacity = [Math]::Min(10000, [Math]::Floor($availableCapacity / 2))
      $unit = "TPM"
    }
    
    Write-Output "Capacity Configuration:"
    Write-Output "  Available: $availableCapacity $unit"
    Write-Output "  Minimum: $minCapacity $unit"
    Write-Output "  Maximum: $maxCapacity $unit"
    Write-Output "  Step: $stepCapacity $unit"
    Write-Output "  Recommended: $defaultCapacity $unit"
    Write-Output ""
    
    if ($SELECTED_SKU -eq "ProvisionedManaged") {
      Write-Output "Note: Provisioned capacity is measured in PTU (Provisioned Throughput Units)"
    } else {
      Write-Output "Note: Capacity is measured in TPM (Tokens Per Minute)"
    }
    Write-Output ""
    
    # Get user input with strict validation
    $validInput = $false
    $attempts = 0
    $maxAttempts = 3
    
    while (-not $validInput -and $attempts -lt $maxAttempts) {
      $capacityChoice = Read-Host "Enter capacity (default: $defaultCapacity)"
      
      if ([string]::IsNullOrEmpty($capacityChoice)) {
        $DEPLOY_CAPACITY = $defaultCapacity
        $validInput = $true
      } else {
        try {
          $inputCapacity = [int]$capacityChoice
          
          # Validate against minimum
          if ($inputCapacity -lt $minCapacity) {
            Write-Output ""
            Write-Output "❌ Capacity too low!"
            Write-Output "   Entered: $inputCapacity $unit"
            Write-Output "   Minimum: $minCapacity $unit"
            Write-Output "   Please enter a value >= $minCapacity"
            Write-Output ""
            $attempts++
            continue
          }
          
          # Validate against maximum (CRITICAL: available quota check)
          if ($inputCapacity -gt $maxCapacity) {
            Write-Output ""
            Write-Output "❌ Insufficient Quota!"
            Write-Output "   Requested: $inputCapacity $unit"
            Write-Output "   Available: $maxCapacity $unit (your current quota limit)"
            Write-Output ""
            Write-Output "You must enter a value between $minCapacity and $maxCapacity $unit"
            Write-Output ""
            Write-Output "To increase quota, visit:"
            Write-Output "https://portal.azure.com/#view/Microsoft_Azure_Capacity/QuotaMenuBlade"
            Write-Output ""
            $attempts++
            continue
          }
          
          # Validate step (must be multiple of step)
          if ($inputCapacity % $stepCapacity -ne 0) {
            Write-Output ""
            Write-Output "⚠ Capacity must be a multiple of $stepCapacity $unit"
            Write-Output "   Entered: $inputCapacity"
            Write-Output "   Valid examples: $minCapacity, $($minCapacity + $stepCapacity), $($minCapacity + 2*$stepCapacity)..."
            Write-Output ""
            $attempts++
            continue
          }
          
          # All validations passed
          $DEPLOY_CAPACITY = $inputCapacity
          $validInput = $true
          
        } catch {
          Write-Output ""
          Write-Output "❌ Invalid input. Please enter a numeric value."
          Write-Output ""
          $attempts++
        }
      }
    }
    
    if (-not $validInput) {
      Write-Output ""
      Write-Output "❌ Too many invalid attempts."
      Write-Output "Using recommended capacity: $defaultCapacity $unit"
      Write-Output ""
      $DEPLOY_CAPACITY = $defaultCapacity
    }
    
    Write-Output "✓ Deployment capacity validated: $DEPLOY_CAPACITY $unit"
  } else {
    Write-Output "⚠ Unable to determine capacity for $SELECTED_SKU"
    Write-Output ""
    Write-Output "Cannot proceed without capacity information."
    Write-Output "Please check:"
    Write-Output "  • Azure CLI authentication (az account show)"
    Write-Output "  • Permissions to query model capacities"
    Write-Output "  • Network connectivity"
    Write-Output ""
    Write-Output "Alternatively, check quota in Azure Portal:"
    Write-Output "  https://portal.azure.com → Quotas → Cognitive Services"
    exit 1
  }
} else {
  Write-Output "⚠ Unable to query capacity API"
  Write-Output ""
  Write-Output "Cannot proceed without capacity information."
  Write-Output "Please verify:"
  Write-Output "  • Azure CLI is authenticated: az account show"
  Write-Output "  • You have permissions to query capacities"
  Write-Output "  • API endpoint is accessible"
  Write-Output ""
  Write-Output "Alternatively, check quota in Azure Portal:"
  Write-Output "  https://portal.azure.com → Quotas → Cognitive Services"
  exit 1
}
```

---

### Phase 8: Select RAI Policy (Content Filter)

**List available RAI policies:**

#### PowerShell
```powershell
Write-Output "Available Content Filters (RAI Policies):"
Write-Output ""
Write-Output "  1. Microsoft.DefaultV2 (Recommended - Balanced filtering)"
Write-Output "     • Filters hate, violence, sexual, self-harm content"
Write-Output "     • Suitable for most applications"
Write-Output ""
Write-Output "  2. Microsoft.Prompt-Shield"
Write-Output "     • Enhanced prompt injection detection"
Write-Output "     • Jailbreak attempt protection"
Write-Output ""

# In production, query actual RAI policies:
# az cognitiveservices account list --query "[?location=='$PROJECT_REGION'].properties.contentFilter" -o json

$raiChoice = Read-Host "Select RAI policy (1-2, default: 1)"

switch ($raiChoice) {
  "1" { $RAI_POLICY = "Microsoft.DefaultV2" }
  "2" { $RAI_POLICY = "Microsoft.Prompt-Shield" }
  "" { $RAI_POLICY = "Microsoft.DefaultV2" }
  default { $RAI_POLICY = "Microsoft.DefaultV2" }
}

Write-Output "Selected RAI policy: $RAI_POLICY"
```

**What are RAI Policies?**

RAI (Responsible AI) policies control content filtering:
- **Hate**: Discriminatory or hateful content
- **Violence**: Violent or graphic content
- **Sexual**: Sexual or suggestive content
- **Self-harm**: Content promoting self-harm

**Policy Options:**
- `Microsoft.DefaultV2` - Balanced filtering (recommended)
- `Microsoft.Prompt-Shield` - Enhanced security
- Custom policies - Organization-specific filters

---

### Phase 9: Configure Advanced Options

**Check which advanced options are available:**

#### A. Dynamic Quota

**What is Dynamic Quota?**
Allows automatic scaling beyond base allocation when capacity is available.

#### PowerShell
```powershell
if ($SELECTED_SKU -eq "GlobalStandard") {
  Write-Output ""
  Write-Output "Dynamic Quota Configuration:"
  Write-Output ""
  Write-Output "Enable dynamic quota?"
  Write-Output "• Automatically scales beyond base allocation when capacity available"
  Write-Output "• Recommended for most workloads"
  Write-Output ""
  
  $dynamicQuotaChoice = Read-Host "Enable dynamic quota? (Y/n, default: Y)"
  
  if ([string]::IsNullOrEmpty($dynamicQuotaChoice) -or $dynamicQuotaChoice -eq "Y" -or $dynamicQuotaChoice -eq "y") {
    $DYNAMIC_QUOTA_ENABLED = $true
    Write-Output "✓ Dynamic quota enabled"
  } else {
    $DYNAMIC_QUOTA_ENABLED = $false
    Write-Output "Dynamic quota disabled"
  }
} else {
  $DYNAMIC_QUOTA_ENABLED = $false
}
```

#### B. Priority Processing

**What is Priority Processing?**
Ensures requests are prioritized during high load periods (additional charges may apply).

#### PowerShell
```powershell
if ($SELECTED_SKU -eq "ProvisionedManaged") {
  Write-Output ""
  Write-Output "Priority Processing Configuration:"
  Write-Output ""
  Write-Output "Enable priority processing?"
  Write-Output "• Prioritizes your requests during high load"
  Write-Output "• Additional charges apply"
  Write-Output ""
  
  $priorityChoice = Read-Host "Enable priority processing? (y/N, default: N)"
  
  if ($priorityChoice -eq "Y" -or $priorityChoice -eq "y") {
    $PRIORITY_PROCESSING_ENABLED = $true
    Write-Output "✓ Priority processing enabled"
  } else {
    $PRIORITY_PROCESSING_ENABLED = $false
    Write-Output "Priority processing disabled"
  }
} else {
  $PRIORITY_PROCESSING_ENABLED = $false
}
```

#### C. Spillover Deployment

**What is Spillover?**
Redirects requests to another deployment when this one reaches capacity.

#### PowerShell
```powershell
Write-Output ""
Write-Output "Spillover Configuration:"
Write-Output ""
Write-Output "Configure spillover deployment?"
Write-Output "• Redirects requests when capacity is reached"
Write-Output "• Requires an existing backup deployment"
Write-Output ""

$spilloverChoice = Read-Host "Enable spillover? (y/N, default: N)"

if ($spilloverChoice -eq "Y" -or $spilloverChoice -eq "y") {
  # List existing deployments
  Write-Output "Available deployments for spillover:"
  $existingDeployments = az cognitiveservices account deployment list `
    --name $ACCOUNT_NAME `
    --resource-group $RESOURCE_GROUP `
    --query "[].name" -o json | ConvertFrom-Json
  
  if ($existingDeployments.Count -gt 0) {
    for ($i = 0; $i -lt $existingDeployments.Count; $i++) {
      Write-Output "  $($i+1). $($existingDeployments[$i])"
    }
    
    $spilloverTargetChoice = Read-Host "Select spillover target (1-$($existingDeployments.Count))"
    $SPILLOVER_TARGET = $existingDeployments[[int]$spilloverTargetChoice - 1]
    $SPILLOVER_ENABLED = $true
    Write-Output "✓ Spillover enabled to: $SPILLOVER_TARGET"
  } else {
    Write-Output "⚠ No existing deployments for spillover"
    $SPILLOVER_ENABLED = $false
  }
} else {
  $SPILLOVER_ENABLED = $false
  Write-Output "Spillover disabled"
}
```

---

### Phase 10: Configure Version Upgrade Policy

**Version upgrade options:**

| Policy | Description | Behavior |
|--------|-------------|----------|
| **OnceNewDefaultVersionAvailable** | Auto-upgrade to new default (Recommended) | Automatic updates |
| **OnceCurrentVersionExpired** | Wait until current expires | Deferred updates |
| **NoAutoUpgrade** | Manual upgrade only | Full control |

#### PowerShell
```powershell
Write-Output ""
Write-Output "Version Upgrade Policy:"
Write-Output ""
Write-Output "When a new default version is available, how should this deployment be updated?"
Write-Output ""
Write-Output "  1. OnceNewDefaultVersionAvailable (Recommended)"
Write-Output "     • Automatically upgrade to new default version"
Write-Output "     • Gets latest features and improvements"
Write-Output ""
Write-Output "  2. OnceCurrentVersionExpired"
Write-Output "     • Wait until current version expires"
Write-Output "     • Deferred updates"
Write-Output ""
Write-Output "  3. NoAutoUpgrade"
Write-Output "     • Manual upgrade only"
Write-Output "     • Full control over updates"
Write-Output ""

$upgradeChoice = Read-Host "Select policy (1-3, default: 1)"

switch ($upgradeChoice) {
  "1" { $VERSION_UPGRADE_POLICY = "OnceNewDefaultVersionAvailable" }
  "2" { $VERSION_UPGRADE_POLICY = "OnceCurrentVersionExpired" }
  "3" { $VERSION_UPGRADE_POLICY = "NoAutoUpgrade" }
  "" { $VERSION_UPGRADE_POLICY = "OnceNewDefaultVersionAvailable" }
  default { $VERSION_UPGRADE_POLICY = "OnceNewDefaultVersionAvailable" }
}

Write-Output "Selected policy: $VERSION_UPGRADE_POLICY"
```

---

### Phase 11: Generate Deployment Name

**Auto-generate unique name:**

#### PowerShell
```powershell
Write-Output ""
Write-Output "Generating deployment name..."

# Get existing deployments
$existingNames = az cognitiveservices account deployment list `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --query "[].name" -o json | ConvertFrom-Json

# Generate unique name
$baseName = $MODEL_NAME
$deploymentName = $baseName
$counter = 2

while ($existingNames -contains $deploymentName) {
  $deploymentName = "$baseName-$counter"
  $counter++
}

Write-Output "Generated deployment name: $deploymentName"
Write-Output ""

$customNameChoice = Read-Host "Use this name or specify custom? (Enter for default, or type custom name)"

if (-not [string]::IsNullOrEmpty($customNameChoice)) {
  # Validate custom name
  if ($customNameChoice -match '^[\w.-]{2,64}$') {
    $DEPLOYMENT_NAME = $customNameChoice
    Write-Output "Using custom name: $DEPLOYMENT_NAME"
  } else {
    Write-Output "⚠ Invalid name. Using generated name: $deploymentName"
    $DEPLOYMENT_NAME = $deploymentName
  }
} else {
  $DEPLOYMENT_NAME = $deploymentName
  Write-Output "Using generated name: $DEPLOYMENT_NAME"
}
```

---

### Phase 12: Review Configuration

**Display complete configuration for confirmation:**

#### PowerShell
```powershell
Write-Output ""
Write-Output "═══════════════════════════════════════════"
Write-Output "Deployment Configuration Review"
Write-Output "═══════════════════════════════════════════"
Write-Output ""
Write-Output "Model Configuration:"
Write-Output "  Model:                  $MODEL_NAME"
Write-Output "  Version:                $MODEL_VERSION"
Write-Output "  Deployment Name:        $DEPLOYMENT_NAME"
Write-Output ""
Write-Output "Capacity Configuration:"
Write-Output "  SKU:                    $SELECTED_SKU"
Write-Output "  Capacity:               $DEPLOY_CAPACITY $(if ($SELECTED_SKU -eq 'ProvisionedManaged') { 'PTU' } else { 'TPM' })"
Write-Output "  Region:                 $PROJECT_REGION"
Write-Output ""
Write-Output "Policy Configuration:"
Write-Output "  RAI Policy:             $RAI_POLICY"
Write-Output "  Version Upgrade:        $VERSION_UPGRADE_POLICY"
Write-Output ""

if ($SELECTED_SKU -eq "GlobalStandard") {
  Write-Output "Advanced Options:"
  Write-Output "  Dynamic Quota:          $(if ($DYNAMIC_QUOTA_ENABLED) { 'Enabled' } else { 'Disabled' })"
}

if ($SELECTED_SKU -eq "ProvisionedManaged") {
  Write-Output "Advanced Options:"
  Write-Output "  Priority Processing:    $(if ($PRIORITY_PROCESSING_ENABLED) { 'Enabled' } else { 'Disabled' })"
}

if ($SPILLOVER_ENABLED) {
  Write-Output "  Spillover:              Enabled → $SPILLOVER_TARGET"
} else {
  Write-Output "  Spillover:              Disabled"
}

Write-Output ""
Write-Output "Project Details:"
Write-Output "  Account:                $ACCOUNT_NAME"
Write-Output "  Resource Group:         $RESOURCE_GROUP"
Write-Output "  Project:                $PROJECT_NAME"
Write-Output ""
Write-Output "═══════════════════════════════════════════"
Write-Output ""

$confirmChoice = Read-Host "Proceed with deployment? (Y/n)"

if ($confirmChoice -eq "n" -or $confirmChoice -eq "N") {
  Write-Output "Deployment cancelled"
  exit 0
}
```

---

### Phase 13: Execute Deployment

**Create deployment using Azure CLI:**

#### PowerShell
```powershell
Write-Output ""
Write-Output "Creating deployment..."
Write-Output "This may take a few minutes..."
Write-Output ""

# Build deployment command
$deployCmd = @"
az cognitiveservices account deployment create ``
  --name $ACCOUNT_NAME ``
  --resource-group $RESOURCE_GROUP ``
  --deployment-name $DEPLOYMENT_NAME ``
  --model-name $MODEL_NAME ``
  --model-version $MODEL_VERSION ``
  --model-format "OpenAI" ``
  --sku-name $SELECTED_SKU ``
  --sku-capacity $DEPLOY_CAPACITY
"@

# Add optional parameters
# Note: Some advanced options may require REST API if not supported in CLI

Write-Output "Executing deployment..."
Write-Output ""

$result = az cognitiveservices account deployment create `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --deployment-name $DEPLOYMENT_NAME `
  --model-name $MODEL_NAME `
  --model-version $MODEL_VERSION `
  --model-format "OpenAI" `
  --sku-name $SELECTED_SKU `
  --sku-capacity $DEPLOY_CAPACITY 2>&1

if ($LASTEXITCODE -eq 0) {
  Write-Output "✓ Deployment created successfully!"
} else {
  Write-Output "❌ Deployment failed"
  Write-Output $result
  exit 1
}
```

**Monitor deployment status:**

#### PowerShell
```powershell
Write-Output ""
Write-Output "Monitoring deployment status..."
Write-Output ""

$maxWait = 300  # 5 minutes
$elapsed = 0
$interval = 10

while ($elapsed -lt $maxWait) {
  $status = az cognitiveservices account deployment show `
    --name $ACCOUNT_NAME `
    --resource-group $RESOURCE_GROUP `
    --deployment-name $DEPLOYMENT_NAME `
    --query "properties.provisioningState" -o tsv 2>$null
  
  switch ($status) {
    "Succeeded" {
      Write-Output "✓ Deployment successful!"
      break
    }
    "Failed" {
      Write-Output "❌ Deployment failed"
      # Get error details
      az cognitiveservices account deployment show `
        --name $ACCOUNT_NAME `
        --resource-group $RESOURCE_GROUP `
        --deployment-name $DEPLOYMENT_NAME `
        --query "properties"
      exit 1
    }
    { $_ -in @("Creating", "Accepted", "Running") } {
      Write-Output "Status: $status... (${elapsed}s elapsed)"
      Start-Sleep -Seconds $interval
      $elapsed += $interval
    }
    default {
      Write-Output "Unknown status: $status"
      Start-Sleep -Seconds $interval
      $elapsed += $interval
    }
  }
  
  if ($status -eq "Succeeded") { break }
}

if ($elapsed -ge $maxWait) {
  Write-Output "⚠ Deployment timeout after ${maxWait}s"
  Write-Output "Check status manually:"
  Write-Output "  az cognitiveservices account deployment show \"
  Write-Output "    --name $ACCOUNT_NAME \"
  Write-Output "    --resource-group $RESOURCE_GROUP \"
  Write-Output "    --deployment-name $DEPLOYMENT_NAME"
  exit 1
}
```

**Display final summary:**

#### PowerShell
```powershell
Write-Output ""
Write-Output "═══════════════════════════════════════════"
Write-Output "✓ Deployment Successful!"
Write-Output "═══════════════════════════════════════════"
Write-Output ""

# Get deployment details
$deploymentDetails = az cognitiveservices account deployment show `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --deployment-name $DEPLOYMENT_NAME `
  --query "properties" -o json | ConvertFrom-Json

$endpoint = az cognitiveservices account show `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --query "properties.endpoint" -o tsv

Write-Output "Deployment Name: $DEPLOYMENT_NAME"
Write-Output "Model: $MODEL_NAME"
Write-Output "Version: $MODEL_VERSION"
Write-Output "Status: $($deploymentDetails.provisioningState)"
Write-Output ""
Write-Output "Configuration:"
Write-Output "  • SKU: $SELECTED_SKU"
Write-Output "  • Capacity: $DEPLOY_CAPACITY $(if ($SELECTED_SKU -eq 'ProvisionedManaged') { 'PTU' } else { 'TPM' })"
Write-Output "  • Region: $PROJECT_REGION"
Write-Output "  • RAI Policy: $RAI_POLICY"
Write-Output ""

if ($deploymentDetails.rateLimits) {
  Write-Output "Rate Limits:"
  foreach ($limit in $deploymentDetails.rateLimits) {
    Write-Output "  • $($limit.key): $($limit.count) per $($limit.renewalPeriod)s"
  }
  Write-Output ""
}

Write-Output "Endpoint: $endpoint"
Write-Output ""
Write-Output "═══════════════════════════════════════════"
Write-Output ""

Write-Output "Next steps:"
Write-Output "• Test in Azure AI Foundry playground"
Write-Output "• Integrate into your application"
Write-Output "• Monitor usage and performance"
```

---

## Selection Guides

### How to Choose SKU

| SKU | Best For | Cost | Availability |
|-----|----------|------|--------------|
| **GlobalStandard** | Production, high availability | Medium | Multi-region |
| **Standard** | Development, testing | Low | Single region |
| **ProvisionedManaged** | High-volume, predictable workloads | Fixed (PTU) | Reserved capacity |
| **DataZoneStandard** | Data residency requirements | Medium | Specific zones |

**Decision Tree:**
```
Do you need guaranteed throughput?
├─ Yes → ProvisionedManaged (PTU)
└─ No → Do you need high availability?
        ├─ Yes → GlobalStandard
        └─ No → Standard
```

### How to Choose Capacity

**For TPM-based SKUs (GlobalStandard, Standard):**

| Workload | Recommended Capacity |
|----------|---------------------|
| Development/Testing | 1K - 5K TPM |
| Small Production | 5K - 20K TPM |
| Medium Production | 20K - 100K TPM |
| Large Production | 100K+ TPM |

**For PTU-based SKUs (ProvisionedManaged):**

Use the PTU calculator based on:
- Input tokens per minute
- Output tokens per minute
- Requests per minute

**Capacity Planning Tips:**
- Start with recommended capacity
- Monitor usage and adjust
- Enable dynamic quota for flexibility
- Consider spillover for peak loads

### How to Choose RAI Policy

| Policy | Filtering Level | Use Case |
|--------|----------------|----------|
| **Microsoft.DefaultV2** | Balanced | Most applications |
| **Microsoft.Prompt-Shield** | Enhanced | Security-sensitive apps |
| **Custom** | Configurable | Specific requirements |

**Recommendation:** Start with `Microsoft.DefaultV2` and adjust based on application needs.

---

## Error Handling

### Common Issues and Resolutions

| Error | Cause | Resolution |
|-------|-------|------------|
| **Model not found** | Invalid model name | List available models with `az cognitiveservices account list-models` |
| **Version not available** | Version not supported for SKU | Select different version or SKU |
| **Insufficient quota** | Requested capacity > available quota | **PREVENTED at input**: Skill validates capacity against quota before deployment. If you see this error, the quota query failed or quota changed between validation and deployment. |
| **SKU not supported** | SKU not available in region | Select different SKU or region |
| **Capacity out of range** | Invalid capacity value | **PREVENTED at input**: Skill validates min/max/step at capacity input phase (Phase 7) |
| **Deployment name exists** | Name conflict | Use different name (auto-incremented) |
| **Authentication failed** | Not logged in | Run `az login` |
| **Permission denied** | Insufficient permissions | Assign Cognitive Services Contributor role |
| **Capacity query fails** | API error, permissions, or network issue | **DEPLOYMENT BLOCKED**: Skill will not proceed without valid quota information. Check Azure CLI auth and permissions. |

### Troubleshooting Commands

**Check deployment status:**
```bash
az cognitiveservices account deployment show \
  --name <account-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name>
```

**List all deployments:**
```bash
az cognitiveservices account deployment list \
  --name <account-name> \
  --resource-group <resource-group> \
  --output table
```

**Check quota usage:**
```bash
az cognitiveservices usage list \
  --name <account-name> \
  --resource-group <resource-group>
```

**Delete failed deployment:**
```bash
az cognitiveservices account deployment delete \
  --name <account-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name>
```

---

## Advanced Topics

### PTU (Provisioned Throughput Units) Deployments

**What is PTU?**
- Reserved capacity with guaranteed throughput
- Measured in PTU units, not TPM
- Fixed cost regardless of usage
- Best for high-volume, predictable workloads

**PTU Calculator:**

```
Estimated PTU = (Input TPM × 0.001) + (Output TPM × 0.002) + (Requests/min × 0.1)

Example:
- Input: 10,000 tokens/min
- Output: 5,000 tokens/min
- Requests: 100/min

PTU = (10,000 × 0.001) + (5,000 × 0.002) + (100 × 0.1)
    = 10 + 10 + 10
    = 30 PTU
```

**PTU Deployment:**
```bash
az cognitiveservices account deployment create \
  --name <account-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --model-name <model-name> \
  --model-version <version> \
  --model-format "OpenAI" \
  --sku-name "ProvisionedManaged" \
  --sku-capacity 100  # PTU units
```

### Spillover Configuration

**Spillover Workflow:**
1. Primary deployment receives requests
2. When capacity reached, requests overflow to spillover target
3. Spillover target must be same model or compatible
4. Configure via deployment properties

**Best Practices:**
- Use spillover for peak load handling
- Spillover target should have sufficient capacity
- Monitor both deployments
- Test failover behavior

### Priority Processing

**What is Priority Processing?**
- Prioritizes your requests during high load
- Available for ProvisionedManaged SKU
- Additional charges apply
- Ensures consistent performance

**When to Use:**
- Mission-critical applications
- SLA requirements
- High-concurrency scenarios

---

## Related Skills

- **deploy-model-optimal-region** - Quick deployment to best region with automatic configuration
- **microsoft-foundry** - Parent skill for all Azure AI Foundry operations
- **quota** - Manage quotas and capacity
- **rbac** - Manage permissions and access control

---

## Notes

- **Project Resource ID:** Set `PROJECT_RESOURCE_ID` environment variable to skip prompt
- **SKU Availability:** Not all SKUs available in all regions
- **Capacity Limits:** Varies by subscription, region, and model
- **RAI Policies:** Custom policies can be configured in Azure Portal
- **Version Upgrades:** Automatic upgrades occur during maintenance windows
- **Monitoring:** Use Azure Monitor and Application Insights for production deployments

---

## References

**Azure Documentation:**
- [Azure OpenAI Service](https://learn.microsoft.com/azure/ai-services/openai/)
- [Model Deployments](https://learn.microsoft.com/azure/ai-services/openai/how-to/create-resource)
- [Provisioned Throughput](https://learn.microsoft.com/azure/ai-services/openai/how-to/provisioned-throughput)
- [Content Filtering](https://learn.microsoft.com/azure/ai-services/openai/concepts/content-filter)

**Azure CLI:**
- [Cognitive Services Commands](https://learn.microsoft.com/cli/azure/cognitiveservices)
