# Skills Test Suite

This test area is in transition.

## Current Direction

The Jest-based skill test framework in this folder is legacy and deprecated for new work.

All new test authoring must use Vally eval suites under [../evals](../evals).

Use [AGENTS.md](./AGENTS.md) as the primary guide for how to create, update, and run Vally tests in this repository.

## What Is Deprecated

The following Jest patterns remain in the repo for existing coverage and historical compatibility, but should not be used when adding new test scenarios:

- Trigger tests in skill folders such as triggers.test.ts
- Integration tests in skill folders such as integration.test.ts
- New test scaffolding based on tests/_template

If you need to change existing legacy Jest tests, keep changes minimal and do not use them as the pattern for new coverage.

## Where New Tests Go

Add new test coverage as Vally eval suites in [../evals](../evals).

Typical locations:

- Skill-specific suite: [../evals](../evals)/\<skill-name\>/eval.yaml
- Shared building blocks: [../evals/_base](../evals/_base)

## Authoring and Running Vally Tests

For step-by-step instructions, command usage, conventions, and repository-specific patterns, follow [AGENTS.md](./AGENTS.md).

That file is the source of truth for:

- Creating new Vally test suites
- Updating existing Vally tests
- Running Vally tests locally
- Debugging and iterating on evals

## Quick Notes

- Build output before validation if your workflow depends on generated plugin output.
- Keep test intent explicit and assertions focused on observable behavior.
- Prefer extending existing eval suites over creating redundant new files.

## Related References

- Vally eval suites: [../evals](../evals)
- Vally migration context: [../evals/README.md](../evals/README.md)
- Test authoring guide: [AGENTS.md](./AGENTS.md)
