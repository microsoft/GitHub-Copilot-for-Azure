# Dapr with Node.js / TypeScript

Use the built-in `fetch` API against the local sidecar:

```typescript
const base = `http://localhost:${process.env.DAPR_HTTP_PORT ?? "3500"}`;
const publish = await fetch(`${base}/v1.0/publish/pubsub/orders`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ orderId: "123" }),
});
if (!publish.ok) throw new Error(`Dapr publish failed: ${publish.status}`);

const response = await fetch(`${base}/v1.0/secrets/secretstore/db-password`);
if (!response.ok) throw new Error(`Dapr secret read failed: ${response.status}`);
const secret = (await response.json())["db-password"];
```
