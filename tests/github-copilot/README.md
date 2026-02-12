# github-copilot Skill Tests

Tests for the `github-copilot` skill which handles Copilot SDK and Copilot Extensions workflows.

## Running Tests

```bash
npm test -- --testPathPattern=github-copilot
```

## Test Files

- `unit.test.ts` — Skill metadata, content, and frontmatter validation
- `triggers.test.ts` — Skill activation and anti-trigger tests
- `integration.test.ts` — Real agent session tests (requires Copilot CLI auth)
