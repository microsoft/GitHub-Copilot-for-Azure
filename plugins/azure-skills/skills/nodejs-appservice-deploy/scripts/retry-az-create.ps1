<#
.SYNOPSIS
    Wraps an idempotent `az ... show || az ... create` pair with silent
    retries against transient ARM frontend errors.
.DESCRIPTION
    Mirrors retry-az-create.sh. Runs the show command first (short-circuits
    a partially-succeeded prior attempt and avoids false NameAlreadyExists
    errors). If show fails, runs create. On transient failure (connection
    resets, 429/502/503/504, timeouts) retries up to 2 times with 5s then
    15s backoff. Non-transient failures surface the original error and
    exit 1.
.PARAMETER ShowArguments
    Arguments for az show, passed directly without shell evaluation.
.PARAMETER CreateArguments
    Arguments for az create, passed directly without shell evaluation.
.EXAMPLE
    .\retry-az-create.ps1 `
        -ShowArguments @('group','show','-n','my-rg','--only-show-errors') `
        -CreateArguments @('group','create','-n','my-rg','-l','eastus2')
.EXAMPLE
    .\retry-az-create.ps1 `
        -ShowArguments @('appservice','plan','show','-n','my-plan','-g','my-rg') `
        -CreateArguments @('appservice','plan','create','-n','my-plan','-g','my-rg','--is-linux','--sku','P0v3','-l','eastus2')
.NOTES
    Exit codes: 0 = success, 1 = command failure, 2 = invalid arguments.
#>
param(
    [string[]]$ShowArguments,
    [string[]]$CreateArguments
)

if (-not $ShowArguments -or -not $CreateArguments) {
    Write-Error "Usage: .\retry-az-create.ps1 -ShowArguments <array> -CreateArguments <array>"
    exit 2
}

$transient = 'Connection reset|Connection aborted|ConnectionError|Read timed out|BadGatewayConnection|ServiceUnavailable|Max retries exceeded|TooManyRequests|\b429\b|\b50[234]\b'
$nonRetryable = 'AuthorizationFailed|SubscriptionNotFound|ResourceGroupNotFound|InvalidTemplateDeployment|SkuNotAvailable|QuotaExceeded|BadRequest|Forbidden|Unauthorized|\b(HTTP(/[0-9.]+)?|status( code)?)[: =]+4([01][0-9]|2[0-8]|[3-9][0-9])\b'
$backoff = @(5, 15)

for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
        $null = & az @ShowArguments -o none 2>$null
        if ($LASTEXITCODE -eq 0) { exit 0 }
        $err = & az @CreateArguments -o none 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    } catch {
        Write-Error $_
        exit 1
    }

    if ($exitCode -eq 0) {
        exit 0
    }

    if ($err -match $nonRetryable -or $err -notmatch $transient) {
        Write-Error $err
        exit 1
    }

    if ($attempt -eq 3) {
        Write-Error $err
        Write-Error "ARM frontend is returning transient errors - please retry in a few minutes."
        exit 1
    }

    Start-Sleep -Seconds $backoff[$attempt - 1]
}
