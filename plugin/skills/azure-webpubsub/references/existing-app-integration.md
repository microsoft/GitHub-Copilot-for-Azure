# Existing App Integration

Use this file when the task adds Azure Web PubSub to an existing application, replaces polling/SSE/WebSocket behavior, or must preserve current auth/API/build boundaries.

## If you are integrating into an existing app, inspect first

- Where does identity already come from?
- Which server endpoint or workflow already owns writes?
- Is the current server allowed to expose an inbound callback endpoint, or is outbound-only connectivity the safer fit?
- Which domain partition matters for fan-out?
  - boards
  - rooms
  - tenants
  - channels
  - documents
  - dashboards
- How does the frontend currently receive live updates?
- What server and frontend entrypoints already exist?

## Make the mapping explicit

- app user -> negotiated token `userId`
- app partition -> hub, group, room, or server-side target
- existing mutation or workflow -> publish trigger
- existing polling/SSE/WebSocket path -> new realtime subscription path
- server role -> client connection, REST publisher, upstream handler, or a combination of these

If two mappings are plausible, prefer the one that preserves the current authorization model with the fewest new moving parts.

## If you proceed with an in-place integration, keep this posture

- Reuse the current auth/session boundary.
- Keep existing business writes on their current REST/API/server workflow unless the user explicitly wants browser direct publish.
- Keep authorization server-owned.
- Replace the transport layer first; do not widen product scope during the migration.
- Reuse the host app's existing build/runtime structure unless there is a clear blocker.
- Decide explicitly whether the host server needs upstream callbacks or whether outbound client connections plus REST publish already fit the system better.
- Once the mapping is decided, edit the host integration seams first instead of spending long on SDK/package archaeology.

## Common PubSub client SDK integration patterns

- one app hub for the feature or bounded domain
- groups for app partitions such as boards/channels/documents when that matches current ACL boundaries
- server-side publish when the existing app already owns validation and mutations
- browser subscription only to authorized partitions
- optional server process holding its own client connection when the app needs outbound-only realtime participation
- polling or SSE endpoint replaced by negotiated subscription logic, not by a second write API

## Avoid

- creating a second login or session model
- trusting browser-provided tenant, board, or role claims for authorization
- moving business validation into browser `sendToGroup()` just because the SDK allows it
- creating one hub per small domain object when one hub plus groups preserves the current model more cleanly
- introducing sidecar sample structure when the app already has clear entrypoints

## Ask or state an assumption when

- it is unclear whether events are client-originated or server-authoritative
- it is unclear whether upstream callbacks are required or a server publisher / client-connection shape is enough
- the partition should maybe be a room model instead of groups
- users may subscribe to many partitions concurrently
- the current app's auth or tenancy rules are not visible from the code you can inspect
