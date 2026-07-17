---
name: sensei
description: "Iteratively improve skill frontmatter to achieve good routing test coverage. WHEN: run sensei, sensei help, improve skill routing"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.6"
---

## Help

When user says "sensei help" or asks how to use sensei, show this:

```
╔══════════════════════════════════════════════════════════════════╗
║  SENSEI - Skill Frontmatter Compliance Improver                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  USAGE:                                                          ║
║    Run sensei on <skill-name>              # Single skill        ║
║    Run sensei on <skill1>, <skill2>, ...   # Multiple skills     ║
║    Run sensei on all skills                # All skills          ║
║                                                                  ║
║  EXAMPLES:                                                       ║
║    Run sensei on appinsights-instrumentation                     ║
║    Run sensei on azure-ai, azure-compute                         ║
║                                                                  ║
║  WHAT IT DOES:                                                   ║
║    1. READ      - Load skill's SKILL.md and tests                ║
║    2. VERIFY    - Compare skill frontmatter with convention      ║
║    3. SCAFFOLD  - Create tests from frontmatter if missing       ║
║    4. IMPROVE   - Add WHEN: triggers                             ║
║    5. TEST      - Run tests, fix if needed                       ║
║    6. SUMMARY   - Show before/after with suggestions             ║
║    7. PROMPT    - Ask: Commit, Create Issue, or Skip?            ║
║    8. REPEAT    - Until routing tests pass                       ║
╚══════════════════════════════════════════════════════════════════╝
```

## Main Loop

For each skill, execute this loop until the frontmatter aligns with convention, have thorough routing tests AND routing tests pass:

1. **READ** - Load `plugin/skills/{skill-name}/SKILL.md`, and vally eval suites in `evals/{skill-name}/*.yaml`.
2. **VERIFY** - Compare the skill frontmatter with conventions in [CONVENTIONS](references/CONVENTIONS.md). If the skill's frontmatter violates any written convention, notify the user and propose a fix to align the frontmatter with the convention.
3. **SCAFFOLD** - If `evals/{skill-name}/` doesn't exist, follow instructions in `vally-eval` skill to scaffold a set of routing tests. The routing tests test if the skill can be invoked for target user prompts. Generate user prompts that match the target scenario of the skill's description.
4. **IMPROVE** - If the skill description doesn't already have WHEN: triggers, add them.
5. **TEST** - Follow instructions in `vally-eval` skill to run the routing tests. If there are failed tests, suggest fixes.
6. **SUMMARY** - Display before/after comparison with unimplemented suggestions.
7. **PROMPT** - Ask user to commit the fixes or take any alternative actions.
8. **REPEAT** - Go to step 2 (max 5 iterations per skill)

## Constraints

- Only modify `plugin/skills/` - these are the Azure skills used by Copilot
- Files in `.github/skills/` should be left as is
- Max 5 iterations per skill before moving on

## Related Skills

- [vally-eval](/.github/skills/vally-eval) - vally eval suite writing guidelines
