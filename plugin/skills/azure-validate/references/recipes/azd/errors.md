# AZD Validation Errors

| Error | Fix |
|-------|-----|
| `Please run 'az login'` | `az login` |
| `No environment selected` | `azd env select <name>` |
| `Service not found` | Check service name in azure.yaml |
| `Invalid azure.yaml` | Fix YAML syntax |
| `Project path does not exist` | Fix service project path |
| `Cannot connect to Docker daemon` | Start Docker Desktop |

## Debug

```bash
azd <command> --debug
```
