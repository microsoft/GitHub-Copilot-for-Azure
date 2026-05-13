# Configure Zone Redundancy — Platform Notes

## Always check storage redundancy first

Before enabling zone-redundant compute, verify the app's storage account is **ZRS or GZRS**. Zone-redundant compute backed by LRS storage still suffers downtime in a zone failure.

- Storage discovery and remediation: [storage-redundancy-checks.md](storage-redundancy-checks.md)
- Live storage migration commands: [configure-storage.md](configure-storage.md)

The parent skill ([SKILL.md](../SKILL.md), Configuration Workflow) enforces a **two-step deploy** for this reason: enable compute ZR first (quick win), then ask the user before kicking off the slow storage migration.

## Per-service configuration commands

The `az` CLI commands, plan-upgrade paths, blue/green migration steps, and verification commands all live in the per-service references because the syntax differs per service:

| Service | Reference |
|---|---|
| Azure Functions (FC1, EP1–EP3) | [services/functions/reliability.md](services/functions/reliability.md) |
| Azure App Service (P1v2+, P0v3+, P0v4, ASEv3) | [services/app-service/reliability.md](services/app-service/reliability.md) |
| Azure Container Apps (environment + apps) | [services/container-apps/reliability.md](services/container-apps/reliability.md) |

## Verification

After enabling zone redundancy on any compute resource, confirm with:

```bash
az graph query -q "
Resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms' or type =~ 'microsoft.app/managedenvironments'
| extend zoneRedundant = tobool(properties.zoneRedundant)
| project name, type, zoneRedundant
" --query "data[]" -o json
```

All patched resources should show `zoneRedundant = true`.

