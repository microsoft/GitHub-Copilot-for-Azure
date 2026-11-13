[CmdletBinding()]
param([switch]$PrepareOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RequiredEnvironmentValue([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^\$\(.+\)$') {
        throw "Set the required pipeline variable/environment value '$Name'."
    }
    return $value
}

$outputPath = Get-RequiredEnvironmentValue "HARBOR_OUTPUT_PATH"
$runIdsPath = Join-Path $outputPath "run_ids.json"
if (Test-Path -LiteralPath $runIdsPath) {
    throw "Output path already contains run_ids.json; use a clean artifact directory before submitting."
}
$repo = Get-RequiredEnvironmentValue "HARBOR_TASK_REPO"
$commit = Get-RequiredEnvironmentValue "HARBOR_TASK_COMMIT"
$registry = Get-RequiredEnvironmentValue "HARBOR_CONTAINER_REGISTRY"
try {
    $repoUri = [Uri]::new($repo, [UriKind]::Absolute)
} catch {
    throw "HARBOR_TASK_REPO must be this GitHub repository's HTTPS clone URL."
}
if ($repoUri.Query -or $repoUri.Fragment) {
    throw "HARBOR_TASK_REPO must not include a query or fragment."
}
if ($repoUri.UserInfo) {
    throw "HARBOR_TASK_REPO must not contain credentials."
}
$expectedRepo = "https://github.com/microsoft/GitHub-Copilot-for-Azure"
$repo = $repoUri.AbsoluteUri.TrimEnd("/") -replace '\.git$', ''
if ($repo -ine $expectedRepo) {
    throw "HARBOR_TASK_REPO must be this GitHub repository's HTTPS clone URL: $expectedRepo."
}
$repo = $expectedRepo
if ($commit -cnotmatch '^[0-9a-f]{40}$') {
    throw "HARBOR_TASK_COMMIT must be a full lowercase 40-character commit SHA."
}
if ($registry -notmatch '^[a-z0-9][a-z0-9.-]+\.azurecr\.io$') {
    throw "HARBOR_CONTAINER_REGISTRY must be an approved ACR hostname, not a URL."
}

$repoRoot = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$headCommit = & git -C $repoRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve the checked-out task repository HEAD." }
if ($headCommit -cne $commit) {
    throw "HARBOR_TASK_COMMIT must match the checked-out HEAD ($headCommit), not a different revision."
}
$origin = & git -C $repoRoot remote get-url origin
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve the checked-out task repository origin." }
$origin = $origin.TrimEnd("/") -replace '\.git$', ''
if ($origin -ine $repo) { throw "The checked-out origin must match HARBOR_TASK_REPO." }
$taskPath = "benchmarks/msbench/azure-diagnostics/tasks/container-app-restart-troubleshooting"
$taskRoot = Join-Path $repoRoot $taskPath
foreach ($relativePath in @("task.toml", "instruction.md", "environment/Dockerfile",
                           "environment/skills/azure-diagnostics/SKILL.md",
                           "tests/test.sh", "tests/test.mjs", "tests/_vally/eval.yaml", "solution/solve.sh")) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskRoot $relativePath) -PathType Leaf)) {
        throw "Local Harbor task is incomplete: missing '$relativePath'."
    }
}

$row = [ordered]@{
    benchmark = "azure-diagnostics-harbor-smoke"
    instance_id = "container-app-restart-troubleshooting"
    task_style = "harbor-native"
    run_platform = "linux_container"
    container_registry = $registry
    task_repo_type = "github"
    task_repo = $repo
    task_path = $taskPath
    task_repo_commit = $commit
}
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$datasetPath = Join-Path $outputPath "dataset.jsonl"
[IO.File]::WriteAllText($datasetPath, ($row | ConvertTo-Json -Compress) + "`n",
    [Text.UTF8Encoding]::new($false))
Write-Host "Prepared one Harbor-native instance pinned to $commit."
if ($PrepareOnly) { return }

$dryRunValue = Get-RequiredEnvironmentValue "HARBOR_DRY_RUN"
$dryRun = $false
if (-not [bool]::TryParse($dryRunValue, [ref]$dryRun)) {
    throw "HARBOR_DRY_RUN must be true or false."
}
$backend = Get-RequiredEnvironmentValue "HARBOR_BACKEND"
if ($backend -notin @("ces-staging", "ces-dev1")) {
    throw "HARBOR_BACKEND must be ces-staging or ces-dev1."
}
$model = (Get-RequiredEnvironmentValue "HARBOR_MODEL").Trim()
if ($model -in @(".", "msbench-auto-model") -or $model -match '^-' -or $model -match '\s') {
    throw "HARBOR_MODEL must be a concrete model ID without whitespace."
}
$modelMapTemplate = Join-Path $PSScriptRoot "models.yaml"
if (-not (Test-Path -LiteralPath $modelMapTemplate -PathType Leaf)) {
    throw "Direct CAPI model map not found: '$modelMapTemplate'."
}
$modelMapBase = [IO.File]::ReadAllText($modelMapTemplate).TrimEnd()
if ($modelMapBase -match '(?m)^models\s*:') {
    throw "The model map template must define indexes only; the script adds the selected model."
}
$profiles = @{}
$profiles[$model] = @{ index = "capi-direct"; model = @{ id = $model } }
$profileJson = ConvertTo-Json -InputObject $profiles -Depth 4 -Compress
$modelMap = Join-Path $outputPath "models.yaml"
[IO.File]::WriteAllText($modelMap, "$modelMapBase`nmodels: $profileJson`n",
    [Text.UTF8Encoding]::new($false))
$eventsPath = Join-Path $outputPath ("events-" + [Guid]::NewGuid().ToString("N") + ".jsonl")
$runArgs = @("run", "--agent", "github-copilot-cli", "--benchmark", $row.benchmark,
    "--dataset", $datasetPath, "--model", $model, "--models-map", $modelMap,
    "--backend", $backend, "--workers", "1", "--no-wait", "--confirm", "--events", $eventsPath)
$authNames = @("GITHUB_COPILOT_INTEGRATION_ID", "CAPI_HMAC_KEY")
if ($dryRun) {
    $runArgs += "--dry-run"
} else {
    # A worker retrieves the commit, never the submitter's working directory.
    & git -C $repoRoot cat-file -e "${commit}:$taskPath/task.toml"
    if ($LASTEXITCODE -ne 0) {
        throw "Commit $commit does not contain the Harbor task. Commit and publish the task before live submission."
    }
    $taskChanges = & git -C $repoRoot status --porcelain --untracked-files=all -- $taskPath
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect local task changes." }
    if ($taskChanges) { throw "Commit and publish local task changes before live submission." }
    foreach ($name in $authNames) {
        $value = Get-RequiredEnvironmentValue $name
        if ($env:TF_BUILD -eq "True") { Write-Host "##vso[task.setsecret]$value" }
    }
    $runArgs += @("--encrypted-env") + $authNames
}

$savedAuth = @{}
try {
    if ($dryRun) {
        foreach ($name in $authNames) {
            $savedAuth[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
            $envPath = "Env:\$name"
            if (Test-Path -LiteralPath $envPath) { Remove-Item -LiteralPath $envPath }
        }
    }
    # Direct CAPI profiles can prompt for missing forwarding even in a dry run.
    $forwardingResponse = if ($dryRun) { "n" } else { "" }
    $commandOutput = $forwardingResponse | & msbench-cli @runArgs 2>&1
    $exitCode = $LASTEXITCODE
} finally {
    if ($dryRun) {
        foreach ($name in $savedAuth.Keys) {
            if ($null -eq $savedAuth[$name]) {
                $envPath = "Env:\$name"
                if (Test-Path -LiteralPath $envPath) { Remove-Item -LiteralPath $envPath }
            } else {
                [Environment]::SetEnvironmentVariable($name, $savedAuth[$name], "Process")
            }
        }
    }
}
$commandOutput | Tee-Object -FilePath (Join-Path $outputPath "submission.log") | ForEach-Object { Write-Host $_ }
if ($exitCode -ne 0) {
    if ($dryRun) { throw "msbench-cli dry run failed with exit code $exitCode." }
    throw "msbench-cli run failed with exit code $exitCode; a run may already have been submitted. Inspect '$eventsPath' and submission.log before retrying."
}
if ($dryRun) {
    Write-Host "Dry run only: no remote benchmark was submitted."
    return
}
try {
    $runIds = @(foreach ($line in Get-Content -LiteralPath $eventsPath) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $event = ConvertFrom-Json -InputObject $line -AsHashtable
        if ($event -is [System.Collections.IDictionary] -and $event["event"] -eq "run_started") {
            $data = $event["data"]
            if ($data -is [System.Collections.IDictionary] -and $null -ne $data["run_id"]) {
                [string]$data["run_id"]
            } else {
                ""
            }
        }
    })
} catch {
    throw "MSBench may have submitted a run, but its event log could not be read. Inspect '$eventsPath' and submission.log before retrying."
}
$runIds = @($runIds | Select-Object -Unique)
if ($runIds.Count -ne 1 -or $runIds[0] -notmatch '^[1-9]\d*$') {
    throw "MSBench may have submitted a run, but its event log did not contain exactly one valid run_id. Inspect '$eventsPath' and submission.log before retrying."
}
[IO.File]::WriteAllText($runIdsPath,
    (ConvertTo-Json -InputObject $runIds -Compress) + "`n", [Text.UTF8Encoding]::new($false))
if ($env:TF_BUILD -eq "True") {
    Write-Host "##vso[task.setvariable variable=RUN_IDS;isoutput=true]$($runIds -join ',')"
}
Write-Host "Submitted run IDs: $($runIds -join ','). Submission is not a test-result gate."
