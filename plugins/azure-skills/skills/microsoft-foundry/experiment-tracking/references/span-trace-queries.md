# Span and Trace Queries

## Trace chat

Return a chat-oriented view of one trace:

```bash
azd ai loom run trace chat --run-id <run-id> --trace-id <trace-id>
```

Use `--request-file <request.json>` when the user already has a complete trace-chat request body.

## Span query

```text
azd ai loom run span query \
  --run-id <run-id> \
  [--filter <json> | --filter-file <path> | --request-file <path>] \
  [--include-details] \
  [--limit <count>]
```

Choose one input form:

| Input | When to use |
|-------|-------------|
| `--filter '<json>'` | Small filter supplied inline |
| `--filter-file <path>` | Reusable filter document |
| `--request-file <path>` | Complete request body supplied by the user |

When no filter or request file is supplied, the CLI uses `{"$expr":true}`. Do not combine or rewrite user-provided request bodies. The CLI adds the resolved project ID to filter-based queries.

Use `--include-details` only when detailed span content is needed and `--limit` to bound large result sets. Follow the parent azd guidance and set `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` inline when executing commands.
