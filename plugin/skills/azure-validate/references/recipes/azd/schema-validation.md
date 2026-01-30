# Schema Validation

Validate azure.yaml against the official JSON schema.

## MCP Tool

```
mcp_azure_mcp_azd(
  command: "validate_azure_yaml",
  parameters: { path: "./azure.yaml" }
)
```

## What It Checks

- Valid YAML syntax
- Required fields present (`name`, `services`)
- Valid host types
- Proper service configuration

## Success Response

```json
{
  "valid": true,
  "errors": []
}
```

## Failure Response

```json
{
  "valid": false,
  "errors": [
    {
      "path": "/services/api/host",
      "message": "must be one of: containerapp, appservice, function, staticwebapp, aks"
    }
  ]
}
```

## Common Errors

| Error | Fix |
|-------|-----|
| Missing `name` | Add `name: <project-name>` at top level |
| Invalid `host` | Use: containerapp, appservice, function, staticwebapp, aks |
| Missing `project` | Add `project: <path>` to each service |
| Invalid `language` | Use: python, js, ts, java, dotnet, go |
