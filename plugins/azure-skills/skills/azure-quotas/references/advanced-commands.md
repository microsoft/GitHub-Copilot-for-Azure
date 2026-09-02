# Advanced Azure Quota Commands

Use these Azure CLI commands to track quota requests and list quota operations.

## az quota request status list

Use this command to get quota requests from a one-year period. Use an OData filter to select specific requests.

Syntax:

```bash
az quota request status list --scope SCOPE [--filter FILTER] [--max-items N] [--next-token TOKEN] [--skip-token TOKEN] [--top N]
```

Required parameter:

- `--scope`: Target Azure resource URI.

Optional parameters:

- `--filter`: Filter by `requestSubmitTime` (`ge`, `le`, or `eq`), `provisioningState` (`eq`), or `resourceName` (`eq`).
- `--max-items`: Maximum total number of items to return.
- `--next-token`: Pagination token from the previous response.
- `--skip-token`: Token that skips to the next page.
- `--top`: Number of records to return.

Examples:

```bash
# List compute quota requests.
az quota request status list --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus

# List network quota requests.
az quota request status list --scope /subscriptions/{id}/providers/Microsoft.Network/locations/eastus
```

## az quota request status show

Use this command to get the details and status of one quota request. The `az quota update` operation returns the request ID.

Syntax:

```bash
az quota request status show --id REQUEST_ID --scope SCOPE
```

Required parameters:

- `--id`: Quota request ID.
- `--scope`: Target Azure resource URI.

Example:

```bash
az quota request status show \
  --id 2B5C8515-37D8-4B6A-879B-CD641A2CF605 \
  --scope /subscriptions/{id}/providers/Microsoft.Compute/locations/eastus
```

## az quota operation list

Use this command to list the operations that the `Microsoft.Quota` resource provider supports.

Syntax:

```bash
az quota operation list
```

Examples:

```bash
# List all operations.
az quota operation list

# Show the operations in a table.
az quota operation list --output table
```
