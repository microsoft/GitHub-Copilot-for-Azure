<#
.SYNOPSIS
    Walks the agent through the azure-validate workflow, one step at a time.
.PARAMETER WorkspacePath
    Path to the workspace being validated (required).
#>
param(
    [string]$WorkspacePath
)

enum ValidationStep {
    None
    LoadPlan
    AddValidationSteps
    RunValidation
    BuildVerification
    StaticRoleVerification
    RecordProof
    ResolveErrors
    UpdateStatus
    Deploy
}

if (-not $WorkspacePath) {
    Write-Error "WorkspacePath is required."
    exit 2
}

# Step 0: Initialize status file
# If .azure/validate-status.json doesn't exist, create it with completedStep = None.
$validateStatusPath = Join-Path -Path $WorkspacePath -ChildPath ".azure/validate-status.json"
if (-not (Test-Path -Path $validateStatusPath)) {
    # Create the .azure directory if it doesn't exist
    $azureDir = Join-Path -Path $WorkspacePath -ChildPath ".azure"
    if (-not (Test-Path -Path $azureDir)) {
        New-Item -ItemType Directory -Path $azureDir | Out-Null
    }

    # Create the validate-status.json file
    $validateStatus = @{
        completedStep = [ValidationStep]::None.ToString()
    }
    $validateStatus | ConvertTo-Json | Set-Content -Path $validateStatusPath

    Write-Output "Created '.azure/validate-status.json' to track validation progress."
} else {
    # Load the existing validate-status.json
    $validateStatus = Get-Content -Path $validateStatusPath | ConvertFrom-Json
}

$completedStep = [ValidationStep]::None
$rawCompletedStep = $validateStatus.completedStep
if (-not [string]::IsNullOrEmpty($rawCompletedStep)) {
    if (-not [enum]::TryParse([ValidationStep], $rawCompletedStep, $true, [ref]$completedStep)) {
        Write-Error "Error: The completedStep property in `.azure/validate-status.json` has an invalid value: '$rawCompletedStep'."
        Write-Error "Action: Set completedStep to a valid value, or 'None' to start over."
        exit 2
    }
}

# Step 1: Load Plan
# Instruct the agent to load the deployment plan, then advance completedStep to `LoadPlan` and re-run this script.
if ($completedStep -eq [ValidationStep]::None) {
    Write-Output "Action: Read `.azure/deployment-plan.md` for recipe and configuration. If missing, run azure-prepare first, then come back to workflow.ps1."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `LoadPlan`, and re-run workflow.ps1."
    Write-Output "Reference: `.azure/deployment-plan.md"
    exit 0
}

# Step 2: Add Validation Steps
# Once the plan is loaded, instruct the agent to copy the recipe's "Validation Steps" into the plan,
# then advance completedStep to `AddValidationSteps` and re-run this script.
if ($completedStep -eq [ValidationStep]::LoadPlan) {
    Write-Output "Action: Copy the recipe's `Validation Steps` into `.azure/deployment-plan.md` as children of `All validation checks pass`."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `AddValidationSteps`, and re-run workflow.ps1."
    Write-Output "Reference: references/recipes/README.md, `.azure/deployment-plan.md"
    exit 0
}

# Step 3: Run Validation
# With the validation steps recorded, instruct the agent to execute the recipe-specific validation commands,
# then advance completedStep to `RunValidation` and re-run this script.
if ($completedStep -eq [ValidationStep]::AddValidationSteps) {
    Write-Output "Action: Execute the recipe-specific validation commands."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `RunValidation`, and re-run workflow.ps1."
    Write-Output "Reference: references/recipes/README.md"
    exit 0
}

# Step 4: Build Verification
# With validation run, instruct the agent to build the project and fix any errors,
# then advance completedStep to `BuildVerification` and re-run this script.
if ($completedStep -eq [ValidationStep]::RunValidation) {
    Write-Output "Action: Build the project and fix any errors before proceeding."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `BuildVerification`, and re-run workflow.ps1."
    Write-Output "Reference: See the recipe for build details."
    exit 0
}

# Step 5: Static Role Verification
# With the build verified, instruct the agent to review the Bicep/Terraform for correct RBAC role assignments,
# then advance completedStep to `StaticRoleVerification` and re-run this script.
if ($completedStep -eq [ValidationStep]::BuildVerification) {
    Write-Output "Action: Review the Bicep/Terraform for correct RBAC role assignments in code."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `StaticRoleVerification`, and re-run workflow.ps1."
    Write-Output "Reference: references/role-verification.md"
    exit 0
}

# Step 6: Record Proof
# With roles verified, instruct the agent to record validation proof in the plan,
# then advance completedStep to `RecordProof` and re-run this script.
if ($completedStep -eq [ValidationStep]::StaticRoleVerification) {
    Write-Output "Action: Populate **Section 7: Validation Proof** in the plan with the commands run and their results."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `RecordProof`, and re-run workflow.ps1."
    Write-Output "Reference: `.azure/deployment-plan.md"
    exit 0
}

# Step 7: Resolve Errors
# With proof recorded, instruct the agent to fix any failures before proceeding,
# then advance completedStep to `ResolveErrors` and re-run this script.
if ($completedStep -eq [ValidationStep]::RecordProof) {
    Write-Output "Action: Fix any validation failures before proceeding."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `ResolveErrors`, and re-run workflow.ps1."
    Write-Output "Reference: See the recipe's errors.md."
    exit 0
}

# Step 8: Update Status
# Only after ALL checks pass, instruct the agent to set the plan status to `Validated`,
# then advance completedStep to `UpdateStatus` and re-run this script.
if ($completedStep -eq [ValidationStep]::ResolveErrors) {
    Write-Output "Action: Only after ALL checks pass, set the plan status to `Validated`."
    Write-Output "Then set the completedStep property in `.azure/validate-status.json` to `UpdateStatus`, and re-run workflow.ps1."
    Write-Output "Reference: `.azure/deployment-plan.md"
    exit 0
}

# Step 9: Deploy
# With status updated, deploy only if the user explicitly asked to deploy; otherwise stop and report results.
# Then advance completedStep to `Deploy` and re-run this script.
if ($completedStep -eq [ValidationStep]::UpdateStatus -or $completedStep -eq [ValidationStep]::Deploy) {
    # Set the completedStep to Deploy 
    $completedStep = [ValidationStep]::Deploy
    $validateStatus.completedStep = $completedStep.ToString()
    $validateStatus | ConvertTo-Json | Set-Content -Path $validateStatusPath
    
    Write-Output "Action: The azure-validate workflow is complete. If the user explicitly requested deployment, invoke azure-deploy. Otherwise STOP and report the validation results."
    
    exit 0
}






