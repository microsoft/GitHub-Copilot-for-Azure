# MCSB v3.0 — Privileged Access (PA) — SEED HINTS

> Seed hints only. Reconcile control ID/name/URL against live Microsoft Learn via
> `microsoft_docs_search` (query: "MCSB privileged access PA-<n>") before emitting. Cite the
> reconciled URL in `azure_guidance`.
> URL base: https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-privileged-access

## PA-7: Follow just enough administration (least privilege)
- **Check:** Avoid subscription-scoped `Owner` role assignments; prefer built-in roles over custom roles with wildcard `actions` (`*`); scope role assignments to resource group / resource, not subscription.
- **Properties:** `Microsoft.Authorization/roleAssignments` → `roleDefinitionId`, `scope`; `Microsoft.Authorization/roleDefinitions` → `permissions[].actions`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-privileged-access#pa-7-follow-just-enough-administration-least-privilege-principle
