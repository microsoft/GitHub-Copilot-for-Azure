# Modernize Project Workflow

Orchestrate modernization of an existing application to be Azure-ready.

## TASK

Transform an existing application to support Azure deployment while preserving functionality and customizations.

## SUCCESS CRITERIA

- [ ] Existing codebase analyzed and documented
- [ ] Current architecture understood
- [ ] Azure target architecture designed
- [ ] Missing artifacts generated (Bicep, azure.yaml, Dockerfiles)
- [ ] Preparation Manifest created

## Key Principles

| Principle | Description |
|-----------|-------------|
| **Preserve Existing** | Keep customizations and working configurations |
| **Add Missing** | Inject only required AZD components |
| **Modernize Patterns** | Update to current best practices where beneficial |
| **Ensure Compatibility** | Maintain operational patterns |

## Workflow Phases

### Phase 1: Workspace Analysis

Scan the existing codebase to identify:

| Category | Items to Detect |
|----------|-----------------|
| **Languages** | Node.js, Python, .NET, Java, Go |
| **Frameworks** | Express, FastAPI, ASP.NET, Spring |
| **Components** | Web apps, APIs, workers, functions |
| **Infrastructure** | Existing Dockerfiles, IaC, CI/CD |
| **Dependencies** | Databases, caching, messaging |

See: [workspace-analysis.md](../discovery/workspace-analysis.md)

### Phase 2: Gap Analysis

Compare current state to Azure deployment requirements:

| Requirement | Check |
|-------------|-------|
| `azure.yaml` | Does it exist? Is it valid? |
| Infrastructure | Bicep/ARM templates present? |
| Containerization | Dockerfiles for services? |
| Configuration | Environment-based config? |
| Health checks | `/health` endpoints? |

### Phase 3: Architecture Mapping

Map existing components to Azure services:

1. Identify each deployable component
2. Determine appropriate Azure hosting service
3. Document inter-component dependencies
4. Select supporting services (databases, etc.)

See: [service-mapping.md](../architecture/service-mapping.md)

### Phase 4: Artifact Generation

Generate only what's missing:

| Artifact | Strategy |
|----------|----------|
| **Existing files** | Preserve customizations, update patterns |
| **New files** | Create from templates |
| **Conflicts** | Document and prioritize AZD compatibility |

See: [generation/](../generation/)

### Phase 5: Manifest Creation

Create `.azure/preparation-manifest.md` documenting:
- Discovered architecture
- Migration decisions with rationale
- Generated vs. preserved files
- Validation requirements

## Conflict Resolution

When existing files conflict with AZD requirements:

1. **Never overwrite** without explicit confirmation
2. **Document conflicts** in the Preparation Manifest
3. **Provide migration path** for each conflict
4. **Prioritize AZD compatibility** while preserving functionality

## MCP Tool Invocations

```
mcp_azure_mcp_deploy(command: "plan get", intent: "analyze existing workspace")
mcp_azure_mcp_deploy(command: "iac rules get", intent: "get Bicep standards for migration")
```

## Handoff to Validate

After completing modernization, instruct user to run **azure-validate** skill to verify deployment readiness.
