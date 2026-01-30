# Bicep Recipe: Prepare

Guide for preparing an application for Azure deployment using standalone Bicep (without AZD).

## Overview

This recipe covers preparing infrastructure-as-code with Bicep templates for Azure CLI deployment.

## When to Use

- No azure.yaml required
- Direct `az deployment` commands
- Existing Bicep infrastructure
- Custom deployment pipelines

## Workflow Phases

### Phase 1: Discovery

Analyze the application to understand deployment needs:

1. **Identify deployable components**
   - Web applications, APIs, workers
   - Database requirements
   - Storage needs

2. **Document dependencies**
   - Inter-service communication
   - External integrations

3. **Determine hosting services**
   - Container Apps, App Service, Functions
   - Data services

### Phase 2: Architecture Planning

Map components to Azure resources:

| Component Type | Azure Service |
|----------------|---------------|
| Web API | Container Apps / App Service |
| Background Worker | Container Apps / Functions |
| Static Frontend | Static Web Apps / Blob Storage |
| Relational Data | Azure SQL / PostgreSQL |
| Document Store | Cosmos DB |

### Phase 3: Infrastructure Generation

Create Bicep structure:

```
infra/
├── main.bicep              # Entry point
├── main.parameters.json    # Parameter values
└── modules/
    ├── resources.bicep     # Base resources
    ├── webapp.bicep        # Web app module
    └── database.bicep      # Database module
```

#### main.bicep Template

```bicep
targetScope = 'subscription'

@description('Environment name')
param environmentName string

@description('Primary location')
param location string

var resourcePrefix = 'myapp'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environmentName}'
  location: location
}

module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    resourcePrefix: resourcePrefix
  }
}

output resourceGroupName string = rg.name
```

### Phase 4: Application Configuration

Configure applications for Azure:

1. **Environment variables**
   - Use Azure App Configuration or environment settings
   - Reference Key Vault for secrets

2. **Health endpoints**
   - Add `/health` endpoint to all services

3. **Logging**
   - Configure Application Insights SDK

### Phase 5: Manifest Creation

Create Preparation Manifest documenting:

```markdown
## Implementation Plan

### Deployment Technology

- **Primary**: Azure CLI (az deployment)
- **Infrastructure**: Bicep
- **CI/CD**: GitHub Actions / Azure DevOps

### Deployment Commands

\`\`\`bash
az deployment sub create \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
\`\`\`
```

## Output Artifacts

| Artifact | Location |
|----------|----------|
| Preparation Manifest | `.azure/preparation-manifest.md` |
| Infrastructure | `./infra/main.bicep`, `./infra/modules/` |
| Parameters | `./infra/main.parameters.json` |

## Validation

Use Azure CLI for validation:

```bash
# Compile Bicep
az bicep build --file ./infra/main.bicep

# Validate deployment
az deployment sub validate \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json

# What-if preview
az deployment sub what-if \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

## Next Steps

After completing preparation:

1. Run `azure-validate` skill with Bicep recipe
2. Execute `az deployment sub what-if` to preview
3. Proceed to `azure-deploy` skill with Azure CLI recipe
