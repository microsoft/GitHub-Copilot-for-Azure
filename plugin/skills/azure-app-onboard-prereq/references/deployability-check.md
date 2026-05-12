# Deployability Check

> ⛔ **No build/install/test commands — `npm install`, `npm test`, `dotnet build`, `dotnet restore`, `dotnet test`, `pip install`, `pytest`, `go mod download`, `cargo build`. Use static analysis only during this check.**

Assess whether the repository can feasibly be deployed to Azure and whether a preparation plan can be created.

> ⛔ **You MUST read the following in order. Skip items marked conditional if the condition is not met:**
>
> 1. [component-mapping.md](component-mapping.md) — Steps 1–2: Component→Azure mapping, existing infrastructure detection, Terraform provider classification, compose service extraction. **Conditional: monorepo only (>1 project manifest found).** For single-component repos, skip to Step 3.
> 2. [dependency-compatibility.md](dependency-compatibility.md) — Step 3: Cloud SDK deps, EOL runtimes/frameworks, archived repos, vulnerable apps, platform deps, Dockerfile analysis, native module detection
> 3. Steps 4–5 below

## Step 4: Recipe Feasibility

Assess whether at least one deployment recipe is viable.

| Check | Question |
|-------|----------|
| AZD feasible? | Standard web app stack? No exotic build requirements? |
| Container feasible? | Can be Dockerized? Or already has Dockerfile? |
| Functions feasible? | Event-driven or HTTP-triggered stateless handlers? |
| Terraform feasible? | User has TF experience or existing TF files? |

| Outcome | Verdict |
|---------|---------|
| At least one recipe clearly viable | ✅ PASS |
| Viable with modifications | ⚠️ WARN — note required changes |
| No viable recipe identified | ❌ FAIL |

## Step 5: Specialized Skill Detection

Check if the repo needs a specialized skill instead of standard azure-prepare.

| Dependency / Pattern | Specialized Skill |
|---------------------|-------------------|
| `@github/copilot-sdk`, `github-copilot-sdk`, `GitHub.CopilotSdk` | **azure-hosted-copilot-sdk** |

If a specialized dependency is found, note it in the report so azure-prepare routes correctly.

> **Non-Azure cloud SDK deps** (AWS/GCP SDKs, Firebase, etc.) are NOT routed to a specialized skill. They are flagged as `CLOUD_SDK_DEPENDENCY` findings with Azure equivalents mapped, and handled inline during the scaffold phase via SDK swaps.
