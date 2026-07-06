# CLI CRUD and Operations

Use `azd ai routine` for imperative routine CRUD and operations. All verbs accept `--output json` or `--output table` (default). Add `-p <endpoint>` to override the resolved project endpoint.

## Create

Create from flags, or supply a `--file` manifest (`--file` and `--trigger` are mutually exclusive).

```bash
# One-shot timer -> agent
azd ai routine create nightly-report \
  --trigger timer --at <YYYY-MM-DDTHH:MM:SSZ> \
  --action agent-response --agent-name my-agent

# Recurring cron schedule
azd ai routine create daily-digest \
  --trigger recurring --cron "0 8 * * *" --time-zone America/New_York \
  --action agent-response --agent-name my-agent \
  --description "Daily 8am digest"

# GitHub issue event -> agent
azd ai routine create triage-on-open \
  --trigger github-issue \
  --connection-id <workspace-connection-id> --owner Azure --repository azure-dev \
  --issue-event opened \
  --action agent-invoke --agent-name triage-agent

# Custom event
azd ai routine create on-custom-event \
  --trigger custom --provider <provider-id> --event-name <event> \
  --parameters '{"key":"value"}' \
  --action agent-response --agent-name my-agent

# Manifest file
azd ai routine create my-routine --file routine.yaml
```

## Create Flags

| Flag | Applies to | Notes |
|------|------------|-------|
| `--trigger` | all | `timer` \| `recurring` \| `github-issue` \| `custom` (required unless `--file`) |
| `--at` | timer | ISO 8601 UTC datetime, e.g. `<YYYY-MM-DDTHH:MM:SSZ>` |
| `--cron` | recurring | 5-field cron; minimum interval 5 minutes |
| `--time-zone` | recurring | IANA zone, e.g. `America/New_York` (default `UTC`; not valid for timer) |
| `--connection-id`, `--owner`, `--repository`, `--issue-event` | github-issue | all four required; `--issue-event` is `opened` or `closed` |
| `--provider`, `--event-name`, `--parameters` | custom | `--provider` and JSON-object `--parameters` required |
| `--action` | all | `agent-response` (default) \| `agent-invoke` |
| `--agent-name` \| `--agent-endpoint-id` | action | exactly one; identifies the target agent |
| `--conversation-id` | agent-response | continue an existing conversation (preview) |
| `--session-id` | agent-invoke | continue an existing hosted-agent session |
| `--description` | all | free-text description |
| `--enabled` | all | enabled by default; pass `--enabled=false` to create disabled |
| `--force` | all | overwrite an existing routine of the same name (upsert) |

## Read

```bash
azd ai routine list
azd ai routine list --output json

azd ai routine show nightly-report
azd ai routine show nightly-report --output json
```

## Update

`update` changes only passed fields; everything else is preserved. Supply named flags and/or a `--file` manifest.

```bash
azd ai routine update daily-digest --cron "30 9 * * *"
azd ai routine update daily-digest --agent-name another-agent --description "New owner"
azd ai routine update daily-digest --file routine.yaml
```

Trigger and action **types** are immutable. `--trigger` / `--action` are rejected on `update`; delete and recreate to change them.

## Delete

```bash
azd ai routine delete daily-digest
azd ai routine delete daily-digest --force
```

Use `--force` for non-interactive deletes, including `--no-prompt`.

## Routine Operations

```bash
azd ai routine enable daily-digest
azd ai routine disable daily-digest

# Manually fire a routine once
azd ai routine dispatch daily-digest
azd ai routine dispatch daily-digest --input '{"foo":"bar"}'
azd ai routine dispatch daily-digest --async

# Inspect past runs
azd ai routine run list daily-digest
azd ai routine run list daily-digest --top 20 --filter "<odata-filter>"
```

`dispatch` prints a Dispatch ID and Action Correlation ID; use `run list` to see the resulting status and phase.
