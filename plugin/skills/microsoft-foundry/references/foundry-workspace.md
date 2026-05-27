# .foundry Workspace Standard

Every agent source folder should keep Foundry-specific state under `.foundry/`:

```text
<agent-root>/
  .foundry/
    agent-metadata.yaml
    agent-metadata.prod.yaml
    datasets/
    evaluators/
    results/
```

- `agent-metadata.yaml` is the preferred local/dev metadata file. Optional sidecar files such as `agent-metadata.prod.yaml` can hold a single prod or CI-targeted environment without mixing multiple environments in one file.
- `datasets/` and `evaluators/` are local cache folders. Reuse them when they are current, and ask before refreshing or overwriting them.
- See [Agent Metadata Contract](agent-metadata-contract.md) for the canonical schema and workflow rules.

## Agent Types

All agent skills support two agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment |
| **Hosted** | `"hosted"` | Container-based agents running custom code |

Use `agent_get` MCP tool to determine an agent's type when needed.

## Setup References

- [Standard Agent Setup](standard-agent-setup.md) -- Standard capability-host setup with customer-managed data, search, and AI Services resources.
