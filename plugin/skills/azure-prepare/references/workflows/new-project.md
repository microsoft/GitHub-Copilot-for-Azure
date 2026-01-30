# New Project Workflow

Orchestrate creation of a new Azure-ready project from scratch.

## TASK

Guide users through creating a new application with complete Azure deployment infrastructure.

## CRITICAL: DO NOT SKIP PHASES

**Every phase is MANDATORY.** Do not jump ahead to artifact generation without completing discovery phases first.

- If user seems impatient, explain that proper discovery prevents costly mistakes later
- If user says "just use defaults", still ASK to confirm each default before proceeding
- Document EVERY decision in the manifest as you go, not at the end

## SUCCESS CRITERIA

- [ ] Project requirements documented (MUST be gathered through conversation, not assumed)
- [ ] Technology stack selected with rationale (MUST be confirmed with user)
- [ ] Azure architecture designed
- [ ] All artifacts generated (Bicep, azure.yaml, Dockerfiles)
- [ ] Preparation Manifest created AND updated progressively through each phase
- [ ] User has confirmed understanding before artifact generation

## Workflow Phases

### Phase 1: Initiation

1. Confirm user wants to create a new project
2. Explain the preparation process
3. **Initialize the Preparation Manifest IMMEDIATELY** - Create `.azure/preparation-manifest.md` with status `In Progress`

### Phase 2: Requirements Discovery (MANDATORY - DO NOT SKIP)

**USE ask_user TOOL** to gather information through conversation:

| Category | Questions |
|----------|-----------|
| **Classification** | POC, Development Tool, or Production? |
| **Scale** | Small (<1K users), Medium (1K-100K), Large (100K+)? |
| **Budget** | Cost-Optimized, Balanced, or Performance-Focused? |
| **Architecture** | Containers, Serverless, Hybrid, or No Preference? |

**After gathering:** Update the manifest with captured requirements.

See: [requirements-gathering.md](../discovery/requirements-gathering.md)

### Phase 3: Stack Selection

Based on requirements, select technology stack:

| Factor | Containers | Serverless | Logic Apps |
|--------|------------|------------|------------|
| Team has Docker experience | ✓ | | |
| Event-driven workloads | | ✓ | |
| Business process automation | | | ✓ |
| Variable/unpredictable traffic | | ✓ | |
| Complex dependencies | ✓ | | |

See: [stack-selection.md](../architecture/stack-selection.md)

### Phase 4: Architecture Planning

1. Define application components (APIs, web apps, workers)
2. Map components to Azure services
3. Document dependencies and communication patterns
4. Select supporting services (databases, messaging, monitoring)

See: [service-mapping.md](../architecture/service-mapping.md)

### Phase 5: Artifact Generation

Generate in order:
1. Infrastructure templates (`./infra/`)
2. Application scaffolding (`src/<component>/`)
3. Docker configurations (if containerized)
4. `azure.yaml` configuration

See: [generation/](../generation/)

### Phase 6: Manifest Creation

Create `.azure/preparation-manifest.md` with:
- All requirements and decisions
- Architecture documentation
- File checklists
- Validation requirements

See: [preparation-manifest.md](../manifest/preparation-manifest.md)

## MCP Tool Invocations

```
mcp_azure_mcp_deploy(command: "plan get", intent: "analyze workspace and generate deployment plan")
mcp_azure_mcp_deploy(command: "iac rules get", intent: "get Bicep generation standards")
```

## Handoff to Validate

After completing all phases, **YOU MUST** invoke **azure-validate** skill to verify deployment readiness.

**DO NOT proceed to deployment until validation passes.**
