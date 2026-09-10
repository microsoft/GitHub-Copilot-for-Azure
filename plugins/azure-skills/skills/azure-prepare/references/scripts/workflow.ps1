<#
.SYNOPSIS
    Walks the agent through the azure-prepare workflow, one step at a time.
.DESCRIPTION
    Exit codes:
      0 = success
      1 = workflow check failed
      2 = usage or argument error
.PARAMETER WorkspacePath
    Path to the workspace being prepared (required).
.PARAMETER CompletedStep
    The workflow step the agent just completed. Omit this on the first call to
    start the workflow. The script records the value in
    .azure/prepare-status.json and returns the next action to take, along with
    the value to pass as -CompletedStep on the next call.
#>
param(
    [string]$WorkspacePath,
    [string]$CompletedStep
)

enum PrepareStep {
    None
    CreatePlanSkeleton
    SpecializedTechnologyCheck
    AnalyzeWorkspace
    GatherRequirements
    ScanCodebase
    SelectRecipe
    PlanArchitecture
    FinalizePlan
    ApprovePlan
    ResearchComponents
    ConfirmAzureContext
    GenerateArtifacts
    HardenSecurity
    FunctionalVerification
    UpdateStatus
}

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
    Write-Error "WorkspacePath is required."
    exit 2
}

if (-not (Test-Path -Path $WorkspacePath -PathType Container)) {
    Write-Error "Error: WorkspacePath '$WorkspacePath' does not exist or is not a directory."
    exit 2
}

# Resolve the step the agent just completed.
# Omitting -CompletedStep signals the start of the workflow (None).
$step = [PrepareStep]::None
if (-not [string]::IsNullOrWhiteSpace($CompletedStep)) {
    if (-not [enum]::TryParse([PrepareStep], $CompletedStep, $true, [ref]$step)) {
        $validValues = ([enum]::GetNames([PrepareStep])) -join ", "
        Write-Error "Error: '-CompletedStep $CompletedStep' is not a valid step. Valid values: $validValues"
        exit 2
    }
}

# Record progress in .azure/prepare-status.json (creating it if needed).
$azureDir = Join-Path -Path $WorkspacePath -ChildPath ".azure"
if (-not (Test-Path -Path $azureDir)) {
    New-Item -ItemType Directory -Path $azureDir | Out-Null
}
$prepareStatusPath = Join-Path -Path $azureDir -ChildPath "prepare-status.json"
$prepareStatusJson = @{ completedStep = $step.ToString() } | ConvertTo-Json
[System.IO.File]::WriteAllText($prepareStatusPath, $prepareStatusJson + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))

# Emit the next action based on the step just completed.

# Plan-first prerequisite
if ($step -eq [PrepareStep]::None) {
    Write-Output 'Action: Read `references/plan-template.md`. Create the initial `.azure/deployment-plan.md` skeleton in the workspace root before generating code, infrastructure, or configuration.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep CreatePlanSkeleton after completing the action."
    exit 0
}

# Step 0: Specialized Technology Check
if ($step -eq [PrepareStep]::CreatePlanSkeleton) {
    Write-Output 'Action: Read `references/specialized-routing.md`. Check the prompt and workspace for specialized technologies. Invoke a matching specialized skill first when required.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep SpecializedTechnologyCheck after completing the action."
    exit 0
}

# Phase 1, Step 1: Analyze Workspace
if ($step -eq [PrepareStep]::SpecializedTechnologyCheck) {
    Write-Output 'Action: Read `references/analyze.md`. Analyze the workspace and determine whether the mode is NEW, MODIFY, or MODERNIZE.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep AnalyzeWorkspace after completing the action."
    exit 0
}

# Phase 1, Step 2: Gather Requirements
if ($step -eq [PrepareStep]::AnalyzeWorkspace) {
    Write-Output 'Action: Read `references/requirements.md`. Gather the workload classification, scale, and budget requirements.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep GatherRequirements after completing the action."
    exit 0
}

# Phase 1, Step 3: Scan Codebase
if ($step -eq [PrepareStep]::GatherRequirements) {
    Write-Output 'Action: Read `references/scan.md`. Scan the codebase to identify components, technologies, and dependencies.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep ScanCodebase after completing the action."
    exit 0
}

# Phase 1, Step 4: Select Recipe
if ($step -eq [PrepareStep]::ScanCodebase) {
    Write-Output 'Action: Read `references/recipe-selection.md`. Select the appropriate AZD, AZCLI, Bicep, or Terraform recipe.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep SelectRecipe after completing the action."
    exit 0
}

# Phase 1, Step 5: Plan Architecture
if ($step -eq [PrepareStep]::SelectRecipe) {
    Write-Output 'Action: Read `references/architecture.md`. Select the application stack and map each component to Azure services.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep PlanArchitecture after completing the action."
    exit 0
}

# Phase 1, Step 6: Finalize Plan
if ($step -eq [PrepareStep]::PlanArchitecture) {
    Write-Output 'Action: Read `references/plan-template.md`. Finalize `.azure/deployment-plan.md` with all decisions from the planning phase.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep FinalizePlan after completing the action."
    exit 0
}

# Phase 1, Step 7: Present Plan and Get Approval
if ($step -eq [PrepareStep]::FinalizePlan) {
    Write-Output 'Action: Read `.azure/deployment-plan.md`. Present the completed deployment plan and get explicit user approval before executing it. If the user requests changes, revise and present the plan again.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep ApprovePlan only after the user approves the plan."
    exit 0
}

# Phase 2, Step 1: Research Components
if ($step -eq [PrepareStep]::ApprovePlan) {
    Write-Output 'Action: Read `references/research.md`. Research the approved components by loading service references and invoking related skills.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep ResearchComponents after completing the action."
    exit 0
}

# Phase 2, Step 2: Confirm Azure Context
if ($step -eq [PrepareStep]::ResearchComponents) {
    Write-Output 'Action: Read `references/azure-context.md`. Detect and confirm the Azure subscription and location with the user, then check the resource provisioning limit.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep ConfirmAzureContext after completing the action."
    exit 0
}

# Phase 2, Step 3: Generate Artifacts
if ($step -eq [PrepareStep]::ConfirmAzureContext) {
    Write-Output 'Action: Read `references/generate.md`. Generate the approved infrastructure and configuration artifacts.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep GenerateArtifacts after completing the action."
    exit 0
}

# Phase 2, Step 4: Harden Security
if ($step -eq [PrepareStep]::GenerateArtifacts) {
    Write-Output 'Action: Read `references/security.md`. Apply the required security best practices to the generated artifacts.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep HardenSecurity after completing the action."
    exit 0
}

# Phase 2, Step 5: Functional Verification
if ($step -eq [PrepareStep]::HardenSecurity) {
    Write-Output 'Action: Read `references/functional-verification.md`. Verify that the application UI and backend work locally, when possible.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep FunctionalVerification after completing the action."
    exit 0
}

# Phase 2, Step 6: Update Status
if ($step -eq [PrepareStep]::FunctionalVerification) {
    Write-Output 'Action: Read `.azure/deployment-plan.md`. Update its status to `Ready for Validation`.'
    Write-Output "Next: re-run workflow.ps1 with -CompletedStep UpdateStatus after completing the action."
    exit 0
}

# Phase 2, Step 7: Validation handoff (workflow complete)
if ($step -eq [PrepareStep]::UpdateStatus) {
    Write-Output "Action: The azure-prepare workflow is complete. Invoke azure-validate. Do not run deployment commands directly."
    exit 0
}
