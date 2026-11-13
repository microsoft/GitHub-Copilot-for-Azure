Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$names = @("HARBOR_OUTPUT_PATH", "HARBOR_TASK_REPO", "HARBOR_TASK_COMMIT",
    "HARBOR_CONTAINER_REGISTRY",
    "HARBOR_DRY_RUN", "HARBOR_BACKEND", "HARBOR_MODEL", "TF_BUILD",
    "GITHUB_COPILOT_INTEGRATION_ID", "CAPI_HMAC_KEY")
$original = @{}
foreach ($name in $names) { $original[$name] = [Environment]::GetEnvironmentVariable($name) }
$scratch = Join-Path ([IO.Path]::GetTempPath()) ("azure-diagnostics-pipeline-" + [Guid]::NewGuid())

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Assert-Fails([scriptblock]$Action, [string]$Expected) {
    $caught = $null
    try { & $Action } catch { $caught = $_.Exception.Message }
    Assert-True ($null -ne $caught -and $caught.Contains($Expected)) "Expected error containing '$Expected'; got '$caught'."
}
$mock = @{ Arguments = @(); Input = @(); ExitCode = 0; Output = ""; EventLines = @(); Auth = @{} }
$realGit = (Get-Command git -CommandType Application | Select-Object -First 1).Source
$gitMock = @{ MissingTask = $false; DirtyTask = $false; Origin = $null }
# Keep real source identity checks; mock only live-commit readiness, not a remote checkout.
${function:git} = {
    if ($args -contains "cat-file") {
        $global:LASTEXITCODE = [int]$gitMock.MissingTask
    } elseif ($args -contains "status") {
        $global:LASTEXITCODE = 0
        if ($gitMock.DirtyTask) { " M task.toml" }
    } elseif ($args -contains "remote" -and $null -ne $gitMock.Origin) {
        $global:LASTEXITCODE = 0
        $gitMock.Origin
    } else {
        & $realGit @args
    }
}.GetNewClosure()
${function:msbench-cli} = {
    $mock.Input = @($input)
    $mock.Arguments = $args
    foreach ($name in @("GITHUB_COPILOT_INTEGRATION_ID", "CAPI_HMAC_KEY")) {
        $mock.Auth[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
    }
    $global:LASTEXITCODE = $mock.ExitCode
    $eventsIndex = [array]::IndexOf($args, "--events")
    if ($eventsIndex -ge 0 -and $mock.EventLines.Count -gt 0) {
        [IO.File]::WriteAllText([string]$args[$eventsIndex + 1],
            ($mock.EventLines -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
    }
    if ($mock.Output) { $mock.Output }
}.GetNewClosure()

try {
    $env:HARBOR_OUTPUT_PATH = $scratch
    $env:HARBOR_TASK_REPO = "https://github.com/microsoft/GitHub-Copilot-for-Azure.git"
    $env:HARBOR_TASK_COMMIT = & $realGit rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw "Cannot resolve test repository HEAD." }
    $env:HARBOR_CONTAINER_REGISTRY = "example.azurecr.io"
    $env:HARBOR_DRY_RUN = "true"
    $env:HARBOR_BACKEND = "ces-staging"
    $env:HARBOR_MODEL = "test-model"
    $env:TF_BUILD = "False"
    $invoke = Join-Path $PSScriptRoot "Invoke-Smoke.ps1"
    & $invoke -PrepareOnly
    $bytes = [IO.File]::ReadAllBytes((Join-Path $scratch "dataset.jsonl"))
    Assert-True (-not ($bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191)) "JSONL has a BOM."
    $lines = @(Get-Content (Join-Path $scratch "dataset.jsonl"))
    Assert-True ($lines.Count -eq 1) "Expected exactly one dataset row."
    $row = $lines[0] | ConvertFrom-Json
    Assert-True ($row.task_style -eq "harbor-native") "Native routing missing."
    Assert-True ($row.task_repo_commit -eq $env:HARBOR_TASK_COMMIT) "Task source is not pinned."
    Assert-True ($row.task_repo_type -eq "github") "GitHub checkout not selected."
    Assert-True ($row.task_repo -eq "https://github.com/microsoft/GitHub-Copilot-for-Azure") "Wrong task repository."
    Assert-True ($row.task_path -eq "benchmarks/msbench/azure-diagnostics/tasks/container-app-restart-troubleshooting") "Wrong task root."
    Assert-True (@($row.PSObject.Properties.Name | Where-Object { $_ -match '^task_repo_(client_id|tenant_id|auth_type)$' }).Count -eq 0) "ADO checkout identity leaked into GitHub row."
    Assert-True ($row.run_platform -eq "linux_container") "Wrong run platform."

    $env:HARBOR_TASK_COMMIT = "main"
    Assert-Fails { & $invoke -PrepareOnly } "40-character"
    $env:HARBOR_TASK_COMMIT = $row.task_repo_commit
    $env:HARBOR_TASK_COMMIT = '$(Build.SourceVersion)'
    Assert-Fails { & $invoke -PrepareOnly } "required pipeline variable"
    $env:HARBOR_TASK_COMMIT = "0123456789abcdef0123456789abcdef01234567"
    Assert-Fails { & $invoke -PrepareOnly } "checked-out HEAD"
    $env:HARBOR_TASK_COMMIT = $row.task_repo_commit
    $env:HARBOR_TASK_REPO = "https://example.com/tasks"
    Assert-Fails { & $invoke -PrepareOnly } "this GitHub repository"
    $env:HARBOR_TASK_REPO = "https://dev.azure.com/example/project/_git/tasks"
    Assert-Fails { & $invoke -PrepareOnly } "this GitHub repository"
    $env:HARBOR_TASK_REPO = "https://github.com/microsoft/wrong-repository"
    Assert-Fails { & $invoke -PrepareOnly } "this GitHub repository"
    $env:HARBOR_TASK_REPO = "https://example:placeholder@github.com/microsoft/GitHub-Copilot-for-Azure"
    Assert-Fails { & $invoke -PrepareOnly } "must not contain credentials"
    $env:HARBOR_TASK_REPO = "https://github.com/microsoft/GitHub-Copilot-for-Azure?token=placeholder"
    Assert-Fails { & $invoke -PrepareOnly } "must not include a query or fragment"
    $env:HARBOR_TASK_REPO = $row.task_repo
    $gitMock.Origin = "https://github.com/microsoft/wrong-repository.git"
    Assert-Fails { & $invoke -PrepareOnly } "checked-out origin"
    $gitMock.Origin = $null

    $mock.Output = "dry-run resolved"
    $env:GITHUB_COPILOT_INTEGRATION_ID = "local-test-integration"
    $env:CAPI_HMAC_KEY = "local-test-key"
    & $invoke
    Assert-True ($mock.Arguments -contains "--dry-run") "Dry run not forwarded."
    Assert-True (($mock.Input -join "") -eq "n") "Dry run must decline credential forwarding."
    Assert-True ($mock.Arguments -notcontains "--encrypted-env") "Dry run forwards credentials."
    Assert-True ($mock.Arguments -contains "--models-map") "Direct CAPI model map missing."
    Assert-True ($mock.Arguments -notcontains "--index") "An ad-hoc index would trigger model discovery."
    Assert-True ($mock.Arguments -contains "--events") "Structured event output missing."
    Assert-True ($null -eq $mock.Auth.CAPI_HMAC_KEY -and $null -eq $mock.Auth.GITHUB_COPILOT_INTEGRATION_ID) "Dry run inherited CAPI credentials."
    Assert-True ($env:CAPI_HMAC_KEY -eq "local-test-key" -and $env:GITHUB_COPILOT_INTEGRATION_ID -eq "local-test-integration") "Dry run did not restore local environment."
    $effectiveMap = $mock.Arguments[[array]::IndexOf($mock.Arguments, "--models-map") + 1]
    $modelLine = @(Get-Content -LiteralPath $effectiveMap | Where-Object { $_ -cmatch '^models: ' })
    Assert-True ($modelLine.Count -eq 1) "Expected one generated models mapping."
    $profiles = $modelLine[0].Substring("models: ".Length) | ConvertFrom-Json -AsHashtable
    Assert-True ($profiles["test-model"].index -eq "capi-direct" -and $profiles["test-model"].model.id -eq "test-model") "Selected model profile is incorrect."
    $env:HARBOR_MODEL = 'test-model"quoted'
    & $invoke
    $modelLine = @(Get-Content -LiteralPath $effectiveMap | Where-Object { $_ -cmatch '^models: ' })
    $profiles = $modelLine[0].Substring("models: ".Length) | ConvertFrom-Json -AsHashtable
    Assert-True ($profiles[$env:HARBOR_MODEL].model.id -ceq $env:HARBOR_MODEL) "Model ID was not safely serialized."
    $env:HARBOR_MODEL = "test-model"
    $mock.ExitCode = 7
    Assert-Fails { & $invoke } "exit code 7"
    Assert-True ($env:CAPI_HMAC_KEY -eq "local-test-key" -and $env:GITHUB_COPILOT_INTEGRATION_ID -eq "local-test-integration") "Failed dry run did not restore local environment."
    $mock.ExitCode = 0
    Remove-Item -LiteralPath Env:\CAPI_HMAC_KEY, Env:\GITHUB_COPILOT_INTEGRATION_ID
    & $invoke
    Assert-True (-not (Test-Path -LiteralPath Env:\CAPI_HMAC_KEY) -and -not (Test-Path -LiteralPath Env:\GITHUB_COPILOT_INTEGRATION_ID)) "Dry run recreated absent credentials."
    $env:HARBOR_MODEL = "."
    Assert-Fails { & $invoke } "concrete model ID"
    $env:HARBOR_MODEL = "msbench-auto-model"
    Assert-Fails { & $invoke } "concrete model ID"
    $env:HARBOR_MODEL = "model with spaces"
    Assert-Fails { & $invoke } "concrete model ID"
    $env:HARBOR_MODEL = "test-model"
    $env:HARBOR_DRY_RUN = "false"
    $gitMock.MissingTask = $true
    Assert-Fails { & $invoke } "does not contain the Harbor task"
    $gitMock.MissingTask = $false
    $gitMock.DirtyTask = $true
    Assert-Fails { & $invoke } "local task changes"
    $gitMock.DirtyTask = $false
    Assert-Fails { & $invoke } "GITHUB_COPILOT_INTEGRATION_ID"
    $env:GITHUB_COPILOT_INTEGRATION_ID = "offline-test-integration"
    Assert-Fails { & $invoke } "CAPI_HMAC_KEY"
    $env:CAPI_HMAC_KEY = "offline-test-placeholder"
    $mock.Output = "untrusted console text run_id=99999"
    Assert-Fails { & $invoke } "may have submitted a run"
    $firstEventsPath = $mock.Arguments[[array]::IndexOf($mock.Arguments, "--events") + 1]
    $mock.EventLines = @('{"event":"status_snapshot","data":{"run_id":"99999"}}')
    Assert-Fails { & $invoke } "exactly one valid run_id"
    $secondEventsPath = $mock.Arguments[[array]::IndexOf($mock.Arguments, "--events") + 1]
    Assert-True ($firstEventsPath -cne $secondEventsPath) "Event paths must be unique per invocation."
    $mock.EventLines = @("not json")
    Assert-Fails { & $invoke } "event log could not be read"
    $mock.EventLines = @('{"event":"run_started","data":{"run_id":"12345"}}',
        '{"event":"run_started","data":{}}')
    Assert-Fails { & $invoke } "exactly one valid run_id"
    $mock.EventLines = @('{"event":"run_started","data":{"run_id":"0"}}')
    Assert-Fails { & $invoke } "exactly one valid run_id"
    $mock.EventLines = @('{"event":"run_started","data":{"run_id":"12345"}}',
        '{"event":"run_started","data":{"run_id":"67890"}}')
    Assert-Fails { & $invoke } "exactly one valid run_id"
    $mock.ExitCode = 7
    Assert-Fails { & $invoke } "may already have been submitted"
    $mock.ExitCode = 0
    $mock.EventLines = @('{"event":"run_started","data":{"run_id":"12345"}}',
        '{"event":"run_started","data":{"run_id":"12345"}}')
    & $invoke
    Assert-True ($mock.Arguments -contains "--encrypted-env") "Submission credential names not forwarded."
    Assert-True ($mock.Arguments -contains "GITHUB_COPILOT_INTEGRATION_ID") "Integration ID name missing."
    Assert-True ($mock.Arguments -notcontains $env:CAPI_HMAC_KEY) "Credential value appears in CLI arguments."
    Assert-True ($mock.Auth.CAPI_HMAC_KEY -eq "offline-test-placeholder" -and $mock.Auth.GITHUB_COPILOT_INTEGRATION_ID -eq "offline-test-integration") "Submission credentials were not available to the CLI."
    $runIds = Get-Content (Join-Path $scratch "run_ids.json") -Raw | ConvertFrom-Json -NoEnumerate
    Assert-True ($runIds -is [array] -and $runIds.Count -eq 1 -and $runIds[0] -eq "12345") "Run IDs must be a deduplicated JSON array."
    $previousDataset = Get-Content (Join-Path $scratch "dataset.jsonl") -Raw
    Assert-Fails { & $invoke } "clean artifact directory"
    Assert-Fails { & $invoke -PrepareOnly } "clean artifact directory"
    Assert-True ((Get-Content (Join-Path $scratch "dataset.jsonl") -Raw) -ceq $previousDataset) "Stale artifact must not be overwritten."
    $env:HARBOR_OUTPUT_PATH = Join-Path $scratch "invalid-config"
    $env:HARBOR_DRY_RUN = "invalid"
    Assert-Fails { & $invoke } "true or false"
    Write-Host "Pipeline checks passed; CLI was mocked and no run was submitted."
} finally {
    foreach ($name in $names) {
        if ($null -eq $original[$name]) {
            $envPath = "Env:\$name"
            if (Test-Path -LiteralPath $envPath) { Remove-Item -LiteralPath $envPath }
        } else {
            [Environment]::SetEnvironmentVariable($name, $original[$name])
        }
    }
    if (Test-Path -LiteralPath $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
}
