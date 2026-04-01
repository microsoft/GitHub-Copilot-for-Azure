# Pass Equity Grading Methodology

## Azure Compute Skills — Assessment Framework

| Property | Value |
|----------|-------|
| **Version** | 1.0.0 |
| **Last Updated** | 2026-04-01 |
| **Status** | Draft — Awaiting Domain Expert Calibration |
| **Scope** | App Service, Container Apps, Functions |
| **Audience** | Domain experts, partner teams, skill authors |

---

## 1. Introduction & Purpose

**Pass equity** measures whether each Azure compute service receives comparable skill coverage across the developer lifecycle. When a developer asks Copilot for help deploying to Container Apps, they should get the same quality of guidance as someone deploying to App Service or Functions.

This document defines the grading framework, presents the current scorecard with reproducible evidence, and invites domain experts to calibrate and contribute. It is a **starting assessment** — grades reflect what the repo contains today, not what the services deserve. Every grade is backed by file counts, test counts, and trigger-phrase inventories that anyone can reproduce.

**Who should read this:**

- **Service PMs** — to validate grades for their compute service
- **Skill authors** — to understand what "A-level" coverage looks like
- **Partner teams** — to identify collaboration opportunities
- **Reviewers** — to hold PRs accountable to equity standards

---

## 2. Grading Framework — 7 Lifecycle Phases

Each compute service is graded across seven phases of the developer lifecycle:

| # | Phase | What It Covers |
|---|-------|---------------|
| 1 | **Develop** | Scaffolding, code generation, templates, recipes, multi-language support |
| 2 | **Deploy** | IaC generation (Bicep/Terraform), `azure.yaml`, Dockerfile, `azd` workflow |
| 3 | **Operate** | Configuration management, scaling, deployment slots/revisions, day-2 ops |
| 4 | **Diagnose** | Troubleshooting guides, error pattern tables, KQL queries, MCP tool usage |
| 5 | **Migrate** | Cross-cloud migration guides, assessment templates, service mappings |
| 6 | **Observe** | App Insights instrumentation, telemetry setup, ARG queries, KQL libraries |
| 7 | **Secure** | RBAC, compliance, identity, Key Vault integration |

> 💡 **Tip:** Deploy and Secure are often *horizontal* skills (shared across services). They are included for completeness but may be excluded from the composite service grade when they don't differentiate.

---

## 3. Grading Scale (A–F)

Each grade has concrete, measurable criteria:

### A (Excellent) — Complete Coverage

- Dedicated reference docs with scenarios and code examples (**5+ files**)
- Multi-language support (**3+ languages** where applicable)
- Composition algorithm or decision tree for complex scenarios
- Integration tests validating the skill (**2+ tests**)
- Service-specific trigger phrases in skill description
- *Example:* Functions Develop — 108 reference files, 6 languages, composition algorithm, recipe system

### B+ (Good) — Strong but Incomplete

- Reference docs exist with good detail (**3–4 files**)
- Some language coverage
- Integration tests exist (**1–2**)
- Minor gaps in edge cases or advanced scenarios
- *Example:* App Service Operate — scaling + deployment-slots docs, but no SKU guide or networking reference

### B (Adequate) — Functional but Gaps Visible

- Reference docs exist but are limited (**1–2 files**)
- Generic coverage, not service-specific
- Tests may exist but don't cover this specific capability
- *Example:* Functions Diagnose — 1 README with ARG queries, but no trigger-specific troubleshooting guide

### C (Minimal) — Basic Presence Only

- Service is mentioned in shared/horizontal skills
- No dedicated reference docs or templates for this phase
- Falls back to generic patterns
- *Example:* Container Apps Develop — 5 infra reference files but zero code templates or recipes

### D (Poor) — Negligible

- Mentioned in trigger phrases only
- No reference docs, no tests, no workflows
- *Currently no service at this grade*

### F (Missing) — Zero Coverage

- No reference docs, no triggers, no tests, no mention
- Developer gets no guidance for this scenario
- *Example:* App Service Migrate — zero files before pass-equity work began

---

## 4. Scoring Methodology

### 4.1 Dimension Weights

Each phase grade is a weighted composite of five dimensions:

| Dimension | Weight | How Measured |
|-----------|--------|--------------|
| Reference docs depth | 30% | File count, line count, scenario coverage |
| Code examples / templates | 20% | Language count, recipe count, composition algorithm presence |
| Integration test coverage | 20% | Test definition count, scenario breadth |
| Trigger phrase coverage | 15% | Dedicated phrases in SKILL.md, routing rules |
| MCP tool integration | 15% | Service-specific MCP commands available |

### 4.2 Phase Grade Formula

```
Phase Grade = Σ (dimension_score × dimension_weight)
```

Each dimension is scored 0–4 (mapping to F=0, D=1, C=2, B=3, B+=3.5, A=4), then the weighted average maps back to a letter grade.

### 4.3 Service Grade Formula

```
Service Grade = mean(phase_grades)
```

> 💡 **Tip:** Deploy and Secure may be excluded from the composite when they are equitable across services (i.e., they don't differentiate). The scorecard notes when this exclusion applies.

---

## 5. Current Scorecard

### 5.1 Summary Table

| Phase | App Service | Container Apps | Functions |
|-------|:-----------:|:--------------:|:---------:|
| **Develop** | B | C | A |
| **Deploy** | B+ | B+ | B+ |
| **Operate** | B+ | B | B |
| **Diagnose** | B | B | B+ |
| **Migrate** | B+ | B | A |
| **Observe** | C | B | B |
| **Secure** | B | B | B |

### 5.2 Evidence by Phase

#### Develop

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Reference files | 18 files in `azure-prepare/references/services/appservice/` | 23 files in `azure-prepare/references/services/containerapps/` | 108 files in `azure-prepare/references/services/functions/` |
| Code templates | Limited language-specific templates | Infrastructure-focused references, zero code recipes | Full recipe system, 6 languages, composition algorithm |
| Integration tests | 4 test definitions | 2 test definitions | 2 test definitions (+ additional scenario refs) |
| Trigger phrases | General `azure-prepare` phrases apply | General `azure-prepare` phrases apply | General `azure-prepare` phrases apply |
| MCP tools | 1 (`mcp_azure_mcp_appservice`) | 0 | 0 |
| **Grade** | **B** — Good file count but lacks Functions-level recipe depth | **C** — File count inflated by infra refs; no code templates | **A** — Dominant coverage across all dimensions |

#### Deploy

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Notes | Shared `azure-deploy` skill covers all three services equitably via `azd up` / `azd deploy` workflows. IaC generation (Bicep/Terraform) handled by `azure-prepare`. |
| **Grade** | **B+** | **B+** | **B+** |

> 💡 **Tip:** Deploy is a horizontal skill. Grades are equitable and excluded from the differentiating composite.

#### Operate

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Reference docs | Scaling, deployment slots, configuration | Revision management, scaling rules | Trigger configuration, host settings |
| MCP tools | 1 dedicated tool | 0 dedicated tools | 0 dedicated tools |
| Gaps | No SKU guide or networking reference | No dedicated MCP tool for revision management | No dedicated MCP tool |
| **Grade** | **B+** — MCP tool gives operational edge | **B** — Adequate but no MCP tooling | **B** — Adequate but no MCP tooling |

#### Diagnose

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Diagnostic files | 1 file in `azure-diagnostics/references/` | 1 file in `azure-diagnostics/references/` | 3 files in `azure-diagnostics/references/` |
| Error patterns | Shared KQL/ARG queries | Shared KQL/ARG queries | Additional trigger-specific patterns |
| Integration tests | Covered by general diagnostic tests | Covered by general diagnostic tests | Covered by general diagnostic tests |
| **Grade** | **B** — 1 file, relies on shared patterns | **B** — 1 file, relies on shared patterns | **B+** — 3× the diagnostic depth |

#### Migrate

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Migration files | 6 files in `azure-cloud-migrate/references/services/appservice/` | 5 files in `azure-cloud-migrate/references/services/containerapps/` | 10 files in `azure-cloud-migrate/references/services/functions/` |
| Trigger phrases | 6 dedicated phrases | 0 dedicated phrases | 1 dedicated phrase |
| General phrases | 8 shared migration phrases apply to all | 8 shared migration phrases apply to all | 8 shared migration phrases apply to all |
| Gaps | Solid coverage | No dedicated trigger phrases for discoverability | Strong file depth but only 1 trigger phrase |
| **Grade** | **B+** — Good file count + strong trigger presence | **B** — Reasonable files but zero dedicated triggers | **A** — Highest file count, broad scenario coverage |

#### Observe

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Service-specific files | 0 dedicated files (integrated within language files) | 1 dedicated file | 1 dedicated file |
| Shared files | 4 shared language/auto-instrumentation files | 4 shared language/auto-instrumentation files | 4 shared language/auto-instrumentation files |
| Gaps | No dedicated instrumentation file | Adequate | Adequate |
| **Grade** | **C** — Relies entirely on shared files | **B** — Has dedicated service file | **B** — Has dedicated service file |

#### Secure

| Dimension | App Service | Container Apps | Functions |
|-----------|-------------|----------------|-----------|
| Notes | Shared horizontal skills (`azure-rbac`, `azure-compliance`) cover all services. No service-specific differentiation observed. |
| **Grade** | **B** | **B** | **B** |

> 💡 **Tip:** Secure is a horizontal skill. Grades are equitable and excluded from the differentiating composite.

### 5.3 Composite Scores (Differentiating Phases Only)

Excluding Deploy and Secure (equitable horizontal skills):

| Service | Develop | Operate | Diagnose | Migrate | Observe | **Composite** |
|---------|:-------:|:-------:|:--------:|:-------:|:-------:|:--------------:|
| App Service | B | B+ | B | B+ | C | **B** |
| Container Apps | C | B | B | B | B | **B−** |
| Functions | A | B | B+ | A | B | **B+** |

---

## 6. How to Reproduce This Assessment

Anyone can verify these grades by running the following commands from the repo root.

### Step 1: Clone the Repository

```bash
git clone <repo-url> && cd GitHub-Copilot-for-Azure
```

### Step 2: Count Reference Files (azure-prepare)

```bash
for svc in appservice containerapps functions; do
  echo "$svc: $(find plugin/skills/azure-prepare/references/services/$svc/ -type f 2>/dev/null | wc -l) files"
done
```

Expected: App Service=18, Container Apps=23, Functions=108

### Step 3: Count Integration Tests

```bash
for svc in appservice containerapps functions; do
  echo "$svc: $(grep -rl "$svc" tests/ --include='*.test.ts' 2>/dev/null | wc -l) test files"
done
```

Expected: App Service=4, Container Apps=2, Functions=2

### Step 4: Count Diagnostic References

```bash
for svc in appservice containerapps functions; do
  echo "$svc: $(find plugin/skills/azure-diagnostics/references/$svc/ -type f 2>/dev/null | wc -l) files"
done
```

Expected: App Service=1, Container Apps=1, Functions=3

### Step 5: Count Migration References

```bash
for svc in appservice containerapps functions; do
  echo "$svc: $(find plugin/skills/azure-cloud-migrate/references/services/$svc/ -type f 2>/dev/null | wc -l) files"
done
```

Expected: App Service=6, Container Apps=5, Functions=10

### Step 6: Count Observability References

```bash
find plugin/skills/appinsights-instrumentation/references/ -type f | head -20
```

Look for service-specific vs. shared language files.

### Step 7: Count Trigger Phrases

```bash
grep -c "app service\|appservice" plugin/skills/azure-cloud-migrate/SKILL.md
grep -c "functions\|function app" plugin/skills/azure-cloud-migrate/SKILL.md
grep -c "container apps\|containerapps" plugin/skills/azure-cloud-migrate/SKILL.md
```

### Step 8: Count MCP Tools per Service

```bash
grep -r "mcp_azure_mcp_appservice" plugin/skills/ --include='*.md' -l | wc -l
grep -r "mcp_azure_mcp_containerapps" plugin/skills/ --include='*.md' -l | wc -l
grep -r "mcp_azure_mcp_functions" plugin/skills/ --include='*.md' -l | wc -l
```

---

## 7. How Domain Experts Should Contribute

### Review Process

1. **Locate your service** in the scorecard (§5)
2. **Verify the evidence** using the reproduction steps (§6)
3. **Challenge any grade** you disagree with — provide counter-evidence (file paths, test names, or capability descriptions we missed)
4. **Propose improvements** — identify missing scenarios, reference docs, or trigger phrases
5. **File sub-issues** against the parent tracking issue (#1608)
6. **Submit PRs** to the `pass-equity` branch

### What Makes a Strong Challenge

| ✅ Strong | ❌ Weak |
|-----------|---------|
| "Grade should be B+ because `references/aca-scaling.md` covers 4 scaling scenarios" | "I think Container Apps should be higher" |
| "Missing trigger phrase: 'migrate Spring Boot to Container Apps'" | "We need more migration content" |
| "Test `aca-deploy.test.ts` line 42 covers this scenario" | "We have tests somewhere" |

### Contribution Checklist

- [ ] Reference doc added to `plugin/skills/<skill>/references/`
- [ ] Trigger phrases updated in `plugin/skills/<skill>/SKILL.md` frontmatter
- [ ] Integration test added or updated in `tests/`
- [ ] Scorecard re-assessed with updated counts

---

## 8. Appendix: Raw Data Tables

### A. Reference File Counts by Skill

| Skill | App Service | Container Apps | Functions |
|-------|:-----------:|:--------------:|:---------:|
| azure-prepare | 18 | 23 | 108 |
| azure-diagnostics | 1 | 1 | 3 |
| azure-cloud-migrate | 6 | 5 | 10 |
| appinsights-instrumentation | 0 dedicated | 1 dedicated | 1 dedicated |
| **Total dedicated** | **25** | **30** | **122** |

### B. Integration Test Definitions

| Service | Test Count | Notes |
|---------|:----------:|-------|
| App Service | 4 | Broadest test coverage relative to file count |
| Container Apps | 2 | Minimal test definitions |
| Functions | 2 | Low count but additional scenario references exist |

### C. Migration Trigger Phrases

| Category | Count | Examples |
|----------|:-----:|---------|
| App Service–specific | 6 | Service-specific migration phrases in SKILL.md |
| Functions-specific | 1 | Single dedicated phrase |
| Container Apps–specific | 0 | No dedicated phrases — relies on general triggers |
| General (all services) | 8 | Shared migration trigger phrases |

### D. MCP Tool Availability

| Service | Dedicated MCP Tool | Tool Name |
|---------|:------------------:|-----------|
| App Service | ✅ | `mcp_azure_mcp_appservice` |
| Container Apps | ❌ | — |
| Functions | ❌ | — |

### E. Key Equity Gaps

| Gap | Affected Service | Phase | Severity |
|-----|-----------------|-------|----------|
| No code templates or recipes | Container Apps | Develop | High |
| No dedicated MCP tool | Container Apps, Functions | Operate | Medium |
| Zero dedicated migration triggers | Container Apps | Migrate | High |
| No dedicated observability file | App Service | Observe | Medium |
| Low diagnostic file count | App Service, Container Apps | Diagnose | Low |

---

*This document is maintained as part of the pass-equity initiative. For questions, see issue #1608 or contact the skill authoring team.*
