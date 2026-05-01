# Routing Analysis

Skill routing depends on the TriggerMatcher. It extracts keywords from a skill's `name` and `description`, may add Azure service keywords when those services appear anywhere in the SKILL.md body content, and fires when a user prompt matches ≥2 keywords or ≥20% keyword confidence. This makes trigger phrase specificity critical.

## How TriggerMatcher Works

1. Extracts words with ≥3 characters from skill `name` and words with ≥4 characters from `description`, plus the word `ai`
2. Adds Azure service keywords when those services appear anywhere in the SKILL.md body content (not just name/description)
3. Matches are substring-based against the user prompt
4. Triggers if: ≥2 keyword matches OR ≥20% of keywords match (`matchedKeywords.length / keywords.length`)

## Conflict Detection Steps

For each trigger phrase in the new/modified skill:

1. **Load existing skills** — Read `tests/skills.json` for the full skill list
2. **Compare keyword sources** — Check overlaps from skill names, descriptions, and content-derived Azure service keywords
3. **Flag conflicts** where the new skill's trigger phrases appear in another skill's description

### Common Conflict Patterns

| Pattern | Risk | Example |
|---------|------|---------|
| Generic action + Azure service | High | "deploy to Azure Container Apps" conflicts with azure-prepare |
| Migration without source qualifier | High | "migrate from GCP" conflicts with azure-cloud-migrate |
| Generic "create" or "build" phrases | Medium | "create API" conflicts with azure-prepare |
| Overlapping modernize language | Medium | "modernize application" owned by azure-prepare |

## Resolution Strategies

### 1. Scope trigger phrases to skill-specific domain

```yaml
# Bad — too generic
WHEN: "migrate from GCP", "assess Google Cloud migration"

# Good — domain-specific
WHEN: "migrate Cloud Run to Container Apps", "convert Cloud Run services to ACA"
```

### 2. Add DO NOT USE FOR when disambiguation-critical

Only when a specialized skill shares triggers with a broader skill:

```yaml
description: "... DO NOT USE FOR: general GCP-to-Azure migration (use azure-cloud-migrate), new Container Apps without migration (use azure-prepare)."
```

### 3. Verify with integration tests

After changes, run:
```bash
cd tests && npm test -- --testPathPatterns={skill-name}
```

## Known Broad Skills (High Overlap Risk)

These skills own many generic phrases. New skills must avoid conflicting with them:

| Skill | Owns These Phrases |
|-------|--------------------|
| `azure-prepare` | create app, build web app, create API, deploy to Azure *, modernize, host on Azure, generate Bicep/Terraform |
| `azure-cloud-migrate` | migrate from AWS/GCP, cross-cloud migration, migration readiness |
| `azure-deploy` | run azd up/deploy, execute deployment, push to production, ship it |
| `azure-diagnostics` | debug, troubleshoot, analyze logs, root cause |
| `azure-cost` | optimize costs, reduce spending, cost savings, cost report |

Check the new skill's triggers against this table. Any overlap must be scoped more specifically or use a `DO NOT USE FOR` clause.
