# azure-prepare Waza Eval Suite

Evaluation suite for the `azure-prepare` skill using [waza](https://github.com/spboyer/waza).

## Quick Start

```bash
# Install waza (pick one)
azd ext source add -n waza -t url -l https://raw.githubusercontent.com/spboyer/waza/main/registry.json
azd ext install microsoft.azd.waza

# Or via Go
go install github.com/spboyer/waza/cmd/waza@latest

# Run with mock executor (fast, no auth)
waza run tests/azure-prepare/eval/eval.yaml \
  --context-dir tests/azure-prepare/eval/fixtures -v

# Run with real Copilot SDK (requires GITHUB_TOKEN)
waza run tests/azure-prepare/eval/eval.yaml \
  --executor copilot-sdk \
  --context-dir tests/azure-prepare/eval/fixtures -v

# Run via azd extension
azd waza run tests/azure-prepare/eval/eval.yaml -v
```

## What It Tests

| Dimension | Tasks | Coverage |
|-----------|-------|----------|
| **HTTP base selection** | http-dotnet, http-typescript, http-python | 3 languages × Bicep |
| **Full recipe (IaC + source)** | cosmosdb-dotnet-bicep, cosmosdb-ts-terraform, servicebus-dotnet | Cosmos (2 IaC), ServiceBus |
| **Source-only recipe** | timer-python, durable-dotnet, mcp-typescript | No IaC delta needed |
| **Plan-first workflow** | plan-first-enforcement | Refuses to skip planning |
| **IaC provider** | cosmosdb-ts-terraform | Terraform path vs Bicep default |

### Eval Matrix (language × integration × IaC)

```
              HTTP  CosmosDB  ServiceBus  Timer  Durable  MCP
C#/Bicep       ✅     ✅         ✅        -       ✅      -
TS/Bicep       ✅      -          -        -        -      ✅
TS/Terraform    -     ✅          -        -        -       -
Python/Bicep   ✅      -          -        ✅       -       -
```

## Graders

### Global (all tasks)
| Grader | Type | What it checks |
|--------|------|----------------|
| `has_output` | code | Response is non-empty |
| `plan_first` | regex | Mentions plan.md / planning phase |
| `security_posture` | regex | No connection strings or shared keys |
| `efficiency` | behavior | ≤40 tool calls, ≤10min duration |

### Per-task
Each task adds specific graders for template selection accuracy, recipe application, and managed identity usage.

## Structure

```
eval/
├── eval.yaml                           # Main eval spec
├── trigger_tests.yaml                  # Trigger accuracy (16 should, 10 should-not)
├── README.md                           # This file
├── tasks/                              # Individual test tasks
│   ├── http-dotnet.yaml                # HTTP base C#
│   ├── http-typescript.yaml            # HTTP base TypeScript
│   ├── http-python.yaml                # HTTP base Python
│   ├── cosmosdb-dotnet-bicep.yaml      # Cosmos recipe + Bicep
│   ├── cosmosdb-typescript-terraform.yaml  # Cosmos recipe + Terraform
│   ├── servicebus-dotnet.yaml          # ServiceBus recipe
│   ├── timer-python.yaml              # Timer (source-only)
│   ├── durable-dotnet.yaml            # Durable (source-only)
│   ├── mcp-typescript.yaml            # MCP (source-only)
│   └── plan-first-enforcement.yaml    # Workflow compliance
└── fixtures/                           # Sample project files
    ├── python-http/                    # Python HTTP app
    ├── dotnet-http/                    # C# HTTP app
    ├── typescript-http/                # TypeScript HTTP app
    └── dotnet-cosmosdb/                # C# Cosmos DB app
```

## Relationship to Jest Tests

This repo has **two eval modes** that complement each other:

| | Jest (`npm test`) | Waza (`waza run`) |
|---|---|---|
| **Runner** | Jest + @github/copilot-sdk | Waza CLI (Go) |
| **Speed** | Fast for unit/trigger, slow for integration | Mock executor = fast, copilot-sdk = slow |
| **Auth** | Copilot SDK for integration tests | Mock needs none, copilot-sdk needs GITHUB_TOKEN |
| **Graders** | Custom JS assertions | YAML-defined (regex, code, behavior, file, action_sequence) |
| **CI** | `npm run test:ci` | `waza run eval.yaml` (exit code 0/1/2) |
| **Best for** | Skill metadata validation, trigger matching | Template selection accuracy, composable recipe correctness |
| **Compare** | N/A | `waza compare results-a.json results-b.json` |
| **Cache** | N/A | `--cache` flag for repeated runs |

**Recommendation**: Use Jest for fast unit/trigger tests in CI. Use waza for template selection evals and model comparison benchmarks.

## Hybrid Eval Model

This repo uses a **hybrid** approach for waza evals:

| Mode | Skills | How it works |
|------|--------|-------------|
| **Committed** (⬢) | azure-prepare | Hand-authored `eval/` dir in `tests/{skill}/eval/`. Custom graders, fixtures, assertions specific to the skill's domain. |
| **Generated** (⬡) | All other skills | Auto-generated at runtime via `waza generate plugin/skills/{skill}/SKILL.md`. Generic trigger + invocation tests. |

**When to commit vs. generate:**
- **Commit** when the skill has domain-specific correctness criteria (e.g., must select the right template, must use RBAC not keys, must enforce plan-first workflow)
- **Generate** when basic invocation + trigger accuracy testing is sufficient

To promote a generated eval to committed:
```bash
# Generate into the test directory
waza generate plugin/skills/azure-deploy/SKILL.md -d tests/azure-deploy/eval

# Customize the generated files, then commit
git add tests/azure-deploy/eval/
```
