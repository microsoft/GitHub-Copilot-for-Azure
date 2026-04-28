# Negotiate Checklist

Use this file whenever the task includes `/negotiate`, token generation, browser connection bootstrapping, or reconnect semantics.

## Checklist

1. Identity source
- Where does `userId` come from?
- Server auth/session/Entra/custom auth is preferred.
- If the sample accepts `userId` from query params, mark it as demo-only.
- If the demo does not need named users, prefer server-generated guest identities.
- If the endpoint also sets cookies or mutates session/demo identity state, prefer `POST /negotiate`.

2. Client credential shape
- For browser clients, first choose the runtime shape:
  - `new WebPubSubClient({ getClientAccessUrl: async () => ... })` is the default for PubSub browser clients
  - if the browser app needs bundling, use a small standard build step instead of changing the client transport just to avoid packaging
  - if the task actually belongs to Web PubSub for Socket.IO, follow that runtime instead of forcing `WebPubSubClient`
- A one-shot client URL is acceptable for narrow demos, but it should not be described as the preferred production shape.
- Do not call `/negotiate` before each message send. Use it to obtain connection credentials for startup, reconnect, or refresh.
- If the system also has a server publisher or upstream handler, keep those roles separate from what `/negotiate` is doing for the client connection.

3. JWT contents
- `sub` / user identity
- `role` / initial permissions
- `webpubsub.group` / initial groups

4. Permission scope
- Only grant the minimum required roles.
- Avoid unconditional `webpubsub.sendToGroup` and `webpubsub.joinLeaveGroup` unless the task really needs any-group access.

5. Group semantics
- Initial JWT group claim
- Explicit `client.joinGroup()`
- Server-managed membership

These are different mechanisms. Do not merge them casually.

6. Reconnect story
- Does the client fetch a fresh access URL when needed?
- Does the implementation rely on SDK-managed recovery and auto-rejoin, explicit rejoin, or a fresh token?
- If the answer is unclear, say so and keep the sample narrow.
- If you use explicit `joinGroup()`, consider adding `rejoin-group-failed` handling.

7. Server boundary
- `/negotiate` is server-owned.
- Keep connection strings and access keys server-side.
- For Azure-hosted production apps, consider Microsoft Entra ID / managed identity for service-side authorization instead of assuming access keys forever.
- Mention production hardening when relevant: auth, rate limits, logging, token TTL, origin/cors policy.
