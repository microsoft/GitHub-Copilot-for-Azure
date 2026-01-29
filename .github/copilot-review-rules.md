# Copilot Code Review Rules

## Auto-generated PRs

For PRs with titles starting with `docs:` that update coverage grids or documentation:

### Review Criteria

1. **Accuracy**: Verify the coverage grid reflects actual test files
2. **Formatting**: Ensure markdown tables are properly formatted
3. **No Regressions**: Coverage should not decrease without explanation

### Auto-Approve Conditions

PRs updating `tests/README.md` coverage grid can be auto-approved if:
- Only `tests/README.md` is modified
- Changes are limited to the coverage grid table
- No test files were deleted

## General Review Guidelines

- Focus on correctness over style
- Verify links and references are valid
- Check for accidental credential exposure
