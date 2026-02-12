# Customize Workflow — Detailed Phase Instructions

> Reference for: `models/deploy-model/customize/SKILL.md`

## Phase 1: Verify Authentication

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

## Phase 2: Get Project Resource ID

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

## Phase 3: Parse and Verify Project

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

## Phase 4: Get Model Name

**If model name not provided as parameter, fetch available models dynamically:**

#### PowerShell
```powershell
Write-Output "Fetching available models..."

$models = az cognitiveservices account list-models `
  --name $ACCOUNT_NAME `
  --resource-group $RESOURCE_GROUP `
  --query "[].name" -o json | ConvertFrom-Json | Sort-Object -Unique

if (-not $models -or $models.Count -eq 0) {
  Write-Output "❌ No models available in this account"
  exit 1
}

Write-Output "Available models:"
for ($i = 0; $i -lt $models.Count; $i++) {
  Write-Output "  $($i+1). $($models[$i])"
}
Write-Output "  $($models.Count+1). Custom model name"
Write-Output ""

$modelChoice = Read-Host "Enter choice (1-$($models.Count+1))"

if ([int]$modelChoice -le $models.Count) {
  $MODEL_NAME = $models[[int]$modelChoice - 1]
} else {
  $MODEL_NAME = Read-Host "Enter custom model name"
}

Write-Output "Selected model: $MODEL_NAME"
```

---

## Phase 5: List and Select Model Version

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

## Phase 6: List and Select SKU

> ⚠️ **Warning:** Do NOT present hardcoded SKU lists. Always query model catalog + subscription quota before showing options.

**Step A: Query model-supported SKUs:**

#### PowerShell
```powershell
Write-Output "Fetching supported SKUs for $MODEL_NAME (version $MODEL_VERSION)..."

# Get SKUs the model supports in this region
$modelCatalog = az cognitiveservices model list --location $PROJECT_REGION --subscription $SUBSCRIPTION_ID -o json 2>$null | ConvertFrom-Json
$modelEntry = $modelCatalog | Where-Object { $_.model.name -eq $MODEL_NAME -and $_.model.version -eq $MODEL_VERSION } | Select-Object -First 1

if (-not $modelEntry) {
  Write-Output "❌ Model $MODEL_NAME version $MODEL_VERSION not found in region $PROJECT_REGION"
  exit 1
}

$supportedSkus = $modelEntry.model.skus | ForEach-Object { $_.name }
Write-Output "Model-supported SKUs: $($supportedSkus -join ', ')"
```

**Step B: Check subscription quota per SKU:**

```powershell
# Get subscription quota usage for this region
$usageData = az cognitiveservices usage list --location $PROJECT_REGION --subscription $SUBSCRIPTION_ID -o json 2>$null | ConvertFrom-Json

# Build deployable SKU list with quota info
$deployableSkus = @()
$unavailableSkus = @()

foreach ($sku in $supportedSkus) {
  # Quota names follow pattern: OpenAI.<SKU>.<model-name>
  $usageEntry = $usageData | Where-Object { $_.name.value -eq "OpenAI.$sku.$MODEL_NAME" }

  if ($usageEntry) {
    $limit = $usageEntry.limit
    $current = $usageEntry.currentValue
    $available = $limit - $current
  } else {
    # No usage entry means no quota allocated for this SKU
    $available = 0
    $limit = 0
    $current = 0
  }

  if ($available -gt 0) {
    $deployableSkus += [PSCustomObject]@{ Name = $sku; Available = $available; Limit = $limit; Used = $current }
  } else {
    $unavailableSkus += [PSCustomObject]@{ Name = $sku; Available = 0; Limit = $limit; Used = $current }
  }
}
```

**Step C: Present only deployable SKUs:**

```powershell
if ($deployableSkus.Count -eq 0) {
  Write-Output ""
  Write-Output "❌ No SKUs have available quota for $MODEL_NAME in $PROJECT_REGION"
  Write-Output ""
  Write-Output "All supported SKUs are at quota limit:"
  foreach ($s in $unavailableSkus) {
    Write-Output "  ❌ $($s.Name) — Quota: $($s.Used)/$($s.Limit) (0 available)"
  }
  Write-Output ""
  Write-Output "Request quota increase — use the [quota skill](../../../../quota/quota.md) for guidance."
  exit 1
}

Write-Output ""
Write-Output "Available SKUs for $MODEL_NAME (version $MODEL_VERSION) in $PROJECT_REGION:"
Write-Output ""
for ($i = 0; $i -lt $deployableSkus.Count; $i++) {
  $s = $deployableSkus[$i]
  if ($s.Available -ge 1000) {
    $capDisplay = "$([Math]::Floor($s.Available / 1000))K"
  } else {
    $capDisplay = "$($s.Available)"
  }
  $marker = if ($i -eq 0) { " (Recommended)" } else { "" }
  Write-Output "  $($i+1). $($s.Name)$marker — $capDisplay TPM available (quota: $($s.Used)/$($s.Limit))"
}

# Show unavailable SKUs as informational
if ($unavailableSkus.Count -gt 0) {
  Write-Output ""
  Write-Output "Unavailable (no quota):"
  foreach ($s in $unavailableSkus) {
    Write-Output "  ❌ $($s.Name) — Quota: $($s.Used)/$($s.Limit)"
  }
}

Write-Output ""
$skuChoice = Read-Host "Select SKU (1-$($deployableSkus.Count), default: 1)"

if ([string]::IsNullOrEmpty($skuChoice)) {
  $SELECTED_SKU = $deployableSkus[0].Name
} else {
  $SELECTED_SKU = $deployableSkus[[int]$skuChoice - 1].Name
}

Write-Output "Selected SKU: $SELECTED_SKU"
```

---

## Phase 7: Configure Capacity

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
            Write-Output "To request a quota increase, use the [quota skill](../../../../quota/quota.md)."
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
    # No capacity for selected SKU in current region — try cross-region fallback
    Write-Output "⚠ No capacity for $SELECTED_SKU in current region ($PROJECT_REGION)"
    Write-Output ""
    Write-Output "Searching all regions for available capacity..."
    Write-Output ""

    # Query capacity across ALL regions (remove location filter)
    $allRegionsUrl = "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=$MODEL_NAME&modelVersion=$MODEL_VERSION"
    $allRegionsResult = az rest --method GET --url "$allRegionsUrl" 2>$null | ConvertFrom-Json

    if ($allRegionsResult.value) {
      $availableRegions = $allRegionsResult.value | Where-Object {
        $_.properties.skuName -eq $SELECTED_SKU -and $_.properties.availableCapacity -gt 0
      } | Sort-Object { $_.properties.availableCapacity } -Descending

      if ($availableRegions -and $availableRegions.Count -gt 0) {
        Write-Output "Available regions with $SELECTED_SKU capacity for $MODEL_NAME:"
        Write-Output ""
        for ($i = 0; $i -lt $availableRegions.Count; $i++) {
          $r = $availableRegions[$i]
          $cap = $r.properties.availableCapacity
          if ($cap -ge 1000000) {
            $capDisplay = "$([Math]::Round($cap / 1000000, 1))M TPM"
          } elseif ($cap -ge 1000) {
            $capDisplay = "$([Math]::Floor($cap / 1000))K TPM"
          } else {
            $capDisplay = "$cap TPM"
          }
          Write-Output "  $($i+1). $($r.location) - $capDisplay"
        }
        Write-Output ""

        $regionChoice = Read-Host "Select region (1-$($availableRegions.Count))"
        $selectedRegion = $availableRegions[[int]$regionChoice - 1]
        $PROJECT_REGION = $selectedRegion.location
        $availableCapacity = $selectedRegion.properties.availableCapacity

        Write-Output ""
        Write-Output "Selected region: $PROJECT_REGION (Available: $availableCapacity TPM)"
        Write-Output ""

        # Find existing projects in selected region
        $projectsInRegion = az cognitiveservices account list `
          --query "[?kind=='AIProject' && location=='$PROJECT_REGION'].{Name:name, ResourceGroup:resourceGroup}" `
          -o json 2>$null | ConvertFrom-Json

        if ($projectsInRegion -and $projectsInRegion.Count -gt 0) {
          Write-Output "Projects in $PROJECT_REGION`:"
          for ($p = 0; $p -lt $projectsInRegion.Count; $p++) {
            Write-Output "  $($p+1). $($projectsInRegion[$p].Name) ($($projectsInRegion[$p].ResourceGroup))"
          }
          Write-Output "  $($projectsInRegion.Count+1). Create new project"
          Write-Output ""
          $projChoice = Read-Host "Select project (1-$($projectsInRegion.Count+1))"
          if ([int]$projChoice -le $projectsInRegion.Count) {
            $ACCOUNT_NAME = $projectsInRegion[[int]$projChoice - 1].Name
            $RESOURCE_GROUP = $projectsInRegion[[int]$projChoice - 1].ResourceGroup
          } else {
            Write-Output "Please create a project in $PROJECT_REGION using the project/create skill, then re-run this deployment."
            exit 1
          }
        } else {
          Write-Output "No existing projects found in $PROJECT_REGION."
          Write-Output "Please create a project in $PROJECT_REGION using the project/create skill, then re-run this deployment."
          exit 1
        }

        Write-Output "✓ Switched to project: $ACCOUNT_NAME in $PROJECT_REGION"
        Write-Output ""

        # Re-run capacity configuration with the new region
        if ($SELECTED_SKU -eq "ProvisionedManaged") {
          $minCapacity = 50
          $maxCapacity = 1000
          $stepCapacity = 50
          $defaultCapacity = 100
          $unit = "PTU"
        } else {
          $minCapacity = 1000
          $maxCapacity = [Math]::Min($availableCapacity, 300000)
          $stepCapacity = 1000
          $defaultCapacity = [Math]::Min(10000, [Math]::Floor($availableCapacity / 2))
          $unit = "TPM"
        }

        Write-Output "Capacity Configuration:"
        Write-Output "  Available: $availableCapacity $unit"
        Write-Output "  Recommended: $defaultCapacity $unit"
        Write-Output ""

        $capacityChoice = Read-Host "Enter capacity (default: $defaultCapacity)"
        if ([string]::IsNullOrEmpty($capacityChoice)) {
          $DEPLOY_CAPACITY = $defaultCapacity
        } else {
          $DEPLOY_CAPACITY = [int]$capacityChoice
        }

        Write-Output "✓ Deployment capacity validated: $DEPLOY_CAPACITY $unit"
      } else {
        Write-Output "❌ No regions have available capacity for $MODEL_NAME with $SELECTED_SKU SKU."
        Write-Output ""
        Write-Output "Next Steps:"
        Write-Output "  1. Request quota increase — use the [quota skill](../../../../quota/quota.md)"
        Write-Output "  2. Check existing deployments that may be consuming quota"
        Write-Output "  3. Try a different model or SKU"
        exit 1
      }
    } else {
      Write-Output "❌ Unable to query capacity across regions."
      Write-Output "Please verify Azure CLI authentication and permissions."
      exit 1
    }
  }
} else {
  # Capacity API returned no data — try cross-region fallback
  Write-Output "⚠ No capacity data for current region ($PROJECT_REGION)"
  Write-Output ""
  Write-Output "Searching all regions for available capacity..."
  Write-Output ""

  $allRegionsUrl = "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CognitiveServices/modelCapacities?api-version=2024-10-01&modelFormat=OpenAI&modelName=$MODEL_NAME&modelVersion=$MODEL_VERSION"
  $allRegionsResult = az rest --method GET --url "$allRegionsUrl" 2>$null | ConvertFrom-Json

  if ($allRegionsResult.value) {
    $availableRegions = $allRegionsResult.value | Where-Object {
      $_.properties.skuName -eq $SELECTED_SKU -and $_.properties.availableCapacity -gt 0
    } | Sort-Object { $_.properties.availableCapacity } -Descending

    if ($availableRegions -and $availableRegions.Count -gt 0) {
      Write-Output "Available regions with $SELECTED_SKU capacity for $MODEL_NAME:"
      Write-Output ""
      for ($i = 0; $i -lt $availableRegions.Count; $i++) {
        $r = $availableRegions[$i]
        $cap = $r.properties.availableCapacity
        if ($cap -ge 1000000) {
          $capDisplay = "$([Math]::Round($cap / 1000000, 1))M TPM"
        } elseif ($cap -ge 1000) {
          $capDisplay = "$([Math]::Floor($cap / 1000))K TPM"
        } else {
          $capDisplay = "$cap TPM"
        }
        Write-Output "  $($i+1). $($r.location) - $capDisplay"
      }
      Write-Output ""

      $regionChoice = Read-Host "Select region (1-$($availableRegions.Count))"
      $selectedRegion = $availableRegions[[int]$regionChoice - 1]
      $PROJECT_REGION = $selectedRegion.location
      $availableCapacity = $selectedRegion.properties.availableCapacity

      Write-Output ""
      Write-Output "Selected region: $PROJECT_REGION (Available: $availableCapacity TPM)"
      Write-Output ""

      # Find existing projects in selected region
      $projectsInRegion = az cognitiveservices account list `
        --query "[?kind=='AIProject' && location=='$PROJECT_REGION'].{Name:name, ResourceGroup:resourceGroup}" `
        -o json 2>$null | ConvertFrom-Json

      if ($projectsInRegion -and $projectsInRegion.Count -gt 0) {
        Write-Output "Projects in $PROJECT_REGION`:"
        for ($p = 0; $p -lt $projectsInRegion.Count; $p++) {
          Write-Output "  $($p+1). $($projectsInRegion[$p].Name) ($($projectsInRegion[$p].ResourceGroup))"
        }
        Write-Output "  $($projectsInRegion.Count+1). Create new project"
        Write-Output ""
        $projChoice = Read-Host "Select project (1-$($projectsInRegion.Count+1))"
        if ([int]$projChoice -le $projectsInRegion.Count) {
          $ACCOUNT_NAME = $projectsInRegion[[int]$projChoice - 1].Name
          $RESOURCE_GROUP = $projectsInRegion[[int]$projChoice - 1].ResourceGroup
        } else {
          Write-Output "Please create a project in $PROJECT_REGION using the project/create skill, then re-run this deployment."
          exit 1
        }
      } else {
        Write-Output "No existing projects found in $PROJECT_REGION."
        Write-Output "Please create a project in $PROJECT_REGION using the project/create skill, then re-run this deployment."
        exit 1
      }

      Write-Output "✓ Switched to project: $ACCOUNT_NAME in $PROJECT_REGION"
      Write-Output ""

      if ($SELECTED_SKU -eq "ProvisionedManaged") {
        $minCapacity = 50; $maxCapacity = 1000; $stepCapacity = 50; $defaultCapacity = 100; $unit = "PTU"
      } else {
        $minCapacity = 1000
        $maxCapacity = [Math]::Min($availableCapacity, 300000)
        $stepCapacity = 1000
        $defaultCapacity = [Math]::Min(10000, [Math]::Floor($availableCapacity / 2))
        $unit = "TPM"
      }

      Write-Output "Capacity Configuration:"
      Write-Output "  Available: $availableCapacity $unit"
      Write-Output "  Recommended: $defaultCapacity $unit"
      Write-Output ""

      $capacityChoice = Read-Host "Enter capacity (default: $defaultCapacity)"
      if ([string]::IsNullOrEmpty($capacityChoice)) {
        $DEPLOY_CAPACITY = $defaultCapacity
      } else {
        $DEPLOY_CAPACITY = [int]$capacityChoice
      }

      Write-Output "✓ Deployment capacity validated: $DEPLOY_CAPACITY $unit"
    } else {
      Write-Output "❌ No regions have available capacity for $MODEL_NAME with $SELECTED_SKU SKU."
      Write-Output ""
      Write-Output "Next Steps:"
      Write-Output "  1. Request quota increase — use the [quota skill](../../../../quota/quota.md)"
      Write-Output "  2. Check existing deployments that may be consuming quota"
      Write-Output "  3. Try a different model or SKU"
      exit 1
    }
  } else {
    Write-Output "❌ Unable to query capacity across regions."
    Write-Output "Please verify Azure CLI authentication and permissions."
    exit 1
  }
}
```

---

## Phase 8: Select RAI Policy (Content Filter)

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

## Phase 9: Configure Advanced Options

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

## Phase 10: Configure Version Upgrade Policy

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

## Phase 11: Generate Deployment Name

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

## Phase 12: Review Configuration

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

## Phase 13: Execute Deployment

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

# Generate direct link to deployment in Azure AI Foundry portal
$scriptPath = Join-Path (Split-Path $PSCommandPath) "scripts\generate_deployment_url.ps1"
$deploymentUrl = & $scriptPath `
  -SubscriptionId $SUBSCRIPTION_ID `
  -ResourceGroup $RESOURCE_GROUP `
  -FoundryResource $ACCOUNT_NAME `
  -ProjectName $PROJECT_NAME `
  -DeploymentName $DEPLOYMENT_NAME

Write-Output ""
Write-Output "🔗 View in Azure AI Foundry Portal:"
Write-Output ""
Write-Output $deploymentUrl
Write-Output ""
Write-Output "═══════════════════════════════════════════"
Write-Output ""

Write-Output "Next steps:"
Write-Output "• Click the link above to test in Azure AI Foundry playground"
Write-Output "• Integrate into your application"
Write-Output "• Monitor usage and performance"
```
