# FAOS Conversion -- Apply

Implementation phase for FAOS agent optimization conversion. Part of the [FAOS Optimize skill](../faos-optimize.md).

## Step 8: Apply the Python FAOS Config Contract

Use the generic Python contract from [Python Patterns](./python-patterns.md). At minimum, add or reuse:

```python
import os

from agent_optimization import load_config

SYSTEM_PROMPT = """...existing default instructions..."""
EXISTING_MODEL_FALLBACK = os.getenv("<existing-model-env-var>", "gpt-4.1")

config = load_config(
    default_instructions=SYSTEM_PROMPT,
    default_model=EXISTING_MODEL_FALLBACK,
    default_skills_dir="skills",
)
```

Then map the selected target knobs:

- Existing default instructions -> `config.compose_instructions()`
- Existing model default -> `config.model or <existing fallback>`. Reuse the app's current model-selection environment variable(s) and fallback chain instead of hard-coding `MODEL_DEPLOYMENT_NAME` unless that is already what the app uses.
- Existing temperature/default options -> `config.temperature` only when the runtime supports it
- Skills directory -> `config.skills_dir` only when the runtime has a skill/tool loading mechanism or one is explicitly added

For multi-agent code, prefer named config variables such as `orchestrator_config`, `tool_agent_config`, or `synthesizer_config` over a misleading global `config` when more than one agent can be optimized.

## Step 9: Add or Reuse `agent_optimization`

If the agent already has an `agent_optimization` package, reuse it and avoid overwriting user changes.

If missing, add the canonical local package structure:

```text
agent_optimization/
    __init__.py
    _config.py
    _resolver.py
```

The package must expose the public API from `__init__.py`:

```python
"""Agent optimization config loader for hosted agents."""

from agent_optimization._config import OptimizationConfig, Skill, load_config

__all__ = ["OptimizationConfig", "Skill", "load_config"]
__version__ = "0.1.0"
```

Implement `_config.py` and `_resolver.py` with the reference contract:

- `load_config(...)`
- `OptimizationConfig`
- `Skill`
- graceful fallback to defaults when no optimization config is present
- environment-variable fallback support for `AGENT_OPTIMIZATION_CONFIG` and `OPTIMIZATION_CONFIG`
- optional candidate resolver support for `AGENT_OPTIMIZATION_CANDIDATE_ID` and `AGENT_OPTIMIZATION_RESOLVE_ENDPOINT`
- candidate config resolution from `{endpoint}/candidates/{candidate_id}/config`
- optional candidate skill-file download from `{endpoint}/candidates/{candidate_id}` and `{endpoint}/candidates/{candidate_id}/files?path=...`
- resolver token acquisition with `DefaultAzureCredential().get_token("https://ml.azure.com/.default")`

Do not collapse the package into a single source file when creating new conversions. The split files make the config loader and resolver easier to compare, test, and update.

Do not introduce alternate `FAOS_OPTIMIZATION_*` environment variable names in the generated package unless the user explicitly asks for a compatibility adapter. The base FAOS contract uses `AGENT_OPTIMIZATION_*` and `OPTIMIZATION_CONFIG`.

Do not assume a public PyPI package exists. Keep the local package self-contained unless the repository already uses a shared internal package.

## Step 10: Update Dependencies and Runtime Config

Update Python dependency files only as needed:

- Add `python-dotenv` if the code imports it or already uses `.env` files
- Add `azure-identity` only if resolver token support is included or already imported

Use `load_dotenv(override=False)` so Foundry runtime environment variables win over local `.env` values.

Do not automatically add optimization env vars to `agent.yaml`. Hosted agent vNext reserves platform-owned `AGENT_*` variables in deployment payloads, so `AGENT_OPTIMIZATION_*` values should come from the optimization/runtime path or local development environment, not from user-authored `agent.yaml` container variables. If the user wants env var placeholders, add only non-reserved variables required for their workflow and keep optional optimization vars documented rather than injected by default.
