## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Any Resource (identity assignment)** | Reference the identity resource ID in the resource's `identity.userAssignedIdentities` object as `{ '${managedIdentity.id}': {} }`. |
| **Key Vault (CMK)** | Storage accounts using CMK at creation require a user-assigned identity — system-assigned only works for existing accounts. |
| **Container Registry (ACR pull)** | Assign `AcrPull` role to the identity's `principalId`. Reference the identity in the pulling resource (AKS, Container App, etc.). |
| **AKS (workload identity)** | Create a federated identity credential on the managed identity. Map it to a Kubernetes service account via OIDC issuer. |
| **Role Assignments** | Use `properties.principalId` with `principalType: 'ServicePrincipal'` in `Microsoft.Authorization/roleAssignments`. |
| **Function App / App Service** | Set `identity.type` to `'UserAssigned'` and reference the identity resource ID. Use for Key Vault references, storage access, etc. |
