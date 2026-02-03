<#
.SYNOPSIS
    Tests all SWA deployment patterns and generates a report with URLs.

.DESCRIPTION
    Deploys 4 different SWA configurations to validate the documented patterns:
    1. Static files in root (with public/ folder)
    2. Framework app in root (Vite)
    3. Static files in subfolder
    4. Framework app in subfolder (Vite)

.PARAMETER SubscriptionId
    Azure subscription ID to deploy to.

.PARAMETER Location
    Azure region (default: westus2).

.PARAMETER SkipDeploy
    Skip deployment and just generate report from existing deployments.

.EXAMPLE
    .\test-swa-patterns.ps1 -SubscriptionId "your-sub-id"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [string]$Location = "westus2",
    
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$tests = @(
    @{
        Name = "01-static-root"
        EnvName = "swa-test-01"
        Pattern = "Static files in root"
        Config = "project: ., dist: public"
        Path = Join-Path $scriptDir "01-static-root"
        ExpectedContent = "Static.*root"
    },
    @{
        Name = "02-framework-root"
        EnvName = "swa-test-02"
        Pattern = "Framework app in root"
        Config = "project: ., language: js, dist: dist"
        Path = Join-Path $scriptDir "02-framework-root"
        ExpectedContent = "Framework.*root"
    },
    @{
        Name = "03-static-subfolder"
        EnvName = "swa-test-03"
        Pattern = "Static files in subfolder"
        Config = "project: ./src/web, dist: ."
        Path = Join-Path $scriptDir "03-static-subfolder"
        ExpectedContent = "Static.*subfolder"
    },
    @{
        Name = "04-framework-subfolder"
        EnvName = "swa-test-04"
        Pattern = "Framework app in subfolder"
        Config = "project: ./src/web, language: js, dist: dist"
        Path = Join-Path $scriptDir "04-framework-subfolder"
        ExpectedContent = "Framework.*subfolder"
    }
)

$results = @()

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SWA Deployment Pattern Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if (-not $SkipDeploy) {
    foreach ($test in $tests) {
        Write-Host "`n[$($test.Name)] Deploying: $($test.Pattern)" -ForegroundColor Yellow
        Write-Host "  Config: $($test.Config)" -ForegroundColor Gray
        
        Push-Location $test.Path
        try {
            # Clean up old env if exists
            if (Test-Path ".azure") {
                Remove-Item -Recurse -Force ".azure" -ErrorAction SilentlyContinue
            }
            
            # Install npm dependencies for framework projects
            if ($test.Name -match "framework") {
                $packageJsonPath = if ($test.Name -match "subfolder") { "src/web/package.json" } else { "package.json" }
                if (Test-Path $packageJsonPath) {
                    $npmDir = Split-Path $packageJsonPath -Parent
                    if ($npmDir -eq "") { $npmDir = "." }
                    Write-Host "  Installing npm dependencies in $npmDir..." -ForegroundColor Gray
                    Push-Location $npmDir
                    npm install --quiet 2>&1 | Out-Null
                    Pop-Location
                }
            }
            
            # Set up azd environment
            azd env new $test.EnvName --no-prompt 2>&1 | Out-Null
            azd env set AZURE_LOCATION $Location 2>&1 | Out-Null
            azd env set AZURE_SUBSCRIPTION_ID $SubscriptionId 2>&1 | Out-Null
            
            # Deploy
            Write-Host "  Deploying..." -ForegroundColor Gray
            $output = azd up --no-prompt 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Deployment succeeded" -ForegroundColor Green
            } else {
                Write-Host "  ❌ Deployment failed" -ForegroundColor Red
                Write-Host $output
            }
        }
        catch {
            Write-Host "  ❌ Error: $_" -ForegroundColor Red
        }
        finally {
            Pop-Location
        }
    }
}

# Generate report
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT REPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

foreach ($test in $tests) {
    Push-Location $test.Path
    try {
        # Check if .azure folder exists
        if (-not (Test-Path ".azure")) {
            $results += [PSCustomObject]@{
                Test = $test.Name
                Pattern = $test.Pattern
                URL = "Not deployed"
                Status = "❌ No env"
                Content = "N/A"
            }
            Pop-Location
            continue
        }
        
        $url = $null
        $envValues = azd env get-values 2>&1 | Out-String
        if ($envValues -match 'WEB_URI="(https://[^"]+)"') {
            $url = $Matches[1]
        }
        
        if (-not $url) {
            $results += [PSCustomObject]@{
                Test = $test.Name
                Pattern = $test.Pattern
                URL = "No URL found"
                Status = "❌ Not deployed"
                Content = "N/A"
            }
            Pop-Location
            continue
        }
        
        # Test if site is responding with retries
        $maxRetries = 3
        $retryCount = 0
        $status = "❌ Failed"
        $contentStatus = "❌ Not verified"
        
        while ($retryCount -lt $maxRetries) {
            try {
                Start-Sleep -Seconds 2
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
                
                if ($response.StatusCode -eq 200) {
                    $status = "✅ 200 OK"
                    
                    # Check content
                    if ($response.Content -match $test.ExpectedContent) {
                        $contentStatus = "✅ Content verified"
                    } elseif ($response.Content -match "Congratulations") {
                        $contentStatus = "⚠️ Azure default page (still deploying?)"
                    } else {
                        $contentStatus = "⚠️ Unexpected content"
                    }
                    break
                } else {
                    $status = "⚠️ HTTP $($response.StatusCode)"
                }
            }
            catch {
                $status = "❌ $($_.Exception.Message -replace '.*\s(\d+)\s.*','$1')"
                if ($_ -match "404") {
                    $status = "❌ 404 Not Found"
                }
            }
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Host "  Retrying $($test.Name)..." -ForegroundColor Gray
                Start-Sleep -Seconds 5
            }
        }
        
        $results += [PSCustomObject]@{
            Test = $test.Name
            Pattern = $test.Pattern
            URL = $url
            Status = $status
            Content = $contentStatus
        }
        Pop-Location
    }
    catch {
        Pop-Location
    }
}

# Display results
Write-Host ""
$results | Format-Table -Property Test, Pattern, Status, Content -AutoSize
Write-Host ""

Write-Host "📋 URLs for manual testing:`n" -ForegroundColor Cyan
foreach ($r in $results) {
    $statusIcon = if ($r.Status -match "✅") { "✅" } elseif ($r.Status -match "⚠️") { "⚠️" } else { "❌" }
    if ($r.URL -notmatch "Not deployed|No URL") {
        Write-Host "  $statusIcon $($r.Test): $($r.URL)" -ForegroundColor White
    } else {
        Write-Host "  ❌ $($r.Test): $($r.URL)" -ForegroundColor Red
    }
}

# Summary
$passed = ($results | Where-Object { $_.Status -match "✅" -and $_.Content -match "✅" }).Count
$total = $results.Count
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SUMMARY: $passed/$total tests passed" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan

if ($passed -ne $total) {
    Write-Host "`n⚠️  Some tests need attention. Check URLs above.`n" -ForegroundColor Yellow
}

Write-Host "`nTo clean up all resources, run:" -ForegroundColor Gray
Write-Host "  .\cleanup-swa-tests.ps1`n" -ForegroundColor White
