# Scoring Criteria

Detailed scoring criteria for evaluating skill frontmatter compliance.

## Overview

Sensei evaluates skills on two dimensions:
1. **Frontmatter Compliance** - Triggers, anti-triggers, description quality
2. **Token Budget** - Staying within recommended limits

## Token Budgets

From [skill-authoring](/.github/skills/skill-authoring):

| File | Soft Limit | Hard Limit | Notes |
|------|------------|------------|-------|
| SKILL.md | 500 | 5000 | Keep lean, use references for detail |
| references/*.md | 1000 | - | Each reference file |
| Description | - | 1024 chars | Frontmatter description field |

**Check with:** `cd scripts && npm run tokens -- check plugin/skills/{skill}/SKILL.md`

### Reference Loading Impact

References load **only when explicitly linked** in SKILL.md, not on activation:
- Use `[text](references/file.md)` to trigger loading
- Each file loads in full (entire content, not sections)
- No caching between requests
- Structure with recipes/services patterns for multi-option skills

See [skill-authoring REFERENCE-LOADING.md](/.github/skills/skill-authoring/references/REFERENCE-LOADING.md) for details.

## Adherence Levels

### Low Adherence

A skill is **Low** if:
- Description is < 150 characters (too brief to be useful)
- No explicit trigger phrases in description
- No anti-triggers
- Agent cannot reliably determine when to activate

**Examples of Low-adherence descriptions:**
```yaml
# Too brief (71 chars)
description: 'Instrument a webapp to send useful telemetry data to Azure App Insights'

# No triggers (just a catalog)
description: 'Azure Security Services including Key Vault, Managed Identity, RBAC, Entra ID, and Defender.'
```

### Medium Adherence

A skill is **Medium** if:
- Description > 150 characters
- Has implicit or explicit trigger keywords
- May have "TRIGGERS:" or "Use this skill when" language
- Still missing anti-triggers

**Examples of Medium-adherence descriptions:**
```yaml
description: |
  Deploy applications to Azure using Azure Developer CLI (azd). USE THIS SKILL 
  when users want to deploy, publish, host, or run their application on Azure. 
  Trigger phrases include "deploy to Azure", "host on Azure", "publish to Azure".
```

### Medium-High Adherence (Target)

A skill is **Medium-High** if:
- Description > 150 characters
- Has explicit trigger phrases ("USE FOR:" or equivalent)
- Has anti-triggers ("DO NOT USE FOR:" or equivalent)
- May or may not have compatibility field

**Example of Medium-High adherence:**
```yaml
description: |
  Instrument web apps to send telemetry to Azure Application Insights.
  USE FOR: "add App Insights", "instrument my app", "set up monitoring".
  DO NOT USE FOR: querying logs (use azure-observability), creating alerts.
```

### High Adherence

A skill is **High** if:
- All Medium-High criteria met
- Has `compatibility` field documenting requirements
- Has examples section (optional but recommended)

**Example of High adherence:**
```yaml
description: |
  Instrument web apps to send telemetry to Azure Application Insights.
  USE FOR: "add App Insights", "instrument my app", "set up monitoring".
  DO NOT USE FOR: querying logs (use azure-observability), creating alerts.
compatibility: Supports ASP.NET Core (.NET 6+), Node.js. Requires App Insights resource.
```

---

## Rule-Based Checks

### 1. Name Validation

| Check | Pass | Fail |
|-------|------|------|
| Lowercase only | `azure-deploy` | `Azure-Deploy` |
| Hyphens allowed | `azure-cost-optimization` | `azure_cost_optimization` |
| Matches directory | `skill-name` = folder name | Mismatch |
| Length ≤ 64 | 20 chars ✓ | 65+ chars ✗ |

### 2. Description Length

| Score | Length |
|-------|--------|
| Low | < 150 chars |
| Medium | 150-250 chars |
| Medium-High | 250-500 chars |
| Ideal | 300-600 chars |
| Max | 1024 chars |

**Format Rule:** Descriptions over 200 characters MUST use multi-line YAML format (`|`) for maintainability.

### 3. Trigger Phrase Detection

**Positive indicators** (case-insensitive):
- `USE FOR:`
- `USE THIS SKILL`
- `TRIGGERS:`
- `Trigger phrases include`
- `Activate when`

**Scoring:**
- None found → Low
- Implicit (keywords in description) → Medium
- Explicit (USE FOR: list) → Medium-High

### 4. Anti-Trigger Detection

**Positive indicators** (case-insensitive):
- `DO NOT USE FOR:`
- `NOT FOR:`
- `Don't use this skill`
- `Instead use`
- `Defer to`

**Scoring:**
- None found → caps at Medium
- Present → enables Medium-High/High

### 5. Compatibility Field

**What to include:**
- Required tools (azd, az cli, Docker)
- Supported frameworks (.NET 6+, Node.js 18+)
- Required Azure resources
- Optional dependencies

**Example:**
```yaml
compatibility: |
  Requires: Azure CLI, azd CLI
  Supports: Node.js, Python, .NET, Java
  Optional: Docker (for containerized apps)
```

---

## Scoring Algorithm

```
function scoreSkill(skill):
    score = "Low"
    
    # Check description length
    if skill.description.length < 150:
        return "Low"
    
    # Check for trigger phrases
    hasTriggers = containsTriggerPhrases(skill.description)
    if hasTriggers:
        score = "Medium"
    
    # Check for anti-triggers
    hasAntiTriggers = containsAntiTriggers(skill.description)
    if hasTriggers AND hasAntiTriggers:
        score = "Medium-High"
    
    # Check for compatibility
    hasCompatibility = skill.compatibility != null
    if hasTriggers AND hasAntiTriggers AND hasCompatibility:
        score = "High"
    
    return score
```

---

## Current Audit Results

From the [frontmatter audit](https://gist.github.com/spboyer/28c31bf0cafb87489406832633aa31a7):

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Skills | 26 | 100% |
| High Adherence | 0 | 0% |
| Medium Adherence | 14 | 54% |
| Low Adherence | 12 | 46% |

### Low-Adherence Skills (Priority)

1. `appinsights-instrumentation` (71 chars - too brief)
2. `azure-diagnostics`
3. `azure-security`
4. `azure-security-hardening`
5. `azure-networking`
6. `azure-observability`
7. `azure-storage`
8. `azure-ai`
9. `azure-validation`
10. `azure-nodejs-production`
11. `entra-app-registration`
12. `azure-role-selector`

### Medium-Adherence Skills

1. `azure-deploy` (excellent triggers, missing anti-triggers)
2. `azure-create-app`
3. `azure-deployment-preflight`
4. `azure-postgres`
5. `azure-functions`
6. `azure-quick-review`
7. `azure-cost-optimization`
8. `azure-kusto`
9. `azure-keyvault-expiration-audit`
10. `azure-aigateway`
11. `azure-resource-visualizer`
12. `microsoft-foundry`
13. `skill-authoring`
14. `markdown-token-optimizer`
