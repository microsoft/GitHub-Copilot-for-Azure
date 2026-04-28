# Web PubSub for Socket.IO Path

If you choose the Web PubSub for Socket.IO path, use it when the user wants Socket.IO semantics with Azure Web PubSub.

## Prefer this when

- The app already speaks Socket.IO
- The user asks for Socket.IO, not native Web PubSub client APIs

## Rules

- Use the Web PubSub for Socket.IO resource, libraries, and sample patterns.
- Do not generate a native `WebPubSubClient` solution for a Socket.IO request.
- Keep negotiate/bootstrap aligned with the Web PubSub for Socket.IO path.

## Caveats to state

- This is a different product path from the PubSub client SDK model
- Package choices, bootstrap flow, and runtime assumptions differ
