# Azure Deployment Verification Rules

Shared pre-deployment verification rules for generated Bicep templates. These cover **gotcha-prone constraints** that are easy to miss — SKU dependencies, resource compatibility, and networking rules that cause deployment failures.

For rules not listed here (security defaults like TLS 1.2, HTTPS enforcement, runtime version currency), verify against Bicep MCP `get_az_resource_type_schema`, [bicep-best-practices.md](bicep-best-practices.md), and Microsoft documentation.

Any skill that generates or modifies Bicep for deployment MUST run these checks before presenting results. Failures block deployment; warnings are reported but don't block.

---

## How to Use

1. After generating or modifying Bicep files, run every applicable rule category below against the generated code and the `.bicepparam` values.
2. Present results as a checklist (see "Output Format" at the end).
3. **Errors** must be fixed automatically. If automatic fixing is not possible, notify the user and present the issue with a concrete recommended fix. Do not present generated code that has known unfixed errors.
4. **Warnings** are informational — present them so the user can decide.

---

## 1. SKU Dependency Rules

Certain SKUs require companion resources or specific configurations. Missing these causes deployment failures.

### 1.1 Application Gateway WAF_v2 requires WAF Policy
- **Applies to**: `Microsoft.Network/applicationGateways` with `sku.tier == 'WAF_v2'`
- **Rule**: A `Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies` resource MUST exist and be referenced via the `firewallPolicy.id` property on the Application Gateway.
- **Fix**: Create a WAF policy resource with OWASP 3.2 managed rules in Prevention mode and link it to the gateway.
- **Severity**: Error

### 1.2 Application Gateway v2 requires Standard Public IP
- **Applies to**: `Microsoft.Network/applicationGateways` with `sku.tier` ending in `_v2`
- **Rule**: The associated `Microsoft.Network/publicIPAddresses` MUST use `sku.name = 'Standard'` and `allocationMethod = 'Static'`.
- **Fix**: Set Public IP SKU to Standard and allocation to Static.
- **Severity**: Error

### 1.3 App Service VNet Integration requires Standard+ SKU
- **Applies to**: `Microsoft.Web/sites` with VNet integration configured
- **Rule**: The associated `Microsoft.Web/serverfarms` MUST use SKU `S1` or higher. `F1` and `B1` do not support VNet integration.
- **Fix**: Upgrade App Service Plan SKU to at least `S1`.
- **Severity**: Error

### 1.4 Private Endpoint requires Standard+ resources
- **Applies to**: `Microsoft.Network/privateEndpoints` connected to Storage, SQL, Key Vault, etc.
- **Rule**: The target resource must support private endpoints at its current SKU tier (e.g., Key Vault Standard, Storage all SKUs, SQL all SKUs, Redis Premium only, Service Bus Premium only).
- **Fix**: Upgrade the target resource SKU to one that supports private endpoints.
- **Severity**: Error

### 1.5 AKS network policy requires compatible plugin
- **Applies to**: `Microsoft.ContainerService/managedClusters` with `networkPolicy` set
- **Rule**: If `networkPolicy = 'azure'`, then `networkPlugin` must be `'azure'`. If `networkPolicy = 'calico'`, `networkPlugin` can be `'azure'` or `'kubenet'`.
- **Fix**: Align network policy and plugin settings.
- **Severity**: Error

### 1.6 Azure Firewall requires dedicated subnet
- **Applies to**: `Microsoft.Network/azureFirewalls`
- **Rule**: The firewall MUST be placed in a subnet named exactly `AzureFirewallSubnet` with a minimum size of `/26`.
- **Fix**: Add or rename subnet to `AzureFirewallSubnet` with at least `/26` prefix.
- **Severity**: Error

### 1.7 Bastion requires dedicated subnet
- **Applies to**: `Microsoft.Network/bastionHosts`
- **Rule**: The bastion MUST be placed in a subnet named exactly `AzureBastionSubnet` with a minimum size of `/26`.
- **Fix**: Add or rename subnet to `AzureBastionSubnet` with at least `/26` prefix.
- **Severity**: Error

---

## 2. Resource Compatibility Rules

Resources that reference each other must be compatible in configuration.

### 2.1 Backend protocol must match target
- **Applies to**: `Microsoft.Network/applicationGateways` backend HTTP settings
- **Rule**: If the backend is an App Service, `backendHttpSettings.protocol` should be `Https` and `pickHostNameFromBackendAddress` should be `true`.
- **Severity**: Warning

### 2.2 VM NIC must exist in same subnet
- **Applies to**: `Microsoft.Compute/virtualMachines`
- **Rule**: Every VM must have at least one `Microsoft.Network/networkInterfaces` in the template, attached to a subnet in the same VNet.
- **Fix**: Generate a NIC resource if missing.
- **Severity**: Error

### 2.3 Private DNS zone must match service
- **Applies to**: `Microsoft.Network/privateEndpoints` with DNS zone groups
- **Rule**: The private DNS zone name must match the expected zone for the service type:
  - SQL Server → `privatelink.database.windows.net`
  - Blob Storage → `privatelink.blob.core.windows.net`
  - Key Vault → `privatelink.vaultcore.azure.net`
  - App Service → `privatelink.azurewebsites.net`
  - ACR → `privatelink.azurecr.io`
  - Cosmos DB → `privatelink.documents.azure.com`
- **Fix**: Use the correct zone name for the target resource type.
- **Severity**: Error

### 2.4 Private DNS zone must link to VNet
- **Applies to**: `Microsoft.Network/privateDnsZones`
- **Rule**: A `Microsoft.Network/privateDnsZones/virtualNetworkLinks` resource MUST exist linking the DNS zone to the VNet containing the private endpoint.
- **Fix**: Add a VNet link resource.
- **Severity**: Error

---

## 3. Networking Rules

### 3.1 No subnet address overlap
- **Applies to**: All subnets within a VNet
- **Rule**: Subnet address prefixes MUST NOT overlap with each other or exceed the VNet address space.
- **Fix**: Recalculate subnet prefixes to avoid overlap.
- **Severity**: Error

### 3.2 Subnet sizing for delegations
- **Applies to**: Subnets with delegations
- **Rule**: Subnets delegated to `Microsoft.Web/serverFarms` (VNet integration) should be at least `/26` (64 addresses). App Gateway subnets should be at least `/24`.
- **Severity**: Warning

### 3.3 Application Gateway subnet must be dedicated
- **Applies to**: `Microsoft.Network/applicationGateways`
- **Rule**: The App Gateway subnet must not contain any other resources (except other App Gateways). No delegations allowed.
- **Fix**: Move other resources to a different subnet.
- **Severity**: Error

### 3.4 NSG cannot be applied to App Gateway subnet (v2)
- **Applies to**: `Microsoft.Network/applicationGateways` with v2 SKU
- **Rule**: NSGs on App Gateway v2 subnets require special rules (allow GatewayManager inbound, allow Azure Load Balancer, allow health probes on ports 65200-65535). If an NSG is attached, verify these rules exist.
- **Severity**: Warning

---

## Output Format

Present verification results after validation:

```
## Pre-Deployment Verification

✅ N checks passed
⚠️ N warnings
❌ N errors

### Errors (must fix before deployment)
- ❌ **Rule 1.1**: Application Gateway uses WAF_v2 SKU but no WAF policy is defined.
  → Fix: Added `waf-policy-appgw` resource with OWASP 3.2 rules linked to `appgw-web`.

### Warnings
- ⚠️ **Rule 2.1**: App Gateway backend uses HTTP — consider HTTPS with `pickHostNameFromBackendAddress: true`.
```

When errors are found and auto-fixed, re-run the affected checks to confirm the fix resolves the issue.
