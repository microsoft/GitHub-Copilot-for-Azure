# Dapr with C#

Use `HttpClient` against the local sidecar. No Azure credential is needed in application
code because the Dapr component authenticates with the app UAMI.

```csharp
var daprPort = Environment.GetEnvironmentVariable("DAPR_HTTP_PORT") ?? "3500";
using var client = new HttpClient { BaseAddress = new($"http://localhost:{daprPort}") };
await client.PostAsJsonAsync("/v1.0/publish/pubsub/orders", new { orderId = "123" });
var secret = await client.GetFromJsonAsync<Dictionary<string, string>>(
    "/v1.0/secrets/secretstore/db-password");
```

Use `/v1.0/invoke/<app-id>/method/<path>` for service invocation and
`/v1.0/state/statestore` for state.
