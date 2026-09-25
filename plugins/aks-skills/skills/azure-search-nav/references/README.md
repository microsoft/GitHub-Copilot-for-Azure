# Invoke-PortalSearchNav.ps1 — Reference

## Prerequisites

```powershell
Install-Module Az.Accounts -Scope CurrentUser
```

## Usage

```powershell
./references/Invoke-PortalSearchNav.ps1 `
  -ResourceUrl 'https://portal.azure.com/#@<tenant>/resource/subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.ContainerService/managedClusters/<cluster>/overview' `
  -Query 'image cleaner'
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-ResourceUrl` | Yes | — | Portal URL or bare ARM resource ID |
| `-Query` | Yes | — | Natural-language search query |
| `-ArmProvider` | No | auto-derived | Override the `armProvider` filter value |
| `-AppTenantId` | No | auto-derived | Override the `App-Tenant-Id` header |
| `-Locale` | No | `en.en-us` | Locale for the search filter |
| `-ApiUrl` | No | production endpoint | Override the API endpoint |
| `-TokenResourceUrl` | No | `https://management.azure.com/` | Entra token audience |
| `-UseDeviceAuthentication` | No | `$false` | Use device-code authentication when a browser window cannot be opened |
| `-Raw` | No | `$false` | Print raw JSON response only |

## How It Works

1. **Parse** — Extracts the ARM resource ID, subscription, provider, and tenant from `-ResourceUrl`.
2. **Validate** — Looks up the resource type in `resource-types.json` to normalise `armProvider` casing and confirm the type is supported.
3. **Authenticate** — Calls `Connect-AzAccount` (browser sign-in), then `Get-AzAccessToken`. The token's `tid` claim is used as the `App-Tenant-Id` header so the API's APIM issuer check passes.
4. **Search** — POSTs to the `aks-search-direct-mid` endpoint:
   ```json
   {
     "search": "<query>",
     "count": "true",
     "filter": "armProvider eq '<armProvider>' and locale eq '<locale>'",
     "queryType": "semantic",
     "semanticConfiguration": "semantic"
   }
   ```
   Headers: `Authorization`, `App-Tenant-Id`, `User-Data-Boundary: Global`, `Origin`, `Referer`.
5. **Extract** — Recursively scans the response for `menuId` / `bladeName` / `blade` properties.
6. **Build link** — Replaces the trailing blade segment of the input URL with each discovered `menuId`.

## Enabled Resource Types

The search service is enabled for these ARM resource types:

### Microsoft.ContainerService

- `aiManagers`
- `containerServices`
- `deploymentSafeguards`
- `fleets`
- `maintenanceWindows`
- `managedClusters`
- `managedclustersnapshots`
- `nodeCustomizations`
- `openShiftManagedClusters`
- `preparedImageSpecifications`
- `snapshots`

### Microsoft.Kubernetes

- `connectedClusters`

### Microsoft.Compute

- `availabilitySets`
- `capacityReservationGroups`
- `cloudServices`
- `diskAccesses`
- `diskEncryptionSets`
- `disks`
- `galleries`
- `hostGroups`
- `images`
- `interconnectBlocks`
- `proximityPlacementGroups`
- `restorePointCollections`
- `snapshots`
- `sshPublicKeys`
- `virtualMachines`
- `virtualMachineScaleSets`

## Enabling a New Resource Type

Add an entry to `resource-types.json`:

```json
{
  "microsoft.network/virtualnetworks": {
    "armProvider": "Microsoft.Network/virtualNetworks",
    "extension": "Microsoft_Azure_Network"
  }
}
```

The key must be all-lowercase. `armProvider` must use the exact casing expected by the search index.
Only add types enabled by the search service.
