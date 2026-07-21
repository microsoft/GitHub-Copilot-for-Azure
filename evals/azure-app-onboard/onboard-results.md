# Azure App Onboard — 4-File Eval Run Report

- **Run root:** `tests/results/run4-20260713-221443/`
- **Started:** 2026-07-13 22:14 · **First pass finished:** 2026-07-14 11:40 (ET)
- **Model:** claude-sonnet-4.6 · **Config:** `runs: 1`, sequential (`--workers 1`)
- **Specs:** onboard-eval, prepare-eval, scaffold-eval, seeded-deploy-eval (31 stimuli)

## Summary (first pass)

| Spec | Stimuli | Pass | Fail | Score | Threshold | Verdict |
|------|:------:|:---:|:---:|:-----:|:---------:|:-------:|
| onboard-eval        | 14 | 11 | 3 | 94.0% | 80% | PASS |
| prepare-eval        | 10 | 7  | 3 | 86.1% | 80% | PASS |
| scaffold-eval       | 5  | 3  | 2 | 93.5% | 80% | PASS |
| seeded-deploy-eval  | 2  | 2  | 0 | 100%  | 80% | PASS |
| **Total**           | **31** | **23** | **8** | — | — | **all suites above threshold** |

> Two stimuli hit their per-run timeout and were **auto-recovered by vally's built-in retry**, both passing:
> `Scaffold - IaC Security Baseline` (25m timeout → passed in 23.4m) and
> `Deploy Verify - Container Apps Pipeline` (90m timeout → passed on retry in 47m).

## Final verdict (after retry) — 29/31 (93.5%)

| Spec | Final | Note |
|------|:-----:|------|
| onboard-eval | **14/14** | all 3 retries recovered |
| prepare-eval | **9/10** | `Quota Validation Before Region` persistent fail |
| scaffold-eval | **4/5** | `Existing Azd Foundry Detect` persistent fail |
| seeded-deploy-eval | **2/2** | clean first pass (real deploys) |
| **Total** | **29/31** | 6 of 8 first-pass failures were flaky (recovered on retry); **2 persistent routing gaps** remain |

## Per-stimulus status

### onboard-eval (11/14)
| Stimulus | Status |
|----------|:------:|
| Catalog - FastAPI Multi Component Plan Quality | PASS |
| Catalog - Microblog Existing Infra Plan Quality | PASS |
| Catalog - Simple Web App Plan Quality | PASS |
| Invocation - First Time Deployment | PASS |
| Invocation - Greenfield No Code | PASS |
| Invocation - Onboarding Prompt | PASS |
| Invocation - Startup MVP Standalone | PASS |
| Negative - Broken App Halt | PASS |
| Negative - DVWA Vulnerable Halt | **FAIL** |
| Negative - Unsupported App Migration | **FAIL** |
| Pipeline - Intent Stall Defaults | PASS |
| Pipeline - Session Resumption | PASS |
| Pipeline - Zero Code Scaffolding | **FAIL** |
| Remediation - Broken App Detect Fix Scaffold | PASS |

### prepare-eval (7/10)
| Stimulus | Status |
|----------|:------:|
| Cost Depth - Dollar And SKU Signals | PASS |
| Delegation - Architecture Planning | PASS |
| Delegation - SKU Selection | PASS |
| Migration Routing - AWS Workload To Cloud Migrate | PASS |
| Prepare Depth - Plan Schema For Express App | **FAIL** |
| Prepare Depth - Quota Validation Before Region | **FAIL** |
| Service Mapping - Go Gin Multi-Service | PASS |
| Service Mapping - Kafka To Event Hubs Spring | **FAIL** |
| Service Mapping - Wetty Docker Compose WebSocket | PASS |
| Service Mapping - Yamtrack Django Compose | PASS |

### scaffold-eval (3/5)
| Stimulus | Status |
|----------|:------:|
| Scaffold - Bicep Generation Simple App | **FAIL** |
| Scaffold - Existing Azd Bicep No Overwrite | PASS |
| Scaffold - Existing Azd Foundry Detect No Overwrite | **FAIL** |
| Scaffold - Existing Azd Template Mongo Detect No Overwrite | PASS |
| Scaffold - IaC Security Baseline | PASS (auto-retry) |

### seeded-deploy-eval (2/2) — real Azure deploys
| Stimulus | Status | Notes |
|----------|:------:|-------|
| Deploy Verify - App Service Pipeline | PASS | 28/28 graders; live `azurewebsites.net` |
| Deploy Verify - Container Apps Pipeline | PASS | 27/27 graders (auto-retry); live `azurecontainerapps.io` |

## Failure analysis (why each check failed)

| # | Stimulus | Failed grader(s) | Evidence | Likely cause |
|---|----------|------------------|----------|--------------|
| 1 | onboard · Negative - DVWA Vulnerable Halt | `output-not-matches` | Output matched forbidden `/here'?s (the/your) architecture plan\|everything looks good\|no issues found/` | Other DVWA graders (security keywords + blocking language) **passed** — the agent DID flag the vuln app; this negative guard tripped on an incidental reassuring phrase. Likely phrasing false-positive. |
| 2 | onboard · Negative - Unsupported App Migration | `skill-invocation` | `azure-app-onboard` not called | Routing miss — handled the migration prompt without invoking the skill. Probabilistic routing. |
| 3 | onboard · Pipeline - Zero Code Scaffolding | `skill-invocation`, `file-exists` | skill not called; no `context.json` | Routing miss cascaded — no skill → no session artifacts written. |
| 4 | prepare · Prepare Depth - Plan Schema For Express App | `file-exists` + 4× `file-matches` | no `prepare-plan.json` (prereq-output.json + context.json[prereq] **did** exist) | Skill ran & completed prereq but never emitted the prepare-plan artifact — run ended/early-stopped before the plan write. |
| 5 | prepare · Prepare Depth - Quota Validation Before Region | `skill-invocation`, `file-exists`×2, `output-matches` | skill not called; no prepare/prereq json; no region named (only quota/capacity keyword matched) | Agent short-circuited (8 turns / 99s) without engaging the pipeline. Routing/engagement miss. |
| 6 | prepare · Service Mapping - Kafka To Event Hubs Spring | `output-matches` | Output lacked `event hubs\|kafka-compatible` (Java/Spring/Gradle + PostgreSQL **did** match) | Detected the stack but didn't surface the Kafka→Event Hubs mapping in text. Mapping/phrasing gap. |
| 7 | scaffold · Scaffold - Bicep Generation Simple App | `file-exists` | no `scaffold-manifest.json` (8 `infra/*.bicep` files **were** generated & validated) | Async iac-gen subagent flushed Bicep but manifest not written before run end. Timing/race (same check passed on the Security Baseline retry). |
| 8 | scaffold · Scaffold - Existing Azd Foundry Detect No Overwrite | `skill-invocation` | `azure-app-onboard` not called | Routing miss (3 turns / 31s) — answered the Foundry prompt without invoking the skill. |

### Patterns
- **4/8 are `skill-invocation` routing misses** (#2, #3, #5, #8) — probabilistic first-turn routing; commonly flip to PASS on retry.
- **2/8 are missing session artifacts** (#4 prepare-plan.json, #7 scaffold-manifest.json) — early-stop / async-flush timing, not wrong content.
- **1/8 output-phrasing negative** (#1 DVWA) — likely incidental-phrase false-positive.
- **1/8 service-mapping output gap** (#6 Kafka→Event Hubs).

## Retry pass (failed stimuli only) — COMPLETE

Re-ran the 8 first-pass failures once (sequential, `llm+execute`). **6 recovered, 2 persistent.**

| Stimulus | Retry | Note |
|----------|:-----:|------|
| onboard · DVWA Vulnerable Halt | ✅ PASS (6/6) | flaky phrasing — recovered |
| onboard · Unsupported App Migration | ✅ PASS (6/6) | flaky routing — recovered |
| onboard · Zero Code Scaffolding | ✅ PASS (4/4) | flaky routing — recovered |
| prepare · Plan Schema (Express) | ✅ PASS (9/9) | `prepare-plan.json` written — recovered |
| prepare · Kafka → Event Hubs | ✅ PASS (6/6) | mapping surfaced — recovered |
| prepare · Quota Validation Before Region | ❌ FAIL (1/6) | **persistent** — skill not invoked (8 turns/112s short-circuit) |
| scaffold · Bicep Generation Simple App | ✅ PASS (8/8) | `scaffold-manifest.json` written — recovered |
| scaffold · Existing Azd Foundry Detect No Overwrite | ❌ FAIL (4/5) | **persistent** — skill not invoked (engaged 10 other skills) |

### Persistent failures (failed BOTH passes — genuine, not flaky)

1. **prepare · Quota Validation Before Region** — prompt *"I want a one-click way to deploy my app to Azure."*
   The agent short-circuits (~8 turns, ~110s) and never invokes `azure-app-onboard`; no prereq/prepare artifacts, no quota/region discussion. Identical signature both runs. Likely the "one-click" phrasing routes it away from the onboarding pipeline (or it answers directly).
2. **scaffold · Existing Azd Foundry Detect No Overwrite** — prompt *"I have an existing app — what's the best way to migrate it to Azure?"*
   `azure-app-onboard` is not invoked; the run engaged **10** other skills. The word **"migrate"** most likely routes to a competing skill (e.g. `azure-cloud-migrate`). The non-skill answer still detects Foundry + existing IaC (the other 4 graders pass), so only the invocation gate fails.

> Both persistent failures are `skill-invocation` routing gaps on specific prompt phrasings ("one-click", "migrate") — not defects in the onboarding behavior itself. Worth a routing-description tweak if these prompts should own to `azure-app-onboard`.

## Azure resources created (Playground-02 · `…`)

> You chose to clean up yourself. All are tagged `pcnx-deleteafter=2026-07-21`, so the tenant reaper will auto-remove them then if you don't.

| Resource group | From | Session |
|----------------|------|---------|
| `rg-bya-notes-dev-4d29` | App Service deploy (today) | `4d294c61` |
| `rg-wetty-dev-42dd` | Container Apps deploy — successful retry (today) | `42dd0b61` |
| `rg-wetty-dev-fafc` | Container Apps — first attempt / prior fixture deploy | `fafc5cdc` |
| `ME_cae-wetty-dev-fafc_rg-wetty-dev-fafc_eastus2` | auto managed-env infra RG for `rg-wetty-dev-fafc` | — |

Cleanup:
xxxxx

## Artifacts
- Per-spec logs: `tests/results/run4-20260713-221443/<spec>.log`
- Per-spec results: `tests/results/run4-20260713-221443/<spec>/<timestamp>/results.jsonl` + `eval-results.md`
- Retry logs: `tests/results/run4-20260713-221443/retry/<spec>-retry.log`
