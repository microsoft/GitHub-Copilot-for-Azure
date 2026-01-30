# Common Errors

Error patterns and quick fixes for validation failures.

## Error Categories

### Authentication Errors

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `AADSTS700082: Token expired` | Refresh token expired | `az login` |
| `Please run 'az login'` | Not authenticated | `az login` |
| `AADSTS50076: MFA required` | MFA challenge needed | `az login --use-device-code` |
| `InteractiveBrowserCredential` | Interactive auth failed | `az login` with browser |

### Permission Errors

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `AuthorizationFailed` | Missing role assignment | Request Contributor role |
| `PrincipalNotFound` | Service principal deleted | Recreate or use different identity |
| `RoleAssignmentNotFound` | RBAC not propagated | Wait 5 minutes, retry |
| `ScopeNotValid` | Wrong subscription scope | `az account set --subscription <id>` |

### Bicep/ARM Errors

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `BCP035: Invalid type` | Wrong resource type/version | Check API version |
| `BCP037: Not a member` | Invalid property | Check resource schema |
| `BCP018: Expected character` | Syntax error | Fix Bicep syntax |
| `Module not found` | Wrong module path | Check relative paths |

### Resource Errors

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `NameNotAvailable` | Resource name taken | Add unique suffix |
| `QuotaExceeded` | Subscription limit | Request quota increase or change region |
| `ResourceNotFound` | Dependency missing | Check deployment order |
| `ConflictError` | Resource state conflict | Wait and retry |

### Docker Errors

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `Cannot connect to Docker daemon` | Docker not running | Start Docker Desktop |
| `Failed to read dockerfile` | Wrong path | Fix docker.path in azure.yaml |
| `Base image pull failed` | Network/auth issue | Check docker login |
| `COPY failed: file not found` | Build context wrong | Fix docker.context |

### AZD Errors

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `No environment selected` | Missing environment | `azd env select <name>` |
| `Service not found in azure.yaml` | Service mismatch | Check service name |
| `Invalid azure.yaml` | YAML syntax | Fix indentation/syntax |
| `Project path does not exist` | Wrong path | Fix service project path |

## Error Resolution Workflow

```
1. Identify error category
         ↓
2. Check error message details
         ↓
3. Apply quick fix
         ↓
4. Re-run validation
         ↓
5. Document in manifest if persistent
```

## Getting More Details

### AZD Debug Mode

```bash
azd <command> --debug
```

### Azure CLI Verbose

```bash
az <command> --verbose --debug
```

### Bicep Detailed Errors

```bash
az bicep build --file ./infra/main.bicep 2>&1
```

### Docker Build Logs

```bash
docker build --progress=plain -f Dockerfile .
```

## Escalation Path

If quick fixes don't resolve:

1. **Check Azure Status**: https://status.azure.com
2. **Review Recent Changes**: Git diff for config changes
3. **Search Known Issues**: GitHub issues for azd/bicep
4. **Contact Support**: Azure support ticket for persistent issues
