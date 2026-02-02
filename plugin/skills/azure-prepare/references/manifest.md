# Preparation Manifest

Document all decisions in `.azure/preparation-manifest.md`.

## Template

```markdown
# Preparation Manifest

Generated: {timestamp}
Status: Prepared | Validated | Deployed

---

## Requirements

| Attribute | Value |
|-----------|-------|
| Classification | POC / Development / Production |
| Scale | Small / Medium / Large |
| Budget | Cost-Optimized / Balanced / Performance |
| **Subscription** | {subscription-name-or-id} |
| **Location** | {azure-region} |

> **Note**: Subscription and Location MUST be confirmed by the user before provisioning. Do NOT proceed to azure-deploy without these values.

---

## Components

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| {name} | API / SPA / Worker | {stack} | {path} |

---

## Recipe

**Selected:** AZD / AZCLI / Bicep / Terraform

**Rationale:** {why this recipe}

---

## Architecture

**Stack:** Containers / Serverless / App Service

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| {component} | {service} | {sku} |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Logging |
| Application Insights | Monitoring |
| Key Vault | Secrets |

---

## Generated Files

| File | Status |
|------|--------|
| infra/main.bicep | ✅ |
| azure.yaml | ✅ |
| src/api/Dockerfile | ✅ |

---

## Validation

| Check | Status |
|-------|--------|
| Bicep compiles | ⏳ |
| No hardcoded secrets | ⏳ |
| Health endpoints | ⏳ |

---

## Next Steps

1. Run azure-validate
2. Deploy with selected recipe
```

## Update Progressively

Update manifest after each phase—do not wait until the end.
