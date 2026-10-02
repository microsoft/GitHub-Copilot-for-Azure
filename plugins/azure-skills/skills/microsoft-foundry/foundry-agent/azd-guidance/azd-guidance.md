# Foundry azd Guidance

Read this skill before running any Foundry agent workflow that uses azd. Also use it for direct questions about Foundry-specific azd commands.

## Shared Rules

1. Always set `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` when running azd commands, for example:

   ```bash
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent init
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent run --no-client
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd provision
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd deploy
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent invoke
   ```

Set it inline only (as shown above). Never persist it into code or committed config (for example, `azd env set`, `.env`, or `azure.yaml`). It is a local-development-only setting.

2. If an azd command or flag is unclear, run the relevant `azd ... --help` command and follow its output.
3. Unless the user explicitly asks to open a client, run `azd ai agent run --no-client`.
4. Run project-scoped `azd` commands inside the project folder, not from its parent folder.
5. If the needed azd guidance is not covered here or remains unclear, read [azd ai CLI Reference](references/azd-ai-cli.md).

## Managed Harness Agents

A Microsoft Foundry Managed Harness Agent is a Prompt Agent configured with the Foundry-managed GitHub Copilot harness. This workflow uses azd for development and deployment:

```yaml
kind: prompt
harness:
  type: github_copilot_preview
```

Initialize a new Managed Harness Agent without using the Hosted sample catalog:

```bash
AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent init --no-prompt \
  --kind prompt \
  --harness github_copilot_preview \
  --agent-name <agent-name> \
  --model <model-name>
```

For an existing Foundry model deployment, pass `--project-id` and `--model-deployment` instead of `--model`. The `--harness` flag is preview and may be hidden from `--help`; verify it against the installed `azure.ai.agents` extension before use.

Collect unresolved choices before running init. Do not use azd's interactive prompts as the normal workflow. Existing Managed Harness Agent projects are updated by editing `azure.yaml`, not by rerunning init.
