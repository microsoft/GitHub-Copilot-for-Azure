# Error Handling

## MCP Tool Failures

If any MCP tool call fails, call the `azure__azd` MCP tool for troubleshooting:

```javascript
await azure__azd({
  command: "error_troubleshooting",
  parameters: {}
});
```

## Common Error Resolutions

| Error | Resolution |
|-------|------------|
| "azure.yaml invalid" | Call `validate_azure_yaml` and fix reported errors |
| "Bicep compilation error" | Check module paths and parameters |
| "Service not found" | Verify service name matches `azure.yaml` configuration |
| "Docker build failed" | Check Dockerfile syntax and base image availability |
| "Authentication failed" | Run `az login` or check service principal credentials |

## Validation Errors

### azure.yaml Schema Errors

Common issues:
- Missing required `name` property
- Invalid `host` value
- Missing `project` path
- Incorrect `dist` path for static web apps

### Bicep Compilation Errors

Common issues:
- Missing module files
- Parameter type mismatches
- Undefined variables
- Invalid resource API versions

## Debugging Tips

1. **Check azure.yaml syntax** - Use `validate_azure_yaml` command
2. **Verify file paths** - Ensure all referenced paths exist
3. **Review Bicep templates** - Check for compilation errors
4. **Test locally first** - Run `azd package` before `azd provision`
