<#
.SYNOPSIS
  Discover catalog inputs for a Foundry-managed OAuth (catalog_MCP) MCP connection,
  and classify which matching connectors actually use MANAGED OAuth.

.DESCRIPTION
  For each match prints:
    - toolEntityId    -> azd ai connection create --metadata toolEntityId=...
    - connectorName   -> azd ai connection create --connector-name ... (objectId segment)
    - serverUrl       -> azd ai connection create --target ...   (best-effort; see note)
    - managedOAuth    -> true when the connector exposes an OAuth app Foundry can broker
    - identityProvider / scopes -> the OAuth provider + default scopes (managed only)

  Queries both the public catalog (connectors-registry-prod-bl) and the private
  MCP registry (registry-prod-bl). Catalog lives only in eastus.

  HOW MANAGED OAUTH IS DETECTED (mirrors the portal): the thin asset-gallery
  search index carries no auth metadata, so it is read from the Logic Apps
  managedApis GET — the same source the portal's deriveConnectorSecuritySchemes()
  uses. A connector is managed-OAuth when its connectionParameters has an entry
  of type "oauthSetting"; that entry also yields identityProvider + scopes.

  NOTE on serverUrl: remotes[].url is often null in the index (verified for
  github). When empty, supply the connector's documented MCP endpoint as
  --target (e.g. github Copilot -> https://api.githubcopilot.com/mcp).

.EXAMPLE
  ./get-catalog-inputs.ps1 github
  ./get-catalog-inputs.ps1 github -ManagedOnly

.NOTES
  Requires: Az CLI (logged in). Uses an ARM bearer token.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Name,
  [switch] $ManagedOnly
)

$ErrorActionPreference = 'Stop'
$gallery = 'https://eastus.api.azureml.ms/asset-gallery/v1.0/tools'
$token = az account get-access-token --resource 'https://management.azure.com' --query accessToken -o tsv
$sub = az account show --query id -o tsv
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

function Get-Registry([string] $Container) {
  $body = @{
    freeTextSearch = '*'
    filters        = @(
      @{ field = 'entityContainerId'; operator = 'eq';       values = @($Container) },
      @{ field = 'type';              operator = 'eq';       values = @('tools') },
      @{ field = 'annotations/name';  operator = 'contains'; values = @($Name) }
    )
    pageSize       = 20
  } | ConvertTo-Json -Depth 6
  # Invoke-WebRequest + ConvertFrom-Json is more reliable than Invoke-RestMethod
  # here: the deeply-nested catalog payload can bind `.value` to $null under IRM.
  # -AsHashtable is required — the payload has a property with an empty-string name.
  $resp = Invoke-WebRequest -Method Post -Uri $gallery -Headers $headers `
    -ContentType 'application/json' -Body $body -UseBasicParsing
  ($resp.Content | ConvertFrom-Json -Depth 40 -AsHashtable)['value']
}

# managedApis GET for one connector -> [pscustomobject]{ managed; identityProvider; scopes }
function Get-ConnectorOAuth([string] $Connector) {
  $uri = "https://management.azure.com/subscriptions/$sub/providers/Microsoft.Web/locations/eastus/managedApis/$Connector`?api-version=2016-06-01"
  try {
    $resp = Invoke-WebRequest -Method Get -Uri $uri -Headers $headers -UseBasicParsing
    $cp = ($resp.Content | ConvertFrom-Json -Depth 40 -AsHashtable)['properties']['connectionParameters']
  } catch {
    return [pscustomobject]@{ managed = $false; identityProvider = ''; scopes = '' }
  }
  if ($cp) {
    foreach ($v in $cp.Values) {
      if ($v['type'] -eq 'oauthSetting') {
        $s = $v['oAuthSettings']
        return [pscustomobject]@{
          managed          = $true
          identityProvider = $s['identityProvider']
          scopes           = ($s['scopes'] -join ',')
        }
      }
    }
  }
  [pscustomobject]@{ managed = $false; identityProvider = ''; scopes = '' }
}

Write-Host "# Querying public + private registries for '$Name'..." -ForegroundColor Cyan
$rows = @()
$rows += Get-Registry 'connectors-registry-prod-bl'
$rows += Get-Registry 'registry-prod-bl'

$base = $rows |
  ForEach-Object {
    $entityId = $_['entityId']
    $connector = if ($entityId -match 'objectId/([^/]+)') { $Matches[1] } else { '' }
    $remotes = $_['properties']['remotes']
    [pscustomobject]@{
      name          = if ($_['annotations']['name']) { $_['annotations']['name'] } else { $_['name'] }
      toolEntityId  = $entityId
      connectorName = $connector
      serverUrl     = if ($remotes) { $remotes[0]['url'] } else { '' }
    }
  } |
  Sort-Object toolEntityId -Unique |
  Where-Object connectorName

$count = 0
Write-Host ''
foreach ($row in $base) {
  $oauth = Get-ConnectorOAuth $row.connectorName
  if ($ManagedOnly -and -not $oauth.managed) { continue }
  $count++
  Write-Host ("  name            : {0}" -f $row.name)
  Write-Host ("  connectorName   : {0}" -f $row.connectorName)
  Write-Host ("  toolEntityId    : {0}" -f $row.toolEntityId)
  $url = if ($row.serverUrl) { $row.serverUrl } else { '<empty — use documented MCP URL>' }
  Write-Host ("  serverUrl       : {0}" -f $url)
  Write-Host ("  managedOAuth    : {0}" -f $oauth.managed.ToString().ToLower())
  if ($oauth.managed) {
    Write-Host ("  identityProvider: {0}" -f $oauth.identityProvider)
    $sc = if ($oauth.scopes) { $oauth.scopes } else { '<none>' }
    Write-Host ("  scopes          : {0}" -f $sc)
  }
  Write-Host ''
}
$suffix = if ($ManagedOnly) { ' with managed OAuth' } else { '' }
Write-Host "# $count connector(s)$suffix."

Write-Host @'

# Next: pick a managedOAuth=true row, then create the connection:
#   azd ai connection create <name> `
#     --kind remote-tool --auth-type oauth2 `
#     --target        <serverUrl-or-documented-MCP-URL> `
#     --connector-name <connectorName> `
#     --metadata type=catalog_MCP `
#     --metadata toolEntityId=<toolEntityId> `
#     --project-endpoint "$env:FOUNDRY_PROJECT_ENDPOINT"
'@ -ForegroundColor DarkGray
