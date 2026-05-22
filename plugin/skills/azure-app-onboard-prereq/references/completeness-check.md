# Completeness Check

> ⛔ **No build/install/test commands during this check.** Use static analysis only.

Verify repository has required components for a deployable app.

### 1. Entry Point

Verify main/index file exists for each component.

| Stack | Expected Entry Point |
|-------|---------------------|
| Node.js | `main` or `start` script in `package.json` |
| Python | `app.py`, `main.py`, `manage.py`, or entry in `pyproject.toml` |
| .NET | `Program.cs` or `Startup.cs` with `<OutputType>Exe</OutputType>` |
| Java | Class with `public static void main` or `@SpringBootApplication` |
| Go | `main.go` in `package main` |
| Static | `index.html` at root or in output folder |

| Outcome | Verdict |
|---------|---------|
| Entry point found and file exists on disk | ✅ PASS |
| Ambiguous (multiple candidates) | ⚠️ WARN |
| No entry point | ❌ FAIL |
| Entry point declared but file missing | ❌ FAIL — `MODULE_NOT_FOUND` |

### 2. Dependency Manifest

| Outcome | Verdict |
|---------|---------|
| Manifest found with dependencies | ✅ PASS |
| Manifest exists but empty deps | ⚠️ WARN |
| No manifest found | ❌ FAIL (unless static site) |

> ⛔ **Oryx reads manifests ONLY at repo root.** Subdirectory manifests → ⚠️ WARN (🔧 Fix): create root wrapper (Python: `-r {subdir}/requirements.txt`, Node: workspaces). Add to batch-then-approve.

### 3. Configuration

| Outcome | Verdict |
|---------|---------|
| Config properly externalized | ✅ PASS |
| Hardcoded values but no secrets | ⚠️ WARN |
| Hardcoded secrets in source (no env var fallback) | ❌ FAIL |
| Env var + hardcoded fallback default | ⚠️ WARN |
| `.env` with placeholder values + runtime validation | ✅ PASS |

> **Compose file credentials:** Literal `*PASSWORD=<value>` with NO `${VAR}` → ❌ FAIL. `${VAR:-default}` → ⚠️ WARN. `${VAR}` only → ✅ PASS. ⛔ Do NOT downgrade based on filename ("dev-only") — treat every compose file as potentially production-bound.

### 4. Documentation

README with build/run instructions → ✅ PASS. Sparse/no README → ⚠️ WARN.

### 5. Listening Port

Web apps must bind a port. Detect via `app.listen`, `PORT` env var, framework port config, `WebApplication.CreateBuilder()` (implicit 5000/5001 .NET 6+).

| Outcome | Verdict |
|---------|---------|
| Port binding detected | ✅ PASS |
| Non-web (CLI, worker, function) | ✅ PASS — N/A |
| Web app with no port binding | ❌ FAIL |

### 6. Static Asset Integrity

Parse `href`/`src` from HTML tags. Check relative to HTML file directory. Ignore external URLs.

| Outcome | Verdict |
|---------|---------|
| All referenced assets found | ✅ PASS |
| Broken favicon only | ⚠️ WARN |
| Broken `<link>`, `<script>`, `<img>` reference | 🔧 Recommended Fix — set `fixPhase: "prereq"` |

### 7. Container Readiness

| Outcome | Verdict |
|---------|---------|
| Dockerfile + .dockerignore present | ✅ PASS |
| Dockerfile, no .dockerignore | ⚠️ WARN |
| Multi-process container detected | ⚠️ WARN |
| `CMD.*uv run` or `CMD.*poetry run` | ⚠️ WARN — dep sync at startup fails as non-root. **fix:** "Replace with direct command" **fixPhase:** `prereq` |
| `EXPOSE` port mismatch with app | 🔧 Fix — mismatch causes 502. Extract to `buildRequirements.exposedPort` |

### Stack-Specific Checks

Verify these patterns. Assess severity with tier definitions from [readiness-gate.md](readiness-gate.md) — only ❌ FAIL if causes deploy failure or startup crash.

- **Node.js:** `engines` field, session store type (MemoryStore = ephemeral), health endpoint
- **Express:** trust proxy when secure cookies are used behind reverse proxy
- **Any web app:** health endpoint (`/health`, `/healthz`), README documentation
- **Static sites:** health endpoint is N/A (responds 200 on `/`)

> **Do not short-circuit.** Iterate ALL sub-checks (1–7 + stack-specific) per component.

Severity tiers are defined in [readiness-gate.md](readiness-gate.md). Use the verdict tables in checks 1–7 above for deterministic outcomes. For judgment calls, assess based on deployment impact to this specific app.
