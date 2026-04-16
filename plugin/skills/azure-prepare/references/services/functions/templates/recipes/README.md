# Function Template Recipes

Composable templates for Azure Functions integrations.

## Recipe Index

For intent-to-resource mapping and selection algorithm, see [selection.md](../selection.md).

| Recipe | Resource |
|--------|----------|
| [cosmosdb](cosmosdb/) | `cosmos` |
| [eventhubs](eventhubs/) | `eventhub` |
| [servicebus](servicebus/) | `servicebus` |
| [timer](timer/) | `timer` |
| [durable](durable/) | `durable` |
| [mcp](mcp/) | `mcp` |
| [sql](sql/) | `sql` |
| [blob-eventgrid](blob-eventgrid/) | `blob` |

## Composition

See [composition.md](composition.md) for merging multiple templates.

## Common Patterns

| Pattern | Description |
|---------|-------------|
| [Health Check](common/health-check.md) | Health endpoint for monitoring |
| [Node.js Entry Point](common/nodejs-entry-point.md) | `src/index.js` requirements |
| [.NET Entry Point](common/dotnet-entry-point.md) | `Program.cs` requirements |
