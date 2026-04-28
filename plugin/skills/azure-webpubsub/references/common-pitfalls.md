# Common Pitfalls

Use this file only after the path is selected and the main risk is implementation drift.

- Do not switch away from `@azure/web-pubsub-client` just to avoid browser bundling.
  - That usually solves the wrong problem. The transport choice should follow the product path, not whether the page can import an npm package directly.
  - If the chosen path is PubSub in the browser, keep the client SDK and add the smallest practical build step. A simple browser entry, one bundle output, and basic HTML injection are usually enough.

- Be explicit about how group membership comes back after reconnect.
  - `autoRejoinGroups` is for groups the client joined itself with `joinGroup()`. If the connection drops and reconnects, the SDK can try to rejoin those client-joined groups. It does not restore groups that were attached on the server side, including groups granted as part of the server-issued connection setup.
  - That is why `joinGroup()` and server-managed membership are not interchangeable. If your design depends on a group always being present after reconnect, say which mechanism owns that behavior.
  - Rejoin can still fail, for example if the renewed connection no longer has permission to join that group. If the sample relies on `joinGroup()`, keep that behavior visible and handle `rejoin-group-failed`.
