# Analyze Workspace

Determine the preparation path based on workspace state.

## Decision Tree

```
Workspace has azure.yaml AND infra/?
├── YES → Skip to azure-validate
└── NO → Continue...
    ├── Empty/new workspace → Path: NEW
    ├── Existing code, no Azure config → Path: MODERNIZE
    └── Existing Azure app, adding features → Path: ADD
```

## Path: NEW

Creating a new Azure application from scratch.

**Actions:**
1. Confirm project type with user
2. Gather requirements → [requirements.md](requirements.md)
3. Select technology stack
4. Generate all artifacts

## Path: ADD

Adding components/services to an existing Azure application.

**Actions:**
1. Scan existing codebase → [scan.md](scan.md)
2. Identify existing Azure configuration
3. Gather requirements for new components
4. Generate only new artifacts
5. Update existing azure.yaml/infra as needed

## Path: MODERNIZE

Converting an existing application to run on Azure.

**Actions:**
1. Full codebase scan → [scan.md](scan.md)
2. Analyze existing infrastructure (Docker, CI/CD, etc.)
3. Gather requirements → [requirements.md](requirements.md)
4. Map existing components to Azure services
5. Generate Azure artifacts, preserving existing customizations

## Detection Signals

| Signal | Indicates |
|--------|-----------|
| `azure.yaml` exists | AZD project |
| `infra/*.bicep` exists | Bicep IaC |
| `infra/*.tf` exists | Terraform IaC |
| `Dockerfile` exists | Containerized app |
| No Azure files | Needs preparation |
