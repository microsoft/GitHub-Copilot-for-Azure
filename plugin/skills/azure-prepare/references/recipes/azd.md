# AZD Recipe: Prepare

Generate artifacts for Azure Developer CLI deployment.

## Prerequisites

- Components identified (SKILL.md Step 3)
- Architecture selected (SKILL.md Step 5)
- Services mapped (SKILL.md Step 6)

---

## Steps

### Step 7A: Generate azure.yaml

Create the AZD configuration file.

→ [azd/azure-yaml.md](azd/azure-yaml.md)

### Step 7B: Generate Infrastructure

Create Bicep templates in `./infra/`.

→ [azd/infrastructure.md](azd/infrastructure.md)

### Step 7C: Generate Dockerfiles

Create Dockerfiles for containerized services.

→ [azd/dockerfiles.md](azd/dockerfiles.md)

### Step 7D: Initialize Environment

Set up AZD environment.

→ [azd/environment.md](azd/environment.md)

---

## Output Checklist

| Artifact | Path |
|----------|------|
| azure.yaml | `./azure.yaml` |
| Main Bicep | `./infra/main.bicep` |
| Parameters | `./infra/main.parameters.json` |
| Modules | `./infra/modules/*.bicep` |
| Dockerfiles | `src/<service>/Dockerfile` |
| Environment | `.azure/` |

---

## Next Step

→ SKILL.md Step 8 (Create Manifest) → **azure-validate**
