# Readiness Report — bya-simple-web-app

**Scan date:** 2026-05-20  
**Commit:** `9a3d2e85ed02f300fdde58c882177fc1c46ba647`  
**Overall health:** 🔴 blocked

## Stack

| Property | Value |
|----------|-------|
| Language | Node.js (CommonJS) |
| Framework | Express 5.x |
| Entry point | `index.js` |
| Package manager | npm |
| Database | SQLite via `better-sqlite3` v12.8.0 (prebuilt binaries) |
| Auth | Session-based (`express-session` + `bcryptjs`) |
| Static frontend | `public/` (HTML/CSS/JS) |

## Verdict Summary

| Axis | Verdict | Notes |
|------|---------|-------|
| Build | ✅ PASS | All imports satisfied, no native modules |
| Completeness | ❌ FAIL | Missing trust proxy (escalated from WARN — fixPhase: prereq) |
| Deployability | ⚠️ WARN | SQLite and MemoryStore are ephemeral on PaaS |

## Findings

### ❌ Must Fix Before Deploy

| ID | Summary | Fix |
|----|---------|-----|
| W-TRUST-PROXY | Missing `app.set('trust proxy', 1)` | Add one line to `src/app.js` — without it, `express-rate-limit` rate-limits ALL users by the proxy IP (not client IP), and `express-session` secure cookies may not function correctly behind Azure's SSL-terminating proxy |

### ⚠️ Informational (non-blocking)

| ID | Summary | When to Fix |
|----|---------|------------|
| W-SESSION-SECRET | Hardcoded SESSION_SECRET fallback | Scaffold — will be provisioned as App Service app setting |
| W-NO-ENGINES | No `engines` field in package.json | Scaffold — WEBSITE_NODE_DEFAULT_VERSION will be set |
| W-HEALTH | No health endpoint | Scaffold — will configure probe to root path |
| W-SQLITE-EPHEMERAL | SQLite is ephemeral on App Service | Post-deploy — migrate to managed DB |
| W-SESSION-MEMORY | MemoryStore sessions lost on restart | Post-deploy — add Azure Cache for Redis |
| W-NO-README | No README | Post-deploy |

## Post-Deploy Recommendations

1. **Replace SQLite with a managed database** (medium effort) — Azure Database for PostgreSQL or Azure SQL
2. **Replace MemoryStore with Redis session store** (low effort) — Azure Cache for Redis + connect-redis
3. **Add README** (low effort)
