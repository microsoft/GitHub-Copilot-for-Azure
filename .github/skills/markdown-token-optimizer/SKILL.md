---
name: markdown-token-optimizer
description: Analyzes markdown files for token efficiency and suggests optimizations. Use when users want to reduce token count, optimize skills for AI consumption, check for token bloat, or improve markdown conciseness. Provides suggestions only - does not modify files automatically.
---

# Markdown Token Optimizer

This skill analyzes markdown files and suggests optimizations to reduce token consumption while maintaining clarity.

## When to Use

- User asks to optimize a markdown file for tokens
- User wants to reduce the size of a SKILL.md file
- User asks to check for "token bloat" or verbosity
- User wants to make documentation more concise for AI consumption
- Before submitting a new skill to verify token efficiency

## Token Estimation

This skill uses the standard estimate: **~4 characters = 1 token**

| Content | Characters | Estimated Tokens |
|---------|------------|------------------|
| 100 words | ~600 chars | ~150 tokens |
| 500 words | ~3000 chars | ~750 tokens |
| 1 page | ~4000 chars | ~1000 tokens |

## Analysis Workflow

### Step 1: Count Current Tokens

Read the target file and calculate token estimate:

```
tokens = Math.ceil(characters / 4)
```

Report: current tokens, line count, character count.

### Step 2: Identify Optimization Opportunities

Scan for these patterns (see [references/ANTI-PATTERNS.md](references/ANTI-PATTERNS.md)):

| Pattern | Token Impact | Priority |
|---------|--------------|----------|
| Decorative emojis | Low | Medium |
| Redundant headers | Medium | High |
| Verbose phrases | Medium | High |
| Inline code blocks that should be referenced | High | High |
| Repeated content | High | Critical |

### Step 3: Generate Suggestions

For each issue found, provide:

1. **Location** - Line number or section
2. **Issue** - What pattern was detected
3. **Suggestion** - How to fix it
4. **Token savings** - Estimated reduction

Format suggestions as a table:

```markdown
| Line | Issue | Suggestion | Est. Savings |
|------|-------|------------|--------------|
| 15 | Decorative emoji | Remove "🎉" prefix | 2 tokens |
| 23-45 | Long code block | Move to references/ | 150 tokens |
```

### Step 4: Provide Summary

```markdown
## Optimization Summary

**Current:** 850 tokens
**Potential:** 620 tokens
**Savings:** 230 tokens (27%)

### Top Recommendations
1. Move API reference table to `references/API.md` (-120 tokens)
2. Remove decorative emojis (-15 tokens)
3. Consolidate duplicate "Prerequisites" sections (-95 tokens)
```

## Important Notes

- **Suggest only** - Do not modify files automatically
- **Preserve meaning** - Optimizations should not reduce clarity
- **Follow spec** - Recommendations align with [agentskills.io](https://agentskills.io/specification)

## Token Limits Reference

| File Type | Soft Limit | Action |
|-----------|------------|--------|
| SKILL.md | 500 tokens | Refactor to references |
| references/*.md | 1000 tokens | Split file |
| General *.md | 2000 tokens | Review structure |

## Tools

This skill uses file reading and analysis. No MCP tools required.

## Reference Documentation

- [OPTIMIZATION-PATTERNS.md](references/OPTIMIZATION-PATTERNS.md) - Detailed optimization techniques
- [ANTI-PATTERNS.md](references/ANTI-PATTERNS.md) - Common token-wasting patterns to avoid
