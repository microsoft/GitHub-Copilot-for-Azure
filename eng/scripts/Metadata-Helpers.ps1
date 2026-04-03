# Taken from https://github.com/Azure/azure-sdk-tools/blob/main/eng/common/scripts/Helpers/Metadata-Helpers.ps1

# Obtains a short-lived Bearer token from AAD using client credentials.
# Required because the open-source management portal API and other internal
# APIs are protected by AAD and will reject calls without a valid token.
function Generate-AadToken ($TenantId, $ClientId, $ClientSecret)
{
    $LoginAPIBaseURI = "https://login.microsoftonline.com/$TenantId/oauth2/token"

    $headers = @{
        "content-type" = "application/x-www-form-urlencoded"
    }

    # This is aad scope of opensource rest API.
    $body = @{
        "grant_type" = "client_credentials"
        "client_id" = $ClientId
        "client_secret" = $ClientSecret
        "resource" = "api://2efaf292-00a0-426c-ba7d-f5d2b214b8fc" # ResourceID for opensource management portal API https://github.com/Azure/azure-sdk-tools/commit/1716bb62d436b898a77095082ae2dea531093f8a
    }
    Write-Host "Generating aad token..."
    $resp = Invoke-RestMethod $LoginAPIBaseURI -Method 'POST' -Headers $headers -Body $body
    return $resp.access_token
}

# Retrieves the full list of Microsoft employee-to-GitHub alias mappings from the
# 1ES open-source management portal. Used to correlate internal identities with
# GitHub users (e.g. for PR attribution, compliance checks, or release metadata).
function GetAllGithubUsers ([string]$TenantId, [string]$ClientId, [string]$ClientSecret, [string]$Token)
{
    # API documentation: https://github.com/1ES-microsoft/opensource-management-portal/blob/trunk/docs/microsoft.api.md
    $OpensourceAPIBaseURI = "https://repos.opensource.microsoft.com/api/people/links"

    $Headers = @{
        "Content-Type" = "application/json"
        "api-version" = "2019-10-01"
    }

    try {
        if (!$Token) {
          $Token = Generate-AadToken -TenantId $TenantId -ClientId $ClientId -ClientSecret $ClientSecret
        }
        $Headers["Authorization"] = "Bearer $Token"
        Write-Host "Fetching all github alias links"
        $resp = Invoke-RestMethod $OpensourceAPIBaseURI -Method 'GET' -Headers $Headers -MaximumRetryCount 3
    } catch {
        Write-Warning $_
        return $null
    }

    return $resp
}

