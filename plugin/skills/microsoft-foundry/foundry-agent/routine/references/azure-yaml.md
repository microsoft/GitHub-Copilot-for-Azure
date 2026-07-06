# Declarative Routines

The routines extension registers a service target so routines can live in source control and be upserted by `azd up` / `azd deploy`. Declare the routine as a service with `host: azure.ai.routine`; the service key is the routine name, and its keys bind to the routine model.

```yaml
# azure.yaml
services:
  my-agent:
    host: azure.ai.agent
    # ... agent service block ...

  daily-digest:
    host: azure.ai.routine
    uses:
      - my-agent
    description: Daily 8am digest
    enabled: true
    triggers:
      default:
        type: schedule
        cron_expression: "0 8 * * *"
        time_zone: America/New_York
    action:
      type: invoke_agent_responses_api
      agent_name: my-agent
      input: "Summarize activity for ${AZURE_ENV_NAME}"
```

Then:

```bash
azd deploy daily-digest --no-prompt
azd up
```

## Behavior Notes

- `azd deploy` PUTs the routine idempotently; package and publish are no-ops.
- Put the target agent service in `uses` so azd orders the agent before the routine that invokes it.
- String values in `action.input` resolve `${VAR}` against the active azd env; Foundry server-side `${{...}}` expressions are left untouched.
- Removing the service block from `azure.yaml` stops azd managing the routine but does not delete it from Foundry. Delete explicitly with `azd ai routine delete <name>`.
- In `azure.yaml`, use wire values: trigger `type` is `schedule`, `timer`, `github_issue`, or `custom`; action `type` is `invoke_agent_responses_api` or `invoke_agent_invocations_api`. CLI flags use friendly aliases such as `recurring`, `github-issue`, `agent-response`, and `agent-invoke`.
