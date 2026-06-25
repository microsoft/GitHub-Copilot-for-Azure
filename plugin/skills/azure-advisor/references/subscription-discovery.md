# Shared Reference — Subscription Discovery

> **Shared across all `azure-advisor` capabilities.** Any capability that operates on a
> subscription should link here instead of re-defining discovery logic.

## Default — discover every subscription the repo references

Auto-discovery is the point of this skill: **do not make the user name the scope**. Scan
the workspace and collect **every distinct** subscription id you find — a repo commonly
pins a different subscription per environment, so **don't stop at the first hit**.
Subscriptions **must never be hardcoded**. Scan all of:

- `azure.yaml` → `subscriptionId:` key, plus any per-environment azd configs
- `.azure/*/config.json` → `subscriptionId` field (one per azd environment)
- `*.bicepparam` / `*.parameters.json`, incl. `infra/**/main.parameters.json` →
  `subscriptionId` / `subscription` parameter
- `.env*` files → read **only** the `AZURE_SUBSCRIPTION_ID` line; never load, echo, or
  summarize other `.env*` contents (they routinely hold secrets)
- environment variable `AZURE_SUBSCRIPTION_ID`

Then **classify each** discovered subscription by environment (see table below) and carry
the `(id, name, environment, source)` tuple forward so every per-subscription result can
be attributed and grouped in the summary. If only one subscription is found, the review
simply runs once. Always mention each *source* in the final chat summary
(e.g. "dev sub from `infra/main.parameters.json`, prod sub from `.azure/prod/config.json`").

## Widen to the whole tenant — on request or as fallback

Enumerate **all** subscriptions the signed-in identity can access when either:

- the user explicitly asks for a tenant-wide / org-wide sweep ("all my subscriptions",
  "every subscription in the tenant"), **or**
- repo discovery above found nothing.

Invoke the Azure MCP **subscription-list** tool (a tool whose name contains `subscription`
and whose description says "list Azure subscriptions"). Do **not** hardcode ids. Classify
each result with the same table below. If no subscription-list tool is available and repo
discovery also found nothing, fall back to **Ask the user**.

## Ask the user — last resort

Only if repo discovery yields nothing **and** tenant enumeration is unavailable. Do not
guess. Say which files were scanned and what was missing.

## Classify each subscription by environment

Use the first signal that matches:

- **Tags** — an `Environment` / `env` tag value (e.g. `Production`, `Staging`, `Dev`).
- **Name / config keywords** (case-insensitive substring) when no tag exists — the
  subscription name, or the azd environment / param-file name it came from:

  | Bucket | Match any of |
  |---|---|
  | **prod** | `prod`, `production`, `prd`, `live` |
  | **staging** | `stag`, `staging`, `stg`, `uat`, `preprod`, `pre-prod` |
  | **test** | `test`, `qa`, `sit` |
  | **dev** | `dev`, `development`, `sandbox`, `sbx` |
  | **other** | nothing above matched — list under "Unclassified" |

Never invent an environment; if ambiguous, place it in **other** and say so.

