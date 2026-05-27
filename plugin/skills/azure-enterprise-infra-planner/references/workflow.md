# Workflow

## Mandatory Rules

- You must execute the seven phases in sequential order. Follow the instructions precisely as defined. Do not continue to the next phase until the current phase is complete.
- You must stop on all "gate" conditions and only continue when the conditions have been met.
- Destructive actions require explicit user confirmation.
- You must read each phase's reference file in full before executing it.
- Never assume knowledge and cut corners or skip research steps.

## Overview

Execute the six phases sequentially. Do not begin a phase until the previous phase's gate has been met.

| Phase | Action | Reference | Key Gate |
|-------|--------|-----------|----------|
| 1 | Research best practices | [1-research-best-practices.md](phases/1-research-best-practices.md) | All MCP tool calls complete and WAF guides summarized |
| 2 | Research resources | [2-research-resources.md](phases/2-research-resources.md) | All resources have ARM type, naming rules, and pairing constraints; user approves resource list |
| 3 | Generate plan | [3-generate-plan.md](phases/3-generate-plan.md) | Plan JSON written to disk |
| 4 | Verify plan | [4-verify.md](phases/4-verify.md) | All checks pass, user approves |
| 5 | Generate IaC | [5-generate-iac.md](phases/5-generate-iac.md) | All IaC files generated and saved to disk |
| 6 | Deploy to Azure | [6-deploy.md](phases/6-deploy.md) | User confirms destructive actions |

## Plan Status Lifecycle

`draft` → `approved` → `deployed`

- `draft` — set by Phase 3 when the plan is written.
- `approved` — set by Phase 4 only after the user explicitly approves. Required before Phase 5 and Phase 6.
- `deployed` — set by Phase 6 after a successful `az deployment ... create` or `terraform apply`.

## Outputs

| Artifact | Location |
|----------|----------|
| Infrastructure Plan | `<project-root>/.azure/infrastructure-plan.json` |
| Bicep files | `<project-root>/infra/main.bicep`, `<project-root>/infra/modules/*.bicep` |
| Terraform files | `<project-root>/infra/main.tf`, `<project-root>/infra/modules/**/*.tf` |

Before writing any `.bicep` or `.tf` files in Phase 5:

1. Create the `infra/` directory at `<project-root>/infra/`.
2. Create `infra/modules/` for child modules.
3. Write `main.bicep` (or `main.tf`) inside `infra/`, not in the project root or `.azure/`.
