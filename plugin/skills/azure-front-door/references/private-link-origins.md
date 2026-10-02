# Private Link Origins (Premium Only)

## Overview

Private Link origins allow Azure Front Door Premium to connect to backends over a private connection instead of the public internet. Traffic between Front Door and the origin travels over the Microsoft backbone network via Private Link.

## Why Use Private Link Origins

| Benefit | Detail |
|---------|--------|
| Security | Origin not exposed to public internet; no public IP needed |
| Compliance | Data stays on Microsoft backbone; meets data sovereignty requirements |
| Simplified networking | No need for IP allowlisting or service endpoints |
| Reduced attack surface | Origin only accepts traffic from approved Private Link connection |

## Supported Origin Types

| Origin Type | Private Link Resource Type | Sub-resource |
|-------------|---------------------------|--------------|
| App Service / Web App | `Microsoft.Web/sites` | `sites` |
| Azure Storage (Blob) | `Microsoft.Storage/storageAccounts` | `blob` |
| Azure Storage (Static Website) | `Microsoft.Storage/storageAccounts` | `web` |
| Internal Load Balancer | `Microsoft.Network/privateLinkServices` | (custom) |
| API Management | `Microsoft.ApiManagement/service` | `Gateway` |
| App Service Environment | `Microsoft.Web/hostingEnvironments` | N/A |
| Azure Container Apps | `Microsoft.App/managedEnvironments` | `managedEnvironments` |

## Configuration

### Step 1: Create Origin with Private Link

```bash
# App Service origin with Private Link
az afd origin create \
  --origin-name myPrivateOrigin \
  --origin-group-name myOriginGroup \
  --profile-name myPremiumFD -g myRG \
  --host-name "myapp.azurewebsites.net" \
  --origin-host-header "myapp.azurewebsites.net" \
  --https-port 443 \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled \
  --enable-private-link true \
  --private-link-resource "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/sites/myapp" \
  --private-link-sub-resource-type "sites" \
  --private-link-location "eastus" \
  --private-link-request-message "Front Door Private Link request"
```

### Step 2: Approve the Private Endpoint Connection

After creating the origin, a private endpoint connection request is created on the target resource. **You must approve it** before traffic can flow.

#### Approve via Azure CLI

```bash
# List pending connections on the origin resource
az network private-endpoint-connection list \
  --name myapp \
  -g myRG \
  --type Microsoft.Web/sites \
  -o table

# Approve the connection
az network private-endpoint-connection approve \
  --id "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/sites/myapp/privateEndpointConnections/<pe-connection-name>" \
  --description "Approved for Front Door"
```

#### Approve via Portal

1. Navigate to the origin resource (e.g., App Service)
2. Go to **Networking** → **Private endpoint connections**
3. Find the pending connection from Azure Front Door
4. Click **Approve**

### Step 3: Verify Private Link Status

```bash
# Check origin status
az afd origin show \
  --origin-name myPrivateOrigin \
  --origin-group-name myOriginGroup \
  --profile-name myPremiumFD -g myRG \
  --query "sharedPrivateLinkResource"
```

| Status | Meaning |
|--------|---------|
| Pending | Connection request sent, awaiting approval |
| Approved | Connection approved, traffic flows privately |
| Rejected | Connection rejected by origin owner |
| Disconnected | Connection removed on origin side |
| Timeout | Request was not approved within the timeout period |

## Common Patterns

### App Service with Private Link (Lock Down Public Access)

```bash
# Step 1: Create Premium Front Door with Private Link origin (see above)

# Step 2: Approve the connection (see above)

# Step 3: Lock down App Service to Private Link only
az webapp update \
  --name myapp -g myRG \
  --set publicNetworkAccess=Disabled

# Now the App Service only accepts traffic from Front Door via Private Link
```

### Storage Account (Static Website)

```bash
az afd origin create \
  --origin-name storageOrigin \
  --origin-group-name staticGroup \
  --profile-name myPremiumFD -g myRG \
  --host-name "myaccount.z13.web.core.windows.net" \
  --origin-host-header "myaccount.z13.web.core.windows.net" \
  --https-port 443 \
  --priority 1 --weight 1000 \
  --enable-private-link true \
  --private-link-resource "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/myaccount" \
  --private-link-sub-resource-type "web" \
  --private-link-location "eastus" \
  --private-link-request-message "FD to Storage Private Link"
```

### Internal Load Balancer via Private Link Service

For backends behind an internal LB:

1. **Create a Private Link Service** pointing to the internal LB:
   ```bash
   az network private-link-service create \
     --name myPLS -g myRG \
     --vnet-name myVNet \
     --subnet plsSubnet \
     --lb-name myInternalLB \
     --lb-frontend-ip-configs myFrontEnd \
     --location eastus
   ```

2. **Create Front Door origin referencing the PLS**:
   ```bash
   az afd origin create \
     --origin-name ilbOrigin \
     --origin-group-name myOriginGroup \
     --profile-name myPremiumFD -g myRG \
     --host-name "10.0.1.4" \
     --origin-host-header "api.contoso.com" \
     --https-port 443 \
     --enable-private-link true \
     --private-link-resource "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Network/privateLinkServices/myPLS" \
     --private-link-location "eastus" \
     --private-link-request-message "FD to ILB via PLS"
   ```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Connection stuck in "Pending" | Not approved on origin side | Approve the PE connection on the target resource |
| 502 after approval | Origin not listening or DNS issue | Verify origin-host-header and port; test origin directly |
| Private Link not available | Wrong tier | Private Link requires Premium tier |
| Approval expired | Timeout exceeded | Delete and recreate the origin |
| Origin publicly accessible | Public access not disabled | Set `publicNetworkAccess=Disabled` on the origin resource |
| Wrong sub-resource type | Incorrect Private Link config | Verify sub-resource type for the origin type (see table above) |

## Limitations

| Limitation | Detail |
|-----------|--------|
| Premium tier only | Not available on Standard tier |
| Manual approval required | Cannot auto-approve; must be approved on origin side |
| Region matching | Private Link location must match the origin resource region |
| Not all origin types | Only supports listed resource types |
| One PE per origin | Each origin gets its own private endpoint connection |

## Source Documentation

- [Private Link origins overview](https://learn.microsoft.com/azure/frontdoor/private-link)
- [Configure Private Link to App Service](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-enable-private-link-web-app)
- [Configure Private Link to Storage](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-enable-private-link-storage-account)
- [Configure Private Link to internal LB](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-enable-private-link-internal-load-balancer)
