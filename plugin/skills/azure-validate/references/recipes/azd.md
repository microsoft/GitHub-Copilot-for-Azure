# AZD Recipe: Validate

Validate an Azure Developer CLI project before deployment.

## Prerequisites

- Preparation Manifest exists with Recipe: `AZD`
- `azure.yaml` exists in project root
- `./infra/` directory contains Bicep files

---

## Steps

### Step 4A: Schema Validation

Validate azure.yaml against official JSON schema.

→ [azd/schema-validation.md](azd/schema-validation.md)

### Step 4B: Environment Validation

Verify AZD environment is configured.

→ [azd/environment-validation.md](azd/environment-validation.md)

### Step 4C: Authentication Validation

Verify Azure authentication.

→ [azd/authentication.md](azd/authentication.md)

### Step 4D: Package Validation

Verify all services can be built.

→ [azd/package-validation.md](azd/package-validation.md)

### Step 4E: Provision Preview

Preview infrastructure deployment.

→ [azd/provision-preview.md](azd/provision-preview.md)

---

## Validation Checklist

All must pass before proceeding:

| Check | Status |
|-------|--------|
| Schema | ☐ |
| Environment | ☐ |
| Authentication | ☐ |
| Package | ☐ |
| Preview | ☐ |

---

## Next Step

→ SKILL.md Step 6 (Update Manifest) → **azure-deploy**
