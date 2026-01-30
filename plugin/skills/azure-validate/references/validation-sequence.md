# Validation Sequence

Ordered validation steps for deployment readiness.

## TASK

Execute comprehensive validation to ensure the application is ready for Azure deployment.

## Validation Order

Execute validations in this order—each step depends on previous steps passing:

```
1. Preparation Manifest Review
         ↓
2. Schema Validation (azure.yaml)
         ↓
3. Environment Validation (AZD + Azure CLI)
         ↓
4. Package Validation (azd package)
         ↓
5. Provision Preview (azd provision --preview)
```

## Step Details

### Step 1: Preparation Manifest Review

**Check**: `.azure/preparation-manifest.md` exists and is complete

**Verify**:
- All required sections populated
- No `⏳ Pending` items in checklists
- Stack selection documented
- Service mapping complete

**If Missing**: Instruct user to run `azure-prepare` skill first.

### Step 2: Schema Validation

**Command**: Validate azure.yaml structure

**Checks**:
- File exists at project root
- Valid YAML syntax
- All service paths exist
- Host types are valid
- Docker paths resolve correctly

See: [schema-validation.md](checks/schema-validation.md)

### Step 3: Environment Validation

**Commands**:
```bash
azd env list
az account show
```

**Checks**:
- AZD environment initialized
- Azure CLI logged in
- Correct subscription selected
- Required permissions available

See: [environment-validation.md](checks/environment-validation.md)

### Step 4: Package Validation

**Command**:
```bash
azd package --no-prompt
```

**Checks**:
- All services package successfully
- Docker builds complete (if containerized)
- Build artifacts generated
- No missing dependencies

See: [package-validation.md](checks/package-validation.md)

### Step 5: Provision Preview

**Command**:
```bash
azd provision --preview --no-prompt
```

**Checks**:
- Bicep templates compile
- No resource conflicts
- Permissions sufficient
- Resource names available

See: [provision-preview.md](checks/provision-preview.md)

## Success Criteria

| Check | Required | Blocking |
|-------|----------|----------|
| Manifest exists | ✅ | Yes |
| azure.yaml valid | ✅ | Yes |
| AZD environment ready | ✅ | Yes |
| Azure CLI authenticated | ✅ | Yes |
| Package succeeds | ✅ | Yes |
| Provision preview passes | ✅ | Yes |

**All checks must pass before proceeding to deployment.**

## Failure Handling

When a validation fails:

1. **Stop** the validation sequence
2. **Identify** the root cause
3. **Document** in manifest Issues section
4. **Provide** resolution steps
5. **Re-run** validation after fix

See: [error-handling/](error-handling/)

## Manifest Updates

After validation, update the Preparation Manifest:

```markdown
## Validation Requirements

### Pre-Deployment Checks

| Check | Required | Status |
|-------|----------|--------|
| azure.yaml schema | ✅ | Pass |
| Bicep compilation | ✅ | Pass |
| azd package | ✅ | Pass |
| azd provision --preview | ✅ | Pass |

### Issues

| Issue | Severity | Resolution | Status |
|-------|----------|------------|--------|
| (none) | | | |
```

Set manifest status to `Validated` when all pass.
