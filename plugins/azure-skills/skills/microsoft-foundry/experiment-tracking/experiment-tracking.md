# Foundry Experiment Tracking

Inspect Microsoft Foundry experiment runs and send telemetry through the `azure.ai.projects` Azure Developer CLI extension. Use this workflow for the Foundry project data plane; use the parent [trace workflow](../foundry-agent/trace/trace.md) instead for Application Insights and KQL analysis.

## Quick Reference

| Intent | Command group | Details |
|--------|---------------|---------|
| Inspect or compare runs | `azd ai project run` | [Run inspection](references/run-inspection.md) |
| Query spans or trace chat | `azd ai project run spans/trace` | [Span and trace queries](references/span-trace-queries.md) |
| Upload OTLP or agent telemetry | `azd ai project ingest` | [Ingestion and W&B](references/ingestion-wandb.md) |
| Send W&B-compatible requests | `azd ai project wandb` | [Ingestion and W&B](references/ingestion-wandb.md) |

All commands are preview functionality and emit complete JSON responses.

## Workflow

1. Complete the parent skill dependency check, then read and follow [azd guidance](../foundry-agent/azd-guidance/azd-guidance.md).
2. Confirm the project extension and command surface:

   ```bash
   azd extension list --installed --output json
   azd ai project run --help
   ```

   If `azure.ai.projects` is missing, ask before installing it in an interactive session, then run `azd extension install azure.ai.projects`. If the command remains unavailable, update `azd` and the extension rather than falling back to REST or an SDK.
3. Resolve the Foundry project endpoint through the existing `azure.ai.projects` context. The project ID is normally the final segment of `/api/projects/{projectId}`; use `--project-id` only for a nonstandard endpoint.
4. Use Microsoft Entra bearer authentication with the `https://ai.azure.com/.default` scope by default. If the user explicitly chooses project-key authentication, set `AZURE_AI_PROJECT_API_KEY` only in the current process; never persist or print it.
5. Select the operation from the quick-reference table. Add `--api-version` only when the user requests an override or the service requires one.
6. Return the complete JSON response or save it to the user-requested file. Do not replace it with a lossy table or truncate large JSON numbers.

## Error Handling

| Symptom | Resolution |
|---------|------------|
| `unknown command "run"` or `"ingest"` | Update `azd` and reinstall/update `azure.ai.projects`, then verify with `--help`. |
| Missing project endpoint | Select an azd environment containing `AZURE_AI_PROJECT_ENDPOINT` or run `azd ai project set <endpoint>`. |
| Project ID cannot be derived | Pass `--project-id <project-id>` for the nonstandard endpoint. |
| `401` or `403` | Ask the user to authenticate; never run `azd auth login` for them. Check whether an explicitly configured API key is valid. |
| Empty ingestion payload | Stop and request a non-empty file or stdin payload. |
| Invalid filter/request JSON | Validate the file as JSON and preserve its numeric values and escaped identifiers. |

## References

- [Run inspection](references/run-inspection.md)
- [Span and trace queries](references/span-trace-queries.md)
- [Ingestion and W&B](references/ingestion-wandb.md)
