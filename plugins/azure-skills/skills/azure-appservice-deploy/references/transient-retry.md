# Transient ARM error handling for `az ... create`

Load this file only when an `az group create`, `az appservice plan create`, or `az webapp create` command fails. Healthy runs never need it.

## Which errors are transient

ARM `PUT` operations sometimes fail with **transient** errors:

- `Connection reset`, `Connection aborted`, `ConnectionError`
- `Read timed out`, `Max retries exceeded`
- `BadGatewayConnection`, `ServiceUnavailable`
- `TooManyRequests` / HTTP `429`
- HTTP `502` / `503` / `504`

These are ARM frontend / network blips, not configuration problems — they almost always succeed on retry.

**Do NOT retry on** `AuthorizationFailed`, `SubscriptionNotFound`, `ResourceGroupNotFound`, `InvalidTemplateDeployment`, `SkuNotAvailable`, `QuotaExceeded`, or any non-429 4xx. Those are real config errors — surface them to the user.

## Rules

- Apply to every `az ... create` in [create-app.md](create-app.md) §§2–4.
- Retry **silently** — do not narrate "let me retry".
- Up to **2 retries** (3 attempts total); wait **5s** before retry #1 and **15s** before retry #2.
- **Repeat the lookup and conditional create** in [create-app.md](create-app.md) — never retry a bare `create`. If `show` succeeds, reuse the existing resource.
- After 3 failed attempts, surface the original error with one line of context (e.g., `"ARM frontend is returning transient errors — please retry in a few minutes"`).
