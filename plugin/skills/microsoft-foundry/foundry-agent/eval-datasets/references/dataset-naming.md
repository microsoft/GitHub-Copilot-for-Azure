# Dataset Naming and Metadata Conventions

Naming conventions and required metadata for Foundry evaluation datasets. Part of the [eval-datasets skill](../eval-datasets.md).

| Dataset type | Foundry dataset name | Foundry dataset version | Typical local file | Metadata stage |
|--------------|----------------------|-------------------------|--------------------|----------------|
| Seed dataset | `<agent-name>-eval-seed` | `v1` | `.foundry/datasets/<agent-name>-eval-seed-v1.jsonl` | `seed` |
| Trace-harvested dataset | `<agent-name>-traces` | `v<N>` | `.foundry/datasets/<agent-name>-traces-v<N>.jsonl` | `traces` |
| Curated/refined dataset | `<agent-name>-curated` | `v<N>` | `.foundry/datasets/<agent-name>-curated-v<N>.jsonl` | `curated` |
| Production-ready dataset | `<agent-name>-prod` | `v<N>` | `.foundry/datasets/<agent-name>-prod-v<N>.jsonl` | `prod` |

Here `<agent-name>` means the selected environment's `environments.<env>.agentName` from the selected metadata file. If that deployed agent name already includes the environment (for example, `support-agent-dev`), do **not** append the environment key a second time.

Local dataset filenames must start with the selected Foundry agent name (`environments.<env>.agentName` in the selected metadata file). Put stage and version suffixes **after** that prefix so cache files sort and group by agent first.

Keep the Foundry dataset name stable across versions. Store the version only in `datasetVersion` (or manifest `version`) using the `v<N>` format, while local filenames keep the `-v<N>` suffix for cache readability.

Required metadata to track with every registered dataset:

- `agent`: the agent name (for example, `hosted-agent-051-001`)
- `stage`: `seed`, `traces`, `curated`, or `prod`
- `version`: version string such as `v1`, `v2`, or `v3`
- `datasetUri`: always persist the Foundry dataset URI in the selected metadata file alongside the local `datasetFile`, dataset name, and version

> **Tip:** `evaluation_dataset_create` does not expose a first-class `tags` parameter in the current MCP surface. Persist `agent`, `stage`, and `version` in local metadata (the selected metadata file plus `.foundry/datasets/manifest.json`) so Foundry-side references stay aligned with the cache.
