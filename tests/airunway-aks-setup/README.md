# airunway-aks-setup Tests

Tests for the `airunway-aks-setup` skill, which walks users from a bare AKS cluster to a running AI model deployment.

## Quick Start

```bash
# Run all tests (integration skips if SDK unavailable)
npm test -- --testPathPatterns=airunway-aks-setup

# Unit and trigger tests only
SKIP_INTEGRATION_TESTS=true npm test -- --testPathPatterns=airunway-aks-setup

# Update snapshots after intentional description/keyword changes
npm run update:snapshots -- --testPathPatterns=airunway-aks-setup
```

## File Structure

```
airunway-aks-setup/
├── triggers.test.ts      # Skill activation / non-activation tests
├── integration.test.ts   # Real Copilot agent tests (requires SDK auth)
├── __snapshots__/
│   └── triggers.test.ts.snap
└── fixtures/
    └── sample.json       # Sample prompts and expected output shapes
```

## Test Coverage

| File | What it covers |
|------|----------------|
| `triggers.test.ts` | Direct AI Runway prompts, intent-based GPU/LLM prompts, negative cases (wrong cloud, wrong domain), edge cases |
| `integration.test.ts` | Skill invocation rate, controller install guidance, GPU assessment response, model recommendation, ModelDeployment CR, kubeconfig workspace setup |

See `/tests/AGENTS.md` for complete testing patterns and guidelines.
