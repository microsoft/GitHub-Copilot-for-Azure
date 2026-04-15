# Version Currency Rules

All generated code must use current, supported versions. Stale defaults cause security vulnerabilities, missing features, and end-of-life surprises.

---

## Verification Checklist

| Category | Verification Method | Rule |
|---|---|---|
| **Bicep API versions** | Use Bicep MCP `get_az_resource_type_schema` | Latest **stable** (non-preview). Only use preview if no stable exists. |
| **Runtime stacks** | `az webapp list-runtimes` or current docs | Current LTS or latest stable. Prefer LTS over STS. Flag versions within 6 months of EOL. |
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

## Handling Outdated Values from Azure

When extracting from Azure and the current value uses an outdated version:
- Use the **current versions** as default
- Add a comment noting the extracted version and the recommended upgrade
- Never silently keep an end-of-life runtime
