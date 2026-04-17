# Java Legacy Azure SDK → Modern Azure SDK

> **Scenario scope**: Upgrade a Maven/Gradle project's Azure SDK dependencies from `com.microsoft.azure.*` (legacy, end-of-support 2023) to `com.azure.*` (modern) — source code, build files, tests.
>
> This is a **source-code modernization flow**, not an Azure service/plan/SKU upgrade. Follow the workflow below instead of the top-level `azure-upgrade` Steps. Do **NOT** use this for .NET, Python, JavaScript, or Go Azure SDK upgrades.

Upgrade all `com.microsoft.azure.*` to `com.azure.*` equivalents in one autonomous session.

## References

- [Rules and Workflow](./RULES.md) — success criteria, anti-excuse rules, workflow
- [Migration Guidelines](./INSTRUCTION.md) — package mappings, code samples, validation
- [Plan Template](../../../templates/java-legacy/PLAN_TEMPLATE.md) · [Progress Template](../../../templates/java-legacy/PROGRESS_TEMPLATE.md) · [Summary Template](../../../templates/java-legacy/SUMMARY_TEMPLATE.md)

## Workflow

1. **Precheck** — Verify Maven/Gradle project, detect JDK/build tools, create `plan.md` from [Plan Template](../../../templates/java-legacy/PLAN_TEMPLATE.md). If git available, create branch `java-upgrade/{RUN_ID}`.
2. **Plan** — Inventory deps, consult [Migration Guidelines](./INSTRUCTION.md), populate `plan.md`
3. **Execute** — Create `progress.md` from [Progress Template](../../../templates/java-legacy/PROGRESS_TEMPLATE.md), migrate build config then source, build/test/fix, commit per step
4. **Validate** — Create `summary.md` from [Summary Template](../../../templates/java-legacy/SUMMARY_TEMPLATE.md), apply [validation checklist](./INSTRUCTION.md#validation)

## Constraints

- 100% test pass · no premature termination · incremental changes · review each step
- Prefer wrappers (`mvnw`/`gradlew`) · see [Rules](./RULES.md)

## Examples

```
"upgrade legacy azure sdk" → precheck → plan → execute → validate
```

## Troubleshooting

- **Build fails**: Debug, fix, rebuild — [Rules](./RULES.md)
- **Test failures**: Iterative fix loop — [Rules](./RULES.md)
