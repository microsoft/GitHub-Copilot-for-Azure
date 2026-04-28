# Server Role Decision

Use this file when the main question is how the app server participates in the system, not which browser SDK to import.

## Ask these questions first

- Is plain group fan-out enough, or must one server-side handling path process each client event?
- Can the server expose a reachable HTTP endpoint and configure upstream settings on the hub?
- Does any server process need realtime data but cannot or should not expose an inbound endpoint?
- Will the server send or manage connections through REST or `WebPubSubServiceClient`?

## Common server shapes

- Negotiate / publish / manage only
  - Typical choice: `@azure/web-pubsub` with `WebPubSubServiceClient`
  - Use this for negotiate, publish, membership, or permissions.
  - Do not add upstream just because the server also publishes.

- Node app hosting upstream
  - Typical choice: `@azure/web-pubsub` plus `@azure/web-pubsub-express`
  - Use this when an Express-style server must receive connect, disconnected, or user events.

- Azure Functions hosting upstream
  - Typical choice: Web PubSub Functions bindings and triggers first
  - Use this when Functions already owns the event path.

- Server process as a client connection
  - Typical choice: `@azure/web-pubsub-client`
  - Use this when the server connects outward like another client.
  - This can coexist with publish or upstream handling.

## Server send/manage role

- `WebPubSubServiceClient` and the REST API let the server send to groups, users, or connections and manage membership or permissions.
- This role can be combined with either shape above.
- Do not confuse "the server publishes with REST" with "the server must use upstream." Those are different decisions.

## Decision rule

- Choose client-connection/group pubsub when connected participants mainly fan out through groups and any business acknowledgement stays in app logic.
- Choose upstream when each event must be handled by server logic with HTTP success/failure semantics.
- Choose hosting only after upstream is selected; Functions and custom servers are hosting options, not separate architectures.
