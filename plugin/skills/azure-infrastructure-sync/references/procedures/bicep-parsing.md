# Bicep Parsing Procedure

Parse Bicep templates into a structured resource model for comparison. Referenced by skills that analyze existing Bicep files.

---

## Procedure

### 1. Read Parameter Values

Read the `.bicepparam` file and extract all parameter values. These are needed to resolve name expressions in resource blocks.

### 2. Read Template Files

Read `main.bicep` and parse all `module` declarations to find referenced Bicep files. Module paths are relative to the file containing the `module` statement — they may reference files outside `modules/` (e.g., `'../shared/networking.bicep'` or `'br:myregistry.azurecr.io/bicep/networking:v1'`). Read each resolved module file recursively to discover nested module references.

### 3. Extract Resources

For each `resource` block found:

| Field | How to Extract |
|---|---|
| `type` | Resource type string, sans API version (e.g., `Microsoft.Compute/virtualMachines`) |
| `apiVersion` | API version from the resource declaration |
| `symbolicName` | The Bicep symbolic name (left side of `=`) |
| `name` | The `name` property value — resolve parameter references using `.bicepparam` values |
| `sourceFile` | Relative path of the file containing this resource |
| `conditional` | `true` if the resource has an `if` condition, `false` otherwise |
| `parent` | Symbolic name of the `parent:` reference (if any) |

### 4. Resolve Hierarchy

- Match `parent:` references to their target resource blocks
- Build parent-child relationships (e.g., subnet → VNet)

### 5. Output Model

Output the parsed Bicep resource model in chat for user verification. Schema per resource:

```json
{
  "symbolicName": "<name>",
  "type": "Microsoft.Provider/resourceType",
  "name": "<resolved-name>",
  "sourceFile": "modules/networking.bicep",
  "conditional": false,
  "parent": null
}
```

## Depth Levels

| Depth | What's Extracted | Use Case |
|---|---|---|
| Shallow | Type, name, file location | Quick comparison / drift detection |
| Standard | Above + params, parent refs, conditions | Sync, what-if |
| Deep | Above + all property values resolved | Policy check, detailed what-if |
