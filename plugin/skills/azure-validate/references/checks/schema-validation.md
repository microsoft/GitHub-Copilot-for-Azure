# Schema Validation

Validate azure.yaml structure and configuration.

## TASK

Verify that azure.yaml is syntactically correct and all references are valid.

## Validation Checks

### 1. File Exists

```bash
# Check file exists
test -f azure.yaml && echo "Found" || echo "Missing"
```

**Error**: `azure.yaml not found`
**Resolution**: Run `azure-prepare` skill to generate

### 2. YAML Syntax

```bash
# Validate YAML syntax
azd config list
```

**Error**: `YAML parse error`
**Resolution**: Fix YAML syntax (indentation, colons, quotes)

### 3. Required Fields

| Field | Required | Example |
|-------|----------|---------|
| `name` | ✅ | `name: my-app` |
| `services` | ✅ | At least one service defined |

### 4. Service Configuration

For each service, validate:

| Field | Required | Valid Values |
|-------|----------|--------------|
| `host` | ✅ | `containerapp`, `appservice`, `function`, `staticwebapp`, `aks` |
| `project` | ✅ | Valid relative path |
| `docker.path` | Conditional | Valid path (required for containerapp, aks) |

### 5. Path Validation

```bash
# Check each service project path exists
for service in $(yq '.services | keys | .[]' azure.yaml); do
  path=$(yq ".services.$service.project" azure.yaml)
  test -d "$path" && echo "$service: OK" || echo "$service: Missing $path"
done
```

### 6. Docker Path Validation

For containerized services:

```bash
# Check Dockerfile exists
for service in $(yq '.services | keys | .[]' azure.yaml); do
  host=$(yq ".services.$service.host" azure.yaml)
  if [ "$host" = "containerapp" ] || [ "$host" = "aks" ]; then
    project=$(yq ".services.$service.project" azure.yaml)
    dockerfile=$(yq ".services.$service.docker.path // \"./Dockerfile\"" azure.yaml)
    fullpath="$project/$dockerfile"
    test -f "$fullpath" && echo "$service: Dockerfile OK" || echo "$service: Missing $fullpath"
  fi
done
```

## Common Errors

### Invalid Host Type

```yaml
# ❌ Invalid
services:
  api:
    host: container  # Wrong! Should be 'containerapp'

# ✅ Valid
services:
  api:
    host: containerapp
```

### Missing Project Path

```yaml
# ❌ Path doesn't exist
services:
  api:
    host: containerapp
    project: ./src/api  # Directory doesn't exist

# ✅ Resolution
# Create the directory or fix the path
```

### Invalid Service Name

```yaml
# ❌ Invalid names
services:
  user_api: ...      # Underscores not allowed
  1-api: ...         # Can't start with number

# ✅ Valid names
services:
  user-api: ...
  api-v1: ...
```

## Validation Output

Record in manifest:

```markdown
### Schema Validation Results

| Check | Status | Details |
|-------|--------|---------|
| File exists | ✅ Pass | azure.yaml found |
| YAML syntax | ✅ Pass | Valid YAML |
| Required fields | ✅ Pass | name, services present |
| Service hosts | ✅ Pass | All valid host types |
| Project paths | ✅ Pass | All directories exist |
| Docker paths | ✅ Pass | All Dockerfiles found |
```
