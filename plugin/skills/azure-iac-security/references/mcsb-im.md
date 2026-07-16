# MCSB v3.0 — Identity Management (IM) — SEED HINTS

> Seed hints only. Reconcile control ID/name/URL against live Microsoft Learn via
> `microsoft_docs_search` (query: "MCSB identity management IM-<n>") before emitting. Cite the
> reconciled URL in `azure_guidance`.
> URL base: https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-identity-management

## IM-1: Use centralized identity and authentication system
- **Check:** `azureADOnlyAuthentication` = true; `disableLocalAuth` = true; `authSettings.enabled` = true. Prefer Entra ID over local/key auth.
- **Properties:** `azureADOnlyAuthentication`, `disableLocalAuth`, `authSettings`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-identity-management#im-1-use-centralized-identity-and-authentication-system

## IM-3: Manage application identities securely and automatically
- **Check:** Workloads use managed identity — `identity` present with `type` `SystemAssigned` or `UserAssigned` on VMs, App/Function Apps, Container Instances; avoid long-lived service principal secrets.
- **Properties:** `identity`, `identity.type`, `userAssignedIdentities`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-identity-management#im-3-manage-application-identities-securely-and-automatically

## IM-8: Restrict the exposure of credential and secrets  **(Critical when violated)**
- **Check:** No hardcoded `adminPassword` / `passwordCredentials`; no secrets embedded in `connectionString`; Key Vault `enableRbacAuthorization` = true; Storage `allowSharedKeyAccess` = false; Cosmos DB `disableLocalAuth` = true. Reference secrets via Key Vault, not literals.
- **Properties:** `adminPassword`, `passwordCredentials`, `connectionString`, `enableRbacAuthorization`, `allowSharedKeyAccess`, `accessPolicies`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-identity-management#im-8-restrict-the-exposure-of-credential-and-secrets

## IM-7: Restrict resource access based on conditions
- **Check:** Access constrained by conditions (Conditional Access, RBAC ABAC conditions) rather than static broad grants.
- **Properties:** `conditions`, `conditionVersion`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-identity-management#im-7-restrict-resource-access-based-on-conditions

> Least-privilege RBAC (subscription Owner, wildcard custom roles) is covered by **PA-7** in the
> Privileged Access pillar — see [mcsb-pa.md](mcsb-pa.md).
