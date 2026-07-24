# DCR Authoring Vally Eval Suite

Integration tests for the `azure-data-collection-rules` skill using [Vally](https://aka.ms/vally).

## Quick Start

```bash
cd tests
npm run test:vally -- --skill azure-data-collection-rules
```

## Test Coverage

| Name | Area | What it tests |
|------|------|---------------|
| `trigger-syslog-filter` | routing | Skill invoked for syslog DCR request |
| `trigger-direct-ingestion` | routing | Skill invoked for direct ingestion request |
| `trigger-windows-events` | routing | Skill invoked for Windows events DCR |
| `trigger-multi-stage` | routing | Skill invoked for multi-stage transforms |
| `trigger-negative-deploy` | routing | Skill NOT invoked for app deployment |
| `trigger-negative-general` | routing | Skill NOT invoked for unrelated questions |
| `output-dcr-json-structure` | correctness | Output contains streamDeclarations, dataFlows, destinations |
| `output-kql-transform` | correctness | Output includes transformKql with proper KQL |
| `output-direct-ingestion-kind` | correctness | Output has kind: Direct, Custom- stream prefix |

## Structure

```
evals/
├── eval.yaml           # Eval spec (stimuli + graders)
├── README.md           # This file
└── fixtures/
    └── sample-logs.json  # Sample data for context
```

## Notes

- Routing tests use `earlyTerminate` on skill-call to keep runs fast (~30s each)
- Correctness tests allow up to 30 tool calls before terminating
- Negative tests verify the skill is NOT loaded for unrelated prompts
- No Azure subscription required (tests validate agent output, not real deployments)
