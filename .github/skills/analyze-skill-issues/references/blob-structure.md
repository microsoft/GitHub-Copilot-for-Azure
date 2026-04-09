# Blob Structure Reference

## Skill Name Mapping

| User says | Skill directory name |
|-----------|----------------------|
| azure-foundry, foundry, microsoft-foundry | `microsoft-foundry` |
| azure-deploy, deploy | `azure-deploy` |
| azure-prepare, prepare | `azure-prepare` |
| azure-validate, validate | `azure-validate` |
| azure-ai, ai | `azure-ai` |
| azure-compute, compute | `azure-compute` |
| azure-cost, cost | `azure-cost` |
| azure-diagnostics, diagnostics | `azure-diagnostics` |
| azure-kubernetes, kubernetes, aks | `azure-kubernetes` |
| azure-kusto, kusto | `azure-kusto` |
| azure-storage, storage | `azure-storage` |
| azure-rbac, rbac | `azure-rbac` |
| (any other name) | use as-is |

## Blob Path Layout

```
integration-reports/
└── {yyyy-mm-dd}/
    └── {run_id}/
        └── {skill_name}/             ← non-azure-deploy skills
            ├── <file>.json            ← top-level test files
            └── {test_name}/
                └── <file>.json        ← per-test result files
        └── azure-deploy/              ← azure-deploy only
            └── {group_name}/
                ├── <file>.json
                └── {test_name}/
                    └── <file>.json
```
