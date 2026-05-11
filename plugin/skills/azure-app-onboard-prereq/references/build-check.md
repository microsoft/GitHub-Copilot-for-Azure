# Build Check

> ⛔ **No build/install/test commands — `npm install`, `npm test`, `dotnet build`, `dotnet restore`, `dotnet test`, `pip install`, `pytest`, `go mod download`, `cargo build`. Use static analysis only during this check.**

Detect the project's language/framework stack and assess build health. Static detection (manifest reading) is the **default mode**. Build execution is an optional escalation requiring user confirmation.

> **Dynamic detection:** The agent determines build commands by reading the actual project manifest (e.g., inspecting `package.json` `scripts` to find the real build script name). The table below is reference guidance, not a fixed lookup.

## Step 1: Detect Stack

Scan the workspace for project files to determine the technology stack. ⛔ **Do NOT run any command from this table — it is for identification only.**

| File | Language/Framework | Build System (⛔ DO NOT RUN) |
|------|--------------------|-------------------------------|
| `package.json` | Node.js | npm/yarn/pnpm (detect pm from lockfile) |
| `package.json` + `tsconfig.json` | TypeScript | npm/yarn/pnpm + tsc |
| `requirements.txt` | Python | pip |
| `pyproject.toml` | Python (modern) | pip / uv / poetry |
| `*.csproj` / `*.sln` | .NET | dotnet CLI |
| `pom.xml` | Java (Maven) | mvn |
| `build.gradle` / `build.gradle.kts` | Java/Kotlin (Gradle) | gradle |
| `go.mod` | Go | go CLI |
| `Cargo.toml` | Rust | cargo |
| `Gemfile` | Ruby | bundler |
| `composer.json` | PHP | composer |
| `docker-compose.yml` / `compose.yml` | (dependency source) | Not a build system — parse `services:` for infrastructure dependencies (see [deployability-check.md § Compose](deployability-check.md)) |
| `build.gradle` + `com.google.cloud.tools.jib` | Java (Jib) | gradle + jib plugin |

**Modern package manager lockfiles:** `uv.lock` → uv (`uv sync`), `bun.lock` / `bun.lockb` → bun (`bun install`). Detect alongside standard lockfiles.

> ⚠️ If **no project file** is found, check for a `Dockerfile`. If a Dockerfile exists, note container-dependent build in findings.

### Multi-Project Detection

Search recursively for project manifests, skip `node_modules`/`.git`/`dist`/`build`/`vendor`/`.venv`/`__pycache__`/`.terraform`/`bin`/`obj`. Each directory with a project file = one component. Evaluate each independently.

## Step 2: Static Detection (Default)

Read project manifests to infer build health **without executing any commands**. This is the default mode for all evaluations.

**What to check:**
- **Missing dependencies** — referenced imports not in manifest
- **Version conflicts** — engine/runtime version mismatches visible in manifest (e.g., `"engines": {"node": ">=20"}` but lockfile pins Node 16 packages)
- **Obvious misconfigurations** — missing `main`/`start` script when expected, empty dependency blocks, circular references
- **Lock file presence** — `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Pipfile.lock` — missing lock file = ⚠️ WARN

> **Package manager detection:** `package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm. Default to npm if no lockfile.

### Import → Manifest Cross-Check

Scan source files to detect packages imported in code but missing from the dependency manifest. This catches pre-existing repo bugs that cause build failures on Azure (e.g., `Cannot find module` during `az acr build`).

**Node.js / TypeScript:**
1. Scan source files (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`) in the component directory for `import ... from '{package}'` and `require('{package}')` statements
2. Extract the package name (first path segment: `@scope/name` for scoped, `name` for unscoped — ignore relative paths `./`, `../`, `#`)
3. Check each extracted package against `dependencies` + `devDependencies` in `package.json`
4. Skip Node.js built-ins (`fs`, `path`, `crypto`, `http`, `https`, `url`, `os`, `util`, `stream`, `events`, `child_process`, `buffer`, `assert`, `net`, `tls`, `dns`, `cluster`, `zlib`, `readline`, `querystring`, `string_decoder`, `timers`, `worker_threads`, `perf_hooks`, `async_hooks`, `v8`, `vm`, `inspector`, `module`, `process`, `console`, `node:*`)
5. Remaining unresolved packages:

| File location | Severity | Why |
|---|---|---|
| Build-time config (`next.config.*`, `webpack.config.*`, `vite.config.*`, `babel.config.*`, `postcss.config.*`, `tailwind.config.*`) | ❌ FAIL | Build will crash — `Cannot find module` at config load time. Offer to add to `package.json`. |
| Entry point or source code (`src/**`, `app/**`, `pages/**`, `lib/**`) | 🔧 Highly Recommended Fix | App may crash at runtime. Offer to add to `package.json`. |
| Test files only (`test/**`, `tests/**`, `__tests__/**`, `*.test.*`, `*.spec.*`) | ⚠️ WARN | Doesn't affect deployment |

**Python:**
Scan `*.py` for `import {pkg}` / `from {pkg} import`, cross-reference against `requirements.txt` / `pyproject.toml [project.dependencies]`. Skip stdlib modules. Same severity tiers apply.

**Scope:** Always scan ALL config files (`next.config.*`, `webpack.config.*`, `vite.config.*`, `babel.config.*`, `postcss.config.*`, `tailwind.config.*`) — these are a fixed small set (~1-3 per component) and produce ❌ FAIL when a missing import is found. For `src/`/`app/`/`pages/`/`lib/`, limit to 20 source files per component. Do NOT scan `node_modules/`, `.venv/`, `dist/`, `build/`.

**When a ❌ FAIL or 🔧 Fix is found:** Include in the batch-then-approve fix plan: "Add `{package}` to `package.json` dependencies." This is a 1-line manifest change — low risk.

| Outcome | Verdict | Notes |
|---------|---------|-------|
| No issues found in manifest | ✅ PASS | Inferred: build likely succeeds |
| Warnings visible in manifest | ⚠️ WARN | Record specifics |
| Obvious errors in manifest | ❌ FAIL | Record specifics |
| No build system detected | ⚠️ WARN | Likely static site or script-only repo |
| Only Dockerfile found | ⚠️ WARN | Build depends on container — note this |

**Dependency vintage check:** If ALL pinned dependencies are 5+ years old AND the ecosystem has known breaking changes (e.g., Werkzeug 0.x→1.x removed `werkzeug.contrib`, MarkupSafe <1.0 has no Python 3.10+ wheels, `itsdangerous<1.0` API completely changed), classify as ❌ FAIL — `pip install` / `npm install` WILL fail on Azure's current runtimes. Check: grep for imports from removed modules (e.g., `werkzeug.contrib.*`, `flask.ext.*`). If found → ❌ FAIL with "imports from removed module — dependency chain incompatible with modern runtime."

**F1 viability signal:** While evaluating dependencies, also check `f1Viable` per the heuristics in [dependency-compatibility.md § F1 Viability](dependency-compatibility.md). A dependency vintage ❌ FAIL that requires 🔶 Major Migration (>5 files) should set `f1Viable: false` — the migration + Oryx rebuild will exhaust F1's CPU budget.

## Step 3: Build Execution (Optional — User-Confirmed)

⛔ **Only run when user explicitly asks** (e.g., "Does my code compile?", "Can you build this?") **and confirms via `ask_user`.**

### Build Execution Rules

1. **Read the manifest dynamically** — determine the actual build script name from the project file (don't assume `npm run build` — read `scripts` field)
2. **Install dependencies first** — Always run the install step before build
3. **Capture full output** — Save stdout and stderr for the report
4. **Timeout** — 5 minutes per component. If exceeded, record as ⚠️ WARN (not FAIL)
5. **Do NOT modify code** — If the build fails, record the failure; do not attempt fixes

### Build Verdict Logic

| Outcome | Verdict | Notes |
|---------|---------|-------|
| Build succeeds (exit code 0) | ✅ PASS | Code compiles cleanly |
| Build succeeds with warnings | ⚠️ WARN | Record warnings in report |
| Build fails (exit code ≠ 0) | ❌ FAIL | Record error output |
| Build times out (>5 min) | ⚠️ WARN | May still be valid — suggest CI/CD |

## Native Module Detection

See [deployability-check.md § Native Module Detection](deployability-check.md) for the canonical detection procedure, edge cases, and package table. Results go to `buildRequirements.hasNativeModules`.
