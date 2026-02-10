# Error Handling

## Prerequisite Errors

| Error | Fix |
|-------|-----|
| `docker info` fails / "Cannot connect to Docker daemon" | Install Docker Desktop from https://docs.docker.com/get-docker/ and start it |

## Copilot SDK Errors

| Error | Fix |
|-------|-----|
| `copilot: command not found` | Add `npm install -g @github/copilot-cli` to Dockerfile |
| `ECONNREFUSED` on JSON-RPC | Set `autoStart: true` or start CLI manually |
| `GITHUB_TOKEN` not set | Wire via Key Vault secret reference + preprovision hook |
| `Model not available` | Check model name; for BYOK verify provider config |
| Tool handler timeout | Add timeout/retry logic in handler |
| Session hangs on `sendAndWait` | Set `maxTurns` limit or add hook to break |
| `session.on("event_name", handler)` silent failure | Wrong API — use `session.on((event) => { switch(event.type) ... })` |
| `tool.execution_end` not firing | Wrong event name — use `tool.execution_complete` |

## Copilot Extensions Errors

| Error | Fix |
|-------|-----|
| SSE responses truncated | Set `X-Accel-Buffering: no` header |
| 401 on agent endpoint | Check GITHUB_TOKEN and Key-Id header |
| `verifyAndParseRequest` invalid | Use `github-public-key-signature` header |
| SSE events not streaming | Add all four required SSE headers |

## Shared Errors

| Error | Fix |
|-------|-----|
| Port mismatch on deploy | Align `PORT`, `EXPOSE`, `targetPort`, and `app.listen` to 3000 |
| ACR auth loop | Use managed identity for ACR pull — never `adminUserEnabled` |
| App not responding | Check `process.env.PORT` matches WEBSITES_PORT |
| `gh auth token` fails in preprovision | Run `gh auth login` then `gh auth refresh --scopes copilot` |
| Inline HTML in TypeScript | Move HTML to `public/test.html`, serve via `express.static()` |
