# Manage Foundry Routines (azd ai routine)

Create, read, update, and delete Microsoft Foundry **routines** with the Azure Developer CLI (`azd`). A routine pairs a **trigger** (timer, recurring schedule, GitHub issue, or a custom external event) with an **action** that invokes a Foundry agent. Every operation in this skill goes through `azd` — either the imperative `azd ai routine` commands or the declarative `host: azure.ai.routine` service in `azure.yaml`.

> **Preview.** Routines ship in the `azure.ai.routines` azd extension (Preview). The command surface is `azd ai routine <verb>`; do not use the Foundry MCP tools, REST, or SDK for routine CRUD in this skill — keep everything on the azd path.

## Quick Reference

| Property | Value |
|----------|-------|
| Primary CLI | `azd ai routine` (from extension `azure.ai.routines`) |
| Install extension | `azd extension install azure.ai.routines` |
| CRUD verbs | `create`, `list`, `show`, `update`, `delete` |
| Lifecycle verbs | `enable`, `disable`, `dispatch`, `run list` |
| Declarative form | `azure.yaml` service with `host: azure.ai.routine` (upserted by `azd deploy` / `azd up`) |
| Project endpoint | Resolved from `-p/--project-endpoint`, then the active azd env (`AZURE_AI_PROJECT_ENDPOINT`), then global config, then `FOUNDRY_PROJECT_ENDPOINT` |
| Output format | `--output json` or `--output table` (default `table`) on every verb |
| Reference docs | [azd-ai-cli](../create/references/azd-ai-cli.md) |

## When to Use This Skill

- Schedule an agent to run on a timer (one-shot) or a recurring cron schedule.
- Trigger an agent when a GitHub issue is opened/closed, or on a custom external event.
- List / inspect / enable / disable / delete existing routines on a Foundry project.
- Manually fire a routine once (`dispatch`) or inspect its execution history (`run list`).
- Manage routines declaratively as services in `azure.yaml` so `azd up` / `azd deploy` keeps them in sync.

> A routine **references an agent**, it does not create one. Deploy or identify the target agent first (see [deploy](../deploy/deploy.md) / [create](../create/create-hosted.md)), then attach a routine to it.

## Workflow

### Step 1 — Verify the environment

Before any routine command, run the bundled verification script (shared with the create/deploy flow) to confirm `azd`, `az`, auth, and the base Foundry extensions are ready:

```bash
../create/scripts/verify-environment.sh     # macOS / Linux
../create/scripts/verify-environment.ps1     # Windows (pwsh)
```

Act on the summary prefixes:

- `[OK]` — nothing to do.
- `[WARN]` — non-blocking; continue.
- `[ACTION]` — resolve first, then rerun the script. Never run `az login` or `azd auth login` for the user — stop and ask them to log in manually. Missing base extensions (`azure.ai.agents`, `azure.ai.projects`, `microsoft.foundry`) can be installed with `azd extension install <name>`.

Do not continue past Step 1 while any `[ACTION]` remains.

#### Step 1b — Check the routine extension (`azure.ai.routines`)

The shared script does **not** check the routines extension. Confirm it is installed:

```bash
azd extension list --installed --output json
```

If `azure.ai.routines` is not in the list, install it (ask before installing in interactive mode; install directly in non-interactive mode):

```bash
azd extension install azure.ai.routines
```

Verify the command surface is available:

```bash
azd ai routine --help
```

> If `azd ai routine` reports an unknown command after install, the azd core is too old. The extension requires `azd >= 1.27.0` — upgrade azd (<https://aka.ms/azd-install>) and retry.

### Step 2 — Resolve the Foundry project endpoint

Every routine command targets a Foundry **project endpoint**. `azd ai routine` resolves it in this order (first match wins):

1. `-p` / `--project-endpoint <url>` flag on the command.
2. The active azd environment's `AZURE_AI_PROJECT_ENDPOINT` (`azd env get-values`).
3. Global config written by `azd ai project set <endpoint>`.
4. The `FOUNDRY_PROJECT_ENDPOINT` environment variable.
5. Otherwise the command fails with a missing-endpoint error.

Prefer the azd env when you are inside an azd project (it is already set after `azd provision` / `azd ai project show`). Otherwise set it once:

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "https://<account>.services.ai.azure.com/api/projects/<project>"
# or, outside an azd project:
azd ai project set "https://<account>.services.ai.azure.com/api/projects/<project>"
```

The endpoint host must end with `.services.ai.azure.com` and use `https` with no explicit port.

## CRUD with `azd ai routine`

All verbs accept `--output json` (for scripting) or `--output table` (default). Add `-p <endpoint>` to any command to override the resolved endpoint.

### Create

A routine needs a **trigger** and an **action**. Build them from flags, or supply a `--file` manifest (`--file` and `--trigger` are mutually exclusive).

```bash
# One-shot timer -> agent (responses API) by project-scoped agent name
azd ai routine create nightly-report \
  --trigger timer --at 2026-08-01T09:00:00Z \
  --action agent-response --agent-name my-agent

# Recurring cron schedule (min interval 5 minutes) with a time zone
azd ai routine create daily-digest \
  --trigger recurring --cron "0 8 * * *" --time-zone America/New_York \
  --action agent-response --agent-name my-agent \
  --description "Daily 8am digest"

# GitHub issue event -> agent (invocations API)
azd ai routine create triage-on-open \
  --trigger github-issue \
  --connection-id <workspace-connection-id> --owner Azure --repository azure-dev \
  --issue-event opened \
  --action agent-invoke --agent-name triage-agent

# Custom external-provider event
azd ai routine create on-custom-event \
  --trigger custom --provider <provider-id> --event-name <event> \
  --parameters '{"key":"value"}' \
  --action agent-response --agent-name my-agent

# From a manifest file (name still comes from the positional arg)
azd ai routine create my-routine --file routine.yaml
```

Key flags:

| Flag | Applies to | Notes |
|------|-----------|-------|
| `--trigger` | all | `timer` \| `recurring` \| `github-issue` \| `custom` (required unless `--file`) |
| `--at` | timer | ISO 8601 UTC datetime, e.g. `2026-08-01T09:00:00Z` |
| `--cron` | recurring | 5-field cron, minimum interval 5 minutes |
| `--time-zone` | recurring | IANA zone, e.g. `America/New_York` (default `UTC`; not valid for timer) |
| `--connection-id`, `--owner`, `--repository`, `--issue-event` | github-issue | all four required; `--issue-event` is `opened` or `closed` |
| `--provider`, `--event-name`, `--parameters` | custom | `--provider` + `--parameters` (JSON object) required |
| `--action` | all | `agent-response` (default, responses API) \| `agent-invoke` (invocations API) |
| `--agent-name` \| `--agent-endpoint-id` | action | exactly one; identifies the target agent |
| `--conversation-id` | agent-response | continue an existing conversation (preview) |
| `--session-id` | agent-invoke | continue an existing hosted-agent session |
| `--description` | all | free-text description |
| `--enabled` | all | enabled by default on creation; pass `--enabled=false` to create disabled |
| `--force` | all | overwrite an existing routine of the same name (upsert) |

Without `--force`, creating a routine whose name already exists fails — use `--force` to upsert or pick a new name.

### Read (list / show)

```bash
azd ai routine list                      # NAME / ENABLED / TRIGGER / ACTION
azd ai routine list --output json

azd ai routine show nightly-report       # full detail for one routine
azd ai routine show nightly-report --output json
```

### Update

`update` changes only the fields you pass; everything else is preserved. Supply named flags and/or a `--file` manifest (manifest fields win, then explicit flags override).

```bash
azd ai routine update daily-digest --cron "30 9 * * *"
azd ai routine update daily-digest --agent-name another-agent --description "New owner"
azd ai routine update daily-digest --file routine.yaml
```

> **Trigger and action *types* are immutable.** `--trigger` / `--action` are rejected on `update`. To change the trigger kind (e.g. timer → recurring) or the action kind (agent-response → agent-invoke), `delete` the routine and `create` it again. You can still update the fields *within* the existing trigger/action type (cron, at, time-zone, agent name, etc.).

### Delete

```bash
azd ai routine delete daily-digest            # interactive confirmation
azd ai routine delete daily-digest --force    # skip prompt (required with --no-prompt)
```

## Lifecycle commands

```bash
azd ai routine enable  daily-digest    # idempotent; enabling an enabled routine is a no-op
azd ai routine disable daily-digest    # idempotent

# Manually fire a routine once (runs asynchronously server-side)
azd ai routine dispatch daily-digest
azd ai routine dispatch daily-digest --input '{"foo":"bar"}'   # override action input (JSON or plain string)
azd ai routine dispatch daily-digest --async                    # print only the dispatch ID (scripting)

# Inspect execution history for a routine
azd ai routine run list daily-digest
azd ai routine run list daily-digest --top 20 --filter "<odata-filter>"
```

`dispatch` prints a **Dispatch ID** and **Action Correlation ID**; use `azd ai routine run list <name>` to see the resulting run status/phase.

## Declarative form — routines in `azure.yaml`

The extension also registers a **service target** so routines can live in source control and be upserted by `azd up` / `azd deploy`. Declare the routine as a service with `host: azure.ai.routine`; the **service key is the routine name**, and its keys bind directly to the routine model.

```yaml
# azure.yaml
services:
  my-agent:
    host: azure.ai.agent
    # ... agent service block ...

  daily-digest:                 # <- routine name = service key
    host: azure.ai.routine
    uses:
      - my-agent                # order the agent ahead of the routine that invokes it
    description: Daily 8am digest
    enabled: true
    triggers:
      default:
        type: schedule          # wire type: schedule=recurring, timer, github_issue, custom
        cron_expression: "0 8 * * *"
        time_zone: America/New_York
    action:
      type: invoke_agent_responses_api   # or invoke_agent_invocations_api
      agent_name: my-agent
      input: "Summarize activity for ${AZURE_ENV_NAME}"   # ${VAR} expands from azd env
```

Then:

```bash
azd deploy daily-digest --no-prompt    # upsert just this routine
azd up                                 # provision + deploy everything, including routines
```

Behavior notes:

- **Upsert on deploy.** `azd deploy` PUTs the routine idempotently (no build artifact — package/publish are no-ops).
- **`${VAR}` expansion.** String values in `action.input` resolve against the active azd env; Foundry server-side `${{...}}` expressions are left untouched.
- **Removing the service does not delete the routine.** Deleting the service block from `azure.yaml` only stops azd managing it — the routine still exists in Foundry. Delete it explicitly with `azd ai routine delete <name>`.
- **Wire vs CLI names.** In `azure.yaml` use wire type values: trigger `type` is `schedule` (recurring) / `timer` / `github_issue` / `custom`; action `type` is `invoke_agent_responses_api` (agent-response) / `invoke_agent_invocations_api` (agent-invoke). The `azd ai routine create --trigger/--action` flags use the friendly aliases.

## Choosing imperative vs declarative

| Situation | Use |
|-----------|-----|
| Quick one-off, exploration, scripting, CI ad-hoc | `azd ai routine <verb>` |
| Routine should be versioned with the agent and reproduced per environment | `azure.yaml` service + `azd deploy` |
| Enable/disable/dispatch/inspect runs | `azd ai routine enable/disable/dispatch/run list` (no declarative equivalent) |
| Delete | `azd ai routine delete` (always — declarative removal never deletes) |

## Error handling

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `unknown command "routine"` / `unknown command "ai"` | Extension not installed or azd too old | `azd extension install azure.ai.routines`; ensure `azd >= 1.27.0` |
| Missing project endpoint error | No endpoint resolved | Set `AZURE_AI_PROJECT_ENDPOINT` via `azd env set`, run `azd ai project set <url>`, or pass `-p <url>` |
| `routine "<name>" already exists` on create | Name collision | Re-run with `--force` to upsert, or choose a different name |
| `--trigger`/`--action cannot be changed on an existing routine` | Trigger/action type is immutable | `delete` then `create` with the new type |
| `--force is required when --no-prompt is set` on delete | Non-interactive delete without confirmation | Add `--force` |
| `routine "<name>" not found` | Wrong name or wrong project | `azd ai routine list` to confirm the name and the resolved endpoint |
| `host "..." is not a recognized Foundry host` | Endpoint host invalid | Use `https://<account>.services.ai.azure.com/api/projects/<project>` (no port) |
| Network isolation / `PublicNetworkAccessDisabled` / `403` | Project has public access disabled | See [Network Isolation Errors](../../SKILL.md#network-isolation-errors) |

## Additional Resources

- [azd ai CLI Reference](../create/references/azd-ai-cli.md)
- [Deploy a Foundry Agent](../deploy/deploy.md) — deploy the agent a routine will invoke
- [Invoke a Foundry Agent](../invoke/invoke.md) — smoke-test the agent before scheduling it
- [Microsoft Foundry Skill (index)](../../SKILL.md)
