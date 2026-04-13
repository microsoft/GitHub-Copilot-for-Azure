---
name: azure-java-legacy-sdk-migration
description: 'Upgrade legacy Azure Java SDKs (com.microsoft.azure) to modern Azure SDKs (com.azure) with structured planning and execution. WHEN: "migrate legacy Azure SDKs for Java", "migrate legacy Azure Java SDK", "upgrade legacy Azure SDKs for Java", "upgrade legacy Azure Java SDK". DO NOT USE FOR: "migrate azure sdk for .NET/Python/JavaScript/Go", "upgrade azure sdk for .NET/Python/JavaScript/Go".'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

Upgrade all `com.microsoft.azure.*` to `com.azure.*` equivalents in one autonomous session.

## References

- [Rules and Workflow](./references/RULES.md) — success criteria, anti-excuse rules, workflow
- [Migration Guidelines](./references/INSTRUCTION.md) — package mappings, code samples, validation
- [Plan Template](./templates/PLAN_TEMPLATE.md) · [Progress Template](./templates/PROGRESS_TEMPLATE.md) · [Summary Template](./templates/SUMMARY_TEMPLATE.md)

## Workflow

1. **Precheck** — Verify Maven/Gradle project, detect JDK/build tools, create `plan.md` from [Plan Template](./templates/PLAN_TEMPLATE.md). If git available, create branch `java-upgrade/{RUN_ID}`.
2. **Plan** — Inventory deps, consult [Migration Guidelines](./references/INSTRUCTION.md), populate `plan.md`
3. **Execute** — Create `progress.md` from [Progress Template](./templates/PROGRESS_TEMPLATE.md), migrate build config then source, build/test/fix, commit per step
4. **Validate** — Create `summary.md` from [Summary Template](./templates/SUMMARY_TEMPLATE.md), apply [validation checklist](./references/INSTRUCTION.md#validation)

## Constraints

- 100% test pass · no premature termination · incremental changes · review each step
- Prefer wrappers (`mvnw`/`gradlew`) · see [Rules](./references/RULES.md)

## Examples

```
"upgrade legacy azure sdk" → precheck → plan → execute → validate
```

## Troubleshooting

- **Build fails**: Debug, fix, rebuild — [Rules](./references/RULES.md)
- **Test failures**: Iterative fix loop — [Rules](./references/RULES.md)
