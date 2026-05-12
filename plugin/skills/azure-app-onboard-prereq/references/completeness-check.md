# Completeness Check

> ⛔ **No build/install/test commands — `npm install`, `npm test`, `dotnet build`, `dotnet restore`, `dotnet test`, `pip install`, `pytest`, `go mod download`, `cargo build`. Use static analysis only during this check.**

Verify the repository has required components for a deployable application.

### 1. Entry Point

The app must have a clear entry point — something that starts the application.

| Stack | Expected Entry Point |
|-------|---------------------|
| Node.js | `main` or `start` script in `package.json` |
| Python | `app.py`, `main.py`, `manage.py`, or entry in `pyproject.toml` |
| .NET | `Program.cs` or `Startup.cs` in a project with `<OutputType>Exe</OutputType>` |
| Java | Class with `public static void main` or Spring Boot `@SpringBootApplication` |
| Go | `main.go` in a `package main` |
| Static | `index.html` at root or in a known output folder |

| Outcome | Verdict |
|---------|---------|
| Entry point found and referenced file exists on disk | ✅ PASS |
| Ambiguous (multiple candidates) | ⚠️ WARN — note candidates |
| No entry point | ❌ FAIL |
| Entry point declared but file does not exist | ❌ FAIL — app crashes with `MODULE_NOT_FOUND` |

### 2. Dependency Manifest

The app should declare its dependencies explicitly.

| Stack | Expected File |
|-------|--------------|
| Node.js | `package.json` with `dependencies` |
| Python | `requirements.txt`, `Pipfile`, or `pyproject.toml` |
| .NET | `*.csproj` with `<PackageReference>` |
| Java | `pom.xml` or `build.gradle` |
| Go | `go.mod` |

| Outcome | Verdict |
|---------|---------|
| Manifest found with dependencies listed | ✅ PASS |
| Manifest exists but empty dependencies | ⚠️ WARN |
| No manifest found | ❌ FAIL (unless static site) |

### 3. Configuration

| What to Check | Why |
|---------------|-----|
| `.env.example` or `.env.sample` | Documents required env vars |
| Config files (`appsettings.json`, `config.yaml`) | App configuration |
| Hardcoded secrets | Security risk |
| Port configuration | Needed for hosting |

| Outcome | Verdict |
|---------|---------|
| Config properly externalized | ✅ PASS |
| Hardcoded values but no secrets | ⚠️ WARN |
| Hardcoded secrets in source (no env var fallback) | ❌ FAIL — security risk |
| Config with env var + hardcoded fallback default (e.g., `os.environ.get('KEY') or 'default'`) | ⚠️ WARN — override exists but default is risky |
| `.env` files with placeholder values (`changethis`, `your-secret-here`) + runtime validation | ✅ PASS — externalization working as designed |
| No config or env vars at all | ⚠️ WARN — may be fine for simple apps |

> **Severity:** (a) Literal secrets with no env var fallback → ❌ FAIL. (b) Hardcoded fallback defaults with `getenv()` → ⚠️ WARN. (c) `.env` with placeholders + validation → ✅ PASS.

### 4. Documentation

| Outcome | Verdict |
|---------|---------|
| README with build/run instructions | ✅ PASS |
| README exists but sparse, or no README | ⚠️ WARN |

### 5. Listening Port (for web apps)

Web applications must bind to a port for hosting on Azure.

| Stack | How to Detect |
|-------|---------------|
| Node.js | `app.listen`, `server.listen`, or `PORT` env var usage |
| Python | `uvicorn`, `gunicorn`, `flask run`, or `PORT` env |
| .NET | `Kestrel` config, `launchSettings.json`, `ASPNETCORE_URLS`, or `WebApplication.CreateBuilder()` |
| Java | Framework port config in `application.properties` / `application.yml` (Spring Boot `server.port`, Quarkus `quarkus.http.port`, etc.) or `PORT` env |

> **Note:** .NET 6+ apps using `WebApplication.CreateBuilder()` bind to ports 5000/5001 by default without explicit config. Check for `builder.Build()` + `app.Run()` pattern as an implicit port signal.

| Outcome | Verdict |
|---------|---------|
| Port binding detected | ✅ PASS |
| No port binding (CLI tool, worker, function) | ✅ PASS — not applicable |
| Web app with no port binding | ❌ FAIL |

### 6. Static Asset Integrity (Web Apps)

For apps with HTML files: verify CSS/JS/image references resolve to files that exist in the workspace. Parse `href`/`src` from `<link>`, `<script>`, `<img>` tags. Check relative to HTML file's directory (or root for `/` paths). Ignore external URLs. Also check CSS `@import` for broken references.

| Outcome | Verdict |
|---------|---------|
| All referenced CSS/JS/image assets found | ✅ PASS |
| `<link rel="icon">` or `<link rel="shortcut icon">` with broken `href` | ⚠️ WARN — cosmetic only, page renders correctly |
| Any other broken `<link href>`, `<script src>`, `<img src>` reference | ❌ FAIL (🔧 Recommended Fix) — list each broken reference with the HTML file and line. The site renders without styles or scripts — users see a broken page. Prereq should offer to fix. |
| No HTML files | ✅ PASS — not applicable |

### 7. Container Readiness

| What to Check | Why |
|---------------|-----|
| `.dockerignore` present when Dockerfile exists | Prevents bloated images |
| Dockerfile `EXPOSE` port matches app listening port | Mismatch causes 502. Extract to `buildRequirements.exposedPort` |

| Outcome | Verdict |
|---------|---------|
| Dockerfile + .dockerignore both present | ✅ PASS |
| Dockerfile present, no .dockerignore | ⚠️ WARN |
| Multi-process container detected (`supervisord`, `s6-overlay`, `tini` + daemon, multiple CMD/ENTRYPOINT) | ⚠️ WARN — health probes and scaling may not work as expected |
| No Dockerfile | ✅ PASS — not applicable |

### Stack-Specific Mandatory Checks (Always Evaluate)

These checks ALWAYS run for matching stacks, regardless of scan order or prior findings:

| Stack | Condition | Verdict | Always |
|-------|-----------|---------|--------|
| Node.js | No `engines` field in `package.json` | ⚠️ WARN — Azure may select unexpected Node.js version | Yes |
| Node.js | `express-session` without external store (`connect-redis`, `connect-mongo`, etc.) | ⚠️ WARN — sessions lost on restart (ephemeral, same as SQLite on PaaS) | Yes |
| Any web app | No health endpoint (`/health`, `/healthz`, `/api/health`) | ⚠️ WARN — health probes will fail on Azure | Yes |
| Static file server | No health endpoint | ✅ PASS (N/A) — static sites (pure HTML/CSS/JS, no server process) respond 200 on `/` by default. Skip W-HEALTH. | Yes |
| Node.js (Express) | `cookie.secure` or `cookie: { secure: true }` in Express session config without `trust proxy` setting | ⚠️ WARN `W-TRUST-PROXY` — "Express behind Azure proxy: `trust proxy` must be set when using secure cookies. Without it, `req.protocol` is always `http` and secure cookies are never sent." | Yes |
| Any | README.md missing or <50 bytes | ⚠️ WARN | Yes |

> **Do not short-circuit.** Iterate ALL sub-checks (1–7 + mandatory) for every component. A scan that finds 1/8 real issues has failed its purpose.

**Scan depth rule:** Evaluate ALL 7 checks + ALL applicable mandatory sub-checks per component. Track count: "Evaluated N/N checks for component {name}." Skipped checks require reason.

> ⛔ **Scan completeness self-check — MANDATORY.** Verify: "Evaluated {N}/7 checks + {M}/4 mandatory sub-checks for component {name}." If N < 7, go back. Every check MUST have explicit PASS/WARN/FAIL. This line MUST appear in `prereq-output.json` per component.

## Verdict → Severity Tier Mapping

| Check | ❌ FAIL Condition | Severity Tier |
|-------|------------------|---------------|
| 1. Entry Point | No entry point | ❌ Critical (app crashes on startup) |
| 2. Dependency Manifest | No manifest found (non-static) | 🔧 Recommended Fix |
| 3. Configuration | Hardcoded secrets in source | 🔧 Recommended Fix |
| 5. Listening Port | Web app with no port binding | ❌ Critical (502 on every request) |
| 6. Static Asset Integrity | Broken CSS/JS/image references | 🔧 Recommended Fix |
| 7. Container Readiness | Dockerfile EXPOSE port mismatch | 🔧 Recommended Fix |
| Mandatory | `express-session` without external store | ⚠️ Warning |

All ⚠️ WARN verdicts (sparse README, no `.dockerignore`, no `engines` field, no health endpoint, etc.) are **Warning** tier — informational, non-blocking, NEVER included in fix plans, NEVER counted as blockers.
