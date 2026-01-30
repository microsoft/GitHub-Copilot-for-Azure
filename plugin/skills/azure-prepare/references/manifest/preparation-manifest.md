# Preparation Manifest

The central artifact connecting Prepare, Validate, and Deploy skills.

## Purpose

The Preparation Manifest (`.azure/preparation-manifest.md`) documents:
- All requirements and architectural decisions
- Component and service mappings
- Generated file checklists
- Validation requirements and results
- Deployment configuration

## Location

```
project-root/
└── .azure/
    └── preparation-manifest.md
```

## Template

```markdown
# Preparation Manifest

Generated: {timestamp}
Status: {Prepared | Validated | Deployed}

---

## Project Requirements

| Attribute | Value | Notes |
|-----------|-------|-------|
| Classification | {POC/Development/Production} | |
| Scale | {Small/Medium/Large} | |
| Budget | {Cost-Optimized/Balanced/Performance} | |
| Architecture | {Containers/Serverless/Hybrid} | |
| Primary Region | {region} | |
| Availability Target | {SLA %} | |

---

## Discovery Findings

### Components Identified

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| {name} | {API/SPA/Worker/Function} | {stack} | {path} |

### Dependencies

| Component | Depends On | Connection Type |
|-----------|-----------|-----------------|
| {source} | {target} | {HTTP/Queue/Database} |

### Existing Infrastructure

| File | Status | Notes |
|------|--------|-------|
| azure.yaml | {Found/Not Found} | |
| infra/ | {Found/Not Found} | |

---

## Stack Selection

**Selected Stack**: {Containers/Serverless/Logic Apps}

**Rationale**:
- {reason 1}
- {reason 2}
- {reason 3}

---

## Azure Service Mapping

### Hosting

| Component | Service | SKU | Notes |
|-----------|---------|-----|-------|
| {component} | {service} | {sku} | |

### Data

| Service | SKU | Purpose |
|---------|-----|---------|
| {service} | {sku} | {purpose} |

### Supporting

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring |
| Key Vault | Secrets management |

---

## Implementation Plan

### Deployment Technology

- **Primary**: {azd/az CLI/Terraform/GitHub Actions}
- **CI/CD**: {GitHub Actions/Azure DevOps/None}

### Environment Strategy

| Environment | Purpose | Region |
|-------------|---------|--------|
| dev | Development | {region} |
| staging | Pre-production | {region} |
| prod | Production | {region} |

---

## IaC File Checklist

| File | Status | Notes |
|------|--------|-------|
| infra/main.bicep | {✅/⏳/❌} | |
| infra/main.parameters.json | {✅/⏳/❌} | |
| infra/modules/resources.bicep | {✅/⏳/❌} | |

---

## Docker File Checklist

| Service | Dockerfile Path | Base Image | Status |
|---------|-----------------|------------|--------|
| {service} | {path} | {image} | {✅/⏳/❌/⏭️} |

---

## azure.yaml Configuration

| Service | Host Type | Project Path | Status |
|---------|-----------|--------------|--------|
| {service} | {host} | {path} | {✅/⏳/❌} |

---

## Validation Requirements

### Pre-Deployment Checks

| Check | Required | Status |
|-------|----------|--------|
| azure.yaml schema | ✅ | {Pending/Pass/Fail} |
| Bicep compilation | ✅ | {Pending/Pass/Fail} |
| azd package | ✅ | {Pending/Pass/Fail} |
| azd provision --preview | ✅ | {Pending/Pass/Fail} |

### Issues

| Issue | Severity | Resolution | Status |
|-------|----------|------------|--------|
| {description} | {Error/Warning} | {action} | {Open/Resolved} |

---

## Deployment Status

| Environment | Status | Timestamp | Notes |
|-------------|--------|-----------|-------|
| dev | {Not Deployed/Deployed/Failed} | | |

### Deployed Resources

| Resource | Type | URL/Endpoint |
|----------|------|--------------|
| {name} | {type} | {url} |

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| {what was decided} | {why} | {when} |
```

## Skill Interactions

### Prepare Skill

1. Creates the manifest
2. Fills in: Requirements, Discovery, Stack Selection, Service Mapping
3. Completes: File Checklists, Implementation Plan
4. Sets Status: `Prepared`

### Validate Skill

1. Reads the manifest
2. Executes: Validation Requirements
3. Updates: Issues section, Check statuses
4. Sets Status: `Validated` (if all pass)

### Deploy Skill

1. Reads the manifest
2. Uses: Deployment Technology, Environment Strategy
3. Updates: Deployment Status, Deployed Resources
4. Sets Status: `Deployed`

## Best Practices

1. **Always update the manifest** after each operation
2. **Log decisions** with rationale
3. **Track all issues** until resolved
4. **Include timestamps** for traceability
5. **Keep status current** across all checklists
