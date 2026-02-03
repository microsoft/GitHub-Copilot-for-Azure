<#
.SYNOPSIS
    Cleans up all SWA test deployments.

.DESCRIPTION
    Removes all Azure resources created by test-swa-patterns.ps1.
#>

$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$tests = @(
    @{ Name = "01-static-root"; EnvName = "swa-test-01" },
    @{ Name = "02-framework-root"; EnvName = "swa-test-02" },
    @{ Name = "03-static-subfolder"; EnvName = "swa-test-03" },
    @{ Name = "04-framework-subfolder"; EnvName = "swa-test-04" }
)

Write-Host "`n🧹 Cleaning up SWA test deployments...`n" -ForegroundColor Yellow

foreach ($test in $tests) {
    $testPath = Join-Path $scriptDir $test.Name
    $envPath = Join-Path $testPath ".azure" $test.EnvName
    
    if (Test-Path $envPath) {
        Write-Host "  Removing $($test.Name)..." -ForegroundColor Gray
        Push-Location $testPath
        azd down --force --purge --no-prompt 2>&1 | Out-Null
        Pop-Location
        Write-Host "  ✅ $($test.Name) removed" -ForegroundColor Green
    }
    else {
        Write-Host "  ⏭️ $($test.Name) not deployed, skipping" -ForegroundColor Gray
    }
}

Write-Host "`n✅ Cleanup complete!`n" -ForegroundColor Green
