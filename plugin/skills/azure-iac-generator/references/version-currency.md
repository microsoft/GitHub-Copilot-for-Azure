# Version Currency Rules

version-selection guidance for Azure IaC skills. Keep local copies aligned when this rule changes.


All generated code must use current, supported versions. Stale defaults cause security vulnerabilities, missing features, and end-of-life surprises.

---

## Verification Checklist

| Category | Verification Method | Rule |
|---|---|---|
| **Bicep API versions** | Use Bicep MCP `get_az_resource_type_schema` | Latest **stable** (non-preview). Only use preview if no stable exists. |
| **Runtime stacks** | Extract from Azure, then verify against `az webapp list-runtimes` or current docs | Apply the hybrid rule below: keep the exact extracted runtime when it is still supported; if it is EOL or unsupported, default to the current supported version and document the extracted value, recommended upgrade, and EOL date in comments. Flag versions within 6 months of EOL. |
| **Kubernetes versions** | Azure supported versions list | Currently supported AKS version |
| **OS images** | Docs / `az vm image list` | Latest generation + LTS releases (e.g., latest Ubuntu LTS, latest Windows Server) |
| **SDK/tool versions** | Docs | Azure Functions host, runtime extensions — current versions |

## Bicepparam Version Comments

Always note the version choice in `.bicepparam` comments:

```bicep
// Runtime stack for the App Service.
//   DOTNET|10.0 → .NET 10 (LTS, supported until Nov 2028)
//   NODE|22-lts → Node.js 22 LTS (supported until Apr 2027)
//   PYTHON|3.13 → Python 3.13 (supported until Oct 2029)
//   JAVA|21     → Java 21 LTS (supported until Sep 2028)
param appServiceRuntimeStack = 'DOTNET|10.0'
```

## Hybrid Runtime Rule

When extracting runtime values from Azure:

- **Still supported runtime**: use the exact Azure value as the default in generated code.
- **EOL or unsupported runtime**: use the current supported version as the default, and add a comment that includes:
  - the extracted Azure value,
  - the recommended upgrade target,
  - the EOL date.

This is the single source of truth for runtime defaults in generated Bicep and `.bicepparam` files.

## Handling Outdated Values from Azure

When extracting from Azure and the current value uses an outdated version:
- Use the **current supported version** as the default
- Add a comment noting the extracted version, the recommended upgrade, and the EOL date
- Never silently keep an end-of-life runtime as the generated default
