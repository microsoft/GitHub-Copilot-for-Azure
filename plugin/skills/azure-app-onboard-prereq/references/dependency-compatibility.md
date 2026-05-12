Dependency compatibility checks for Azure deployment. Part of the [deployability check](deployability-check.md).

## Non-Azure Cloud Service Dependencies

All entries below are 🔧 `CLOUD_SDK_DEPENDENCY` — inline swap during scaffold. Include in `prereq-output.json.cloudSdkSwaps[]`. Do NOT halt the pipeline — these are handled during scaffold.

| Found Dependency | Azure Equivalent |
|-----------------|-----------------|
| AWS DynamoDB (`AWSSDK.DynamoDBv2`, `@aws-sdk/client-dynamodb`), GCP Firestore | Cosmos DB (NoSQL API) |
| AWS Cognito (`AWSSDK.CognitoIdentityProvider`, `amazon-cognito-identity-js`), Firebase auth (`firebase-admin`) | Entra ID / Entra External ID |
| AWS S3, GCP Cloud Storage (`@google-cloud/storage`), MinIO | Azure Blob Storage |
| AWS Lambda, GCP Cloud Functions (handler signatures) | Azure Functions (rewrite handlers) |
| AWS SQS (`@aws-sdk/client-sqs`, `AWSSDK.SQS`), GCP Cloud Tasks (`google-cloud-tasks`) | Queue Storage / Service Bus |
| AWS SNS (`@aws-sdk/client-sns`, `AWSSDK.SimpleNotificationService`), GCP Pub/Sub (`google-cloud-pubsub`) | Service Bus / Event Grid |
| Firebase (`firebase`, `firebase-admin`) full stack | Entra ID + Cosmos DB + Functions |

> **Observability carve-out:** Observability deps are ⚠️ WARN (swap recommended but app runs without them), NOT blocking. Functional deps remain 🔧 CLOUD_SDK_DEPENDENCY (blocking — needs inline swap). Use this table:
>
> | Package | Classification | Why |
> |---------|---------------|-----|
> | `@google-cloud/opentelemetry-*` | ⚠️ WARN (observability) | Telemetry — app works without it |
> | `@google-cloud/logging` | ⚠️ WARN (observability) | Logging — app works without it |
> | `@google-cloud/monitoring` | ⚠️ WARN (observability) | Monitoring — app works without it |
> | `aws-xray-sdk`, `aws-rum-web` | ⚠️ WARN (observability) | Tracing/RUM — app works without it |
> | `google-cloud-tasks` | 🔧 CLOUD_SDK_DEPENDENCY | Functional — task queue, app breaks without it |
> | `google-cloud-pubsub` | 🔧 CLOUD_SDK_DEPENDENCY | Functional — messaging, app breaks without it |
> | `google-cloud-storage` | 🔧 CLOUD_SDK_DEPENDENCY | Functional — file storage, app breaks without it |
> | `@aws-sdk/client-dynamodb`, `boto3` (DynamoDB) | 🔧 CLOUD_SDK_DEPENDENCY | Functional — data access, app breaks without it |
> | `@aws-sdk/client-sqs`, `@aws-sdk/client-sns` | 🔧 CLOUD_SDK_DEPENDENCY | Functional — messaging, app breaks without it |

## EOL / Unsupported Runtimes

| Runtime | Verdict |
|---------|--------|
| .NET Framework 4.x, ASP.NET Core 2.1 | 🔶 Major Migration — major version upgrade required (.NET 8+). Agent can attempt but must warn about scope. |
| Python 2.x | 🔶 Major Migration — Python 2 EOL since 2020, full migration to Python 3 required. Agent can attempt but significant. |
| Node.js < 18, Java < 11 | ❌ FAIL — evaluate: if upgrade is config-only (update `engines`, no API changes), agent can fix. If APIs changed across the version gap, classify as 🔶 Major Migration. |

> **Quick test:** Can the runtime upgrade be done by changing ONE config value (e.g., `"engines": {"node": "20"}` in `package.json`, or `<TargetFramework>net8.0</TargetFramework>` in `.csproj`) without touching ANY import/require/using statements? If yes → ❌ FAIL (agent fixable). If no → 🔶 Major Migration.

**Ecosystem-era check (Python):** ALL pinned deps from pre-2018, no Python 3.10+ wheels → ❌ FAIL. Signals: `flask_script`, `werkzeug<1.0`, `itsdangerous<1.0`, imports from `werkzeug.contrib.*` / `flask.ext.*`.

## EOL / Unmaintained Frameworks

> ⛔ Distinct from runtime EOL. A current runtime + EOL framework (e.g., Python 3.9 + Flask 0.12) needs this check.

| Framework | EOL Version | Verdict |
|-----------|------------|---------|
| Flask < 2.0, Django < 3.2, Express < 4.0, Rails < 6.0, Spring Boot < 2.7 | See version | 🔶 Major Migration — known CVEs, deprecated APIs removed in modern versions. Framework migration touches many files. Agent can attempt but must warn about scope. |
| React < 16, Angular < 14, Next.js < 13 | See version | ⚠️ WARN |

## Archived / Abandoned Repositories

| Signal | Verdict |
|--------|--------|
| GitHub API `archived: true` + EOL runtime/framework | 🔶 Major Migration — archived + EOL. Agent can attempt migration but warn: no security patches, project is unmaintained. |
| GitHub API `archived: true` (current runtime) | ⚠️ WARN — archived but may still deploy. Warn about lack of maintenance. |
| README: "archived", "deprecated", "unmaintained", "no longer maintained" + EOL stack | 🔶 Major Migration — unmaintained + EOL = significant migration |
| README: "archived", "deprecated", "unmaintained" (current runtime) | ⚠️ WARN — unmaintained but may deploy |
| Last commit >3 years + EOL framework | ⚠️ WARN |

> **Remediation scope rule:** If fixing all blockers requires a runtime/framework major version upgrade OR touches >5 source files → classify as 🔶 Major Migration. Agent offers to attempt but warns about scope.

## Intentionally Vulnerable Applications

Detect via **code structure first**, metadata second. These apps are designed to be exploited — the vulnerability IS the product.

**Code signals (check these first):**
- Directory named `vulnerabilities/` with subdirs like `sqli/`, `xss/`, `csrf/`, `fi/` (file inclusion)
- Security-level config that toggles vulnerability severity (e.g., `default_security_level`, `security.level`, `difficulty`)
- Source files that intentionally pass unsanitized `$_GET`/`$_POST`/`$_REQUEST` directly into SQL queries, shell commands (`exec`, `shell_exec`, `system`), or `eval`/`include` across multiple endpoints — not a single bug, but a systematic pattern across 3+ files
- `hackable/` directories, `exploit/` directories, or files with names like `command_injection.php`, `brute_force.php`

**Metadata signals (secondary confirmation):**
- Project description, `composer.json` description, `package.json` description, or repo "About" containing: "deliberately vulnerable", "intentionally insecure", "vulnerable by design", "security training", "penetration testing", "do not deploy to production"
- License or README warnings against internet-facing deployment

**Verdict:** If ≥2 code signals match, OR 1 code signal + 1 metadata signal → 🛑 HALT. A single metadata mention alone → ⚠️ WARN (could be a disclosure, not a feature).

## Platform-Specific Dependencies

| Dependency Type | Verdict |
|----------------|---------|
| Native OS binaries (`.so`, `.dll`) | ⚠️ WARN |
| Native Node.js addons on free/low-tier SKUs | ⚠️ WARN — may fail on sandboxed tiers |
| GPU-required libraries (CUDA) | ⚠️ WARN |
| Local file system writes (not temp), file-based DBs | ⚠️ WARN — ephemeral on PaaS |
| BuildKit Dockerfile syntax (`--mount`, `# syntax=`) | ⚠️ WARN — set `buildRequirements.hasBuildKitSyntax: true` |
| Jib container build (no Dockerfile) | ⚠️ WARN — note Jib path for scaffold |
| Redis client without TLS | ⚠️ WARN `W-REDIS-TLS` — Azure Redis requires TLS (port 6380). **Per-language detection:** (Go) `redis.NewClient`/`redis.Options` without `TLSConfig: &tls.Config{}` or `rediss://`. (Node) `createClient` from `redis`/`ioredis` without `tls: {}` or `rediss://`. (Python) `redis.Redis(` without `ssl=True` or `rediss://`. Fix per language, present at deploy gate |
| PostgreSQL client with SSL disabled | ⚠️ WARN `W-PG-SSL` — Azure PG requires SSL. Detect: `sslMode: disable`, `sslmode=disable`, `ssl: false`, connection strings without `?sslmode=require`. Fix: set `PGSSLMODE=require` env var in IaC (prefer env var over code change), present at deploy gate |
| Licensed/proprietary SDKs | ⚠️ WARN |

## Hardcoded Localhost URLs

> Scan config files and source for hardcoded network addresses that will break after deploy.

| Pattern | Verdict |
|---------|---------|
| `localhost`, `127.0.0.1`, `0.0.0.0` in API base URLs, swagger host, CORS origins, webhook URLs, service discovery endpoints | ⚠️ WARN `W-LOCALHOST-URL` — hardcoded URL will break after deploy. Use environment variable or runtime detection |

> **Exclude:** database connection strings (handled in Database & Storage section), dev-only files (`.env.development`, `.env.local`), test files (`*.test.*`, `*.spec.*`).

## Dockerfile Analysis

| Pattern | Verdict |
|---------|---------|
| `CMD.*uv run` or `ENTRYPOINT.*uv run` | ⚠️ WARN `W-UV-RUN` — dependency sync at startup fails as non-root. Use direct command instead |
| `CMD.*poetry run` or `ENTRYPOINT.*poetry run` | ⚠️ WARN `W-POETRY-RUN` — may attempt installs at startup |

> Also check `docker-compose.yml` `command:` overrides for the same `uv run`/`poetry run` patterns.

## Native Module Detection

Static lockfile analysis — no install/build execution.

| Language | Signal | Where |
|----------|--------|-------|
| Node.js | `"node-gyp"` in lockfile | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| Python | `numpy`, `pandas`, `grpcio`, `Pillow`, `bcrypt`, `psycopg2` (not `-binary`), `cryptography`, `lxml`, `scipy`, `scikit-learn` | `requirements.txt`, `pyproject.toml` |
| .NET | `[DllImport]`, `NativeLibrary.Load` | `.cs` files |
| Go | `import "C"` (cgo) | `.go` files |
| PHP | `ext-*` requirements | `composer.json` |

> `prebuild-install` without `node-gyp` = prebuilt binaries, NOT native. Set `hasNativeModules: false`, `f1Viable: true`.

**Key edge cases:** `bcrypt` ✅ native, `bcryptjs` ❌ pure JS. `psycopg2` ✅ native, `psycopg2-binary` ❌. `sharp` v0.33+ ❌ usually prebuilt. `canvas` ✅ always native.

When `hasNativeModules: true`: set `f1Viable: false`, `f1BlockReason: "native modules ({signal})"`, set `estimatedInstallTime`. No lockfile → `nativeModuleSignal: "unknown"`, ⚠️ WARN.

## F1 Viability — Beyond Native Modules

Set `f1Viable: false` when ANY of these are true (native modules covered above):

| Condition | Detection | f1BlockReason |
|-----------|-----------|---------------|
| Large dependency tree | Python >10 pinned deps, Node.js lockfile >500KB, .NET >20 NuGet `<PackageReference>`, Java WAR/JAR | `"large dependency tree ({N} deps)"` |
| Build-time compilation | `tsconfig.json` + `"build"` script in `package.json` | `"build-time compilation (TypeScript)"` |
| WSGI/ASGI server | `gunicorn`, `uvicorn`, or `daphne` in Python deps (`requirements.txt`, `pyproject.toml`) | `"WSGI/ASGI server ({name})"` |
| 🔶 Major Migration | >5 source files changed during remediation | `"major migration ({N} files changed)"` |

When `f1Viable: false`: prepare selects B1 (~$13/mo) minimum.

## Database & Storage

| Found | Assessment |
|-------|-----------|
| File-based DB (SQLite, LevelDB, DuckDB) | ⚠️ WARN — ephemeral on PaaS. Deploy as-is, suggest managed DB in `postDeployRecommendations[]` |
| Local file storage | Needs Azure Blob Storage |
| In-memory cache only | Consider Redis |
| Managed DB connection string | Ready — update connection |

## Framework Detection

| Dependency Signal | Framework | Action |
|-------------------|-----------|--------|
| `azure_ai_projects`, `azure-ai-agents`, `foundry-agents` | `foundry-agents` | Route to `microsoft-foundry` skill |
