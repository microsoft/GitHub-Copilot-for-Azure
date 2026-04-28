# PubSub Client SDK Path

Use this path when the realtime participants can behave as Web PubSub client connections and the core behavior is group fan-out or direct server messages through the service.

This is the default browser client path. It uses `@azure/web-pubsub-client` on top of the PubSub subprotocol instead of routing every message through upstream first.

## Prefer this when

- the user wants browsers, apps, workers, or even app-server processes to connect outward to the service and stay on WebSocket connections
- group fan-out is the main behavior
- no inbound server endpoint is required for the realtime path
- an existing app needs realtime subscriptions while keeping business writes on the current server API

## Avoid this when

- each client event must be processed by one server-side handler before the feature is considered complete
- the design depends on connect, connected, disconnected, or custom user events flowing through upstream

## Key consequences

- The machines that hold client connections do not need public inbound ports for this realtime path. They connect outward to the service.
- A server process can also be a client connection if it actively connects to the service and participates in the pubsub flow.
- A different server process can still use `WebPubSubServiceClient` or REST APIs to send to groups, users, or connections. That is a server role, not a client-runtime decision.
- `sendToGroup()` and `joinGroup()` acknowledgements are service-level results. They do not prove that another application process consumed the message or finished business logic. If that matters, add application-level acknowledgement explicitly.

## Watch for these mapping choices

- one hub per feature or bounded domain, not one hub per small object
- groups aligned with current authorization or partition boundaries
- `/negotiate` issuing least-privilege roles and any initial groups intentionally
- explicit `joinGroup()` versus initial JWT groups, with reconnect behavior made clear
- minimal browser bundling when needed, rather than changing transports to avoid packaging

If browser packaging or reconnect details start dominating the task, load `references/common-pitfalls.md`.

## Caveats to state

- no durable history by default
- no room model by default
- if the existing app already has server-owned writes, keep them there unless the user explicitly wants direct client publish
