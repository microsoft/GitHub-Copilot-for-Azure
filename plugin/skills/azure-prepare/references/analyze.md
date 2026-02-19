# Analyze Workspace

Determine the preparation path based on workspace state.

## Three Modes — Always Choose One

> **⛔ IMPORTANT**: Always go through one of these three paths. Having `azure.yaml` does NOT mean you skip to validate — the user may want to modify or extend the app.

| Mode | When to Use |
|------|-------------|
| **NEW** | Empty workspace, or user wants to create a new app |
| **MODIFY** | Existing Azure app, user wants to add features/components |
| **MODERNIZE** | Existing non-Azure app, user wants to migrate to Azure |

## Decision Tree

```
What does the user want to do?
│
├── Create new application → Mode: NEW
│
├── Add/change features to existing app
│   ├── Has azure.yaml/infra? → Mode: MODIFY
│   └── No Azure config? → Mode: MODERNIZE (add Azure support first)
│
└── Migrate/modernize for Azure → Mode: MODERNIZE
```

## Mode: NEW

Creating a new Azure application from scratch.

**Actions:**
1. Confirm project type with user
2. Gather requirements → [requirements.md](requirements.md)
3. Select technology stack
4. Update plan

## Mode: MODIFY

Adding components/services to an existing Azure application.

**Actions:**
1. Scan existing codebase → [scan.md](scan.md)
2. Identify existing Azure configuration
3. Gather requirements for new components
4. Update plan

## Mode: MODERNIZE

Converting an existing application to run on Azure.

**Actions:**
1. Full codebase scan → [scan.md](scan.md)
2. Analyze existing infrastructure (Docker, CI/CD, etc.)
3. Gather requirements → [requirements.md](requirements.md)
4. Map existing components to Azure services
5. Update plan

## Detection Signals

| Signal | Indicates |
|--------|-----------|
| `azure.yaml` exists | AZD project (MODIFY mode likely) |
| `infra/*.bicep` exists | Bicep IaC |
| `infra/*.tf` exists | Terraform IaC |
| `Dockerfile` exists | Containerized app |
| No Azure files | NEW or MODERNIZE mode |
| `*.AppHost.csproj` exists | .NET Aspire project (likely using azd) |

> 💡 **.NET Aspire Projects:** Aspire projects typically use azd in "limited mode" where infrastructure is generated in-memory. When working with Aspire Container Apps deployments, proactive environment variable setup is **required** to prevent deployment failures. See [aspire.md](aspire.md#environment-variables-for-container-apps) for critical setup steps.
