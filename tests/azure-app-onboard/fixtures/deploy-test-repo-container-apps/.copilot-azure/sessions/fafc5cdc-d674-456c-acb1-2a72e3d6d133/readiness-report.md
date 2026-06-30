# Readiness Report — WeTTY v2.7.0

**Session:** `fafc5cdc-d674-456c-acb1-2a72e3d6d133`  
**Scanned:** 2026-05-20T21:46:00Z  
**Commit:** `0ec642a27302bb4c53244715e089e12a7fefe199`

---

## Summary

🔍 **Readiness: readyWithCaveats** — 0 critical, 0 fixes, 3 warnings

WeTTY is a TypeScript/Node.js web terminal emulator that proxies browser sessions over WebSocket to SSH or shell processes via `node-pty`. It is container-ready and deployable to Azure with two scaffold-time adjustments: a BuildKit-compatible Dockerfile and a health endpoint.

---

## Verdicts

| Axis | Verdict | Notes |
|------|---------|-------|
| Build | ✅ PASS | TypeScript + esbuild, pnpm lockfile, Node >=18 engines field |
| Completeness | ⚠️ WARN | No /health endpoint; all other checks pass |
| Deployability | ⚠️ WARN | BuildKit Dockerfile + native modules require container deployment |

**Overall health:** `readyWithCaveats`

---

## Detected Stack

- **Language:** TypeScript (ESM, esbuild compilation)
- **Runtime:** Node.js >=18, pnpm 9
- **Frameworks:** Express 4.x, Socket.IO 4.x
- **Native modules:** `node-pty` (PTY spawning), `gc-stats` (GC telemetry) — both require node-gyp
- **Package manager:** pnpm (lockfile: `pnpm-lock.yaml`)
- **Entry point:** `build/main.js` (built via `node build.js`)
- **Port:** 3000 (configurable via `PORT` env var)
- **Dockerfile:** `containers/wetty/Dockerfile` — multi-stage, BuildKit syntax

---

## Warnings

### ⚠️ W-HEALTH — No health endpoint (completeness)

**Detail:** WeTTY exposes `/metrics` via prom-client but has no dedicated liveness/readiness probe route. Azure health probes require a lightweight HTTP 200 endpoint.

**Fix:** Scaffold will configure `/wetty/` (the app base path) or add a `GET /health` route. Fixed at: `scaffold`.

---

### ⚠️ W-BUILDKIT — Dockerfile uses BuildKit `--mount=type=cache` (deployability)

**Detail:** `containers/wetty/Dockerfile` uses `RUN --mount=type=cache,id=pnpm,...` which is BuildKit-only syntax. Azure Container Registry (`az acr build`) does not support BuildKit and will fail with a parse error.

**Fix:** Scaffold will generate a `Dockerfile.azure` using plain `RUN pnpm install` without cache mounts. Fixed at: `scaffold`.

---

### ⚠️ W-NATIVE — Native modules require node-gyp (deployability)

**Detail:** `pnpm-lock.yaml` contains `node-gyp`. The Dockerfile explicitly rebuilds `node-pty` and `gc-stats` native bindings. Code-deploy (Oryx) cannot compile these on App Service — container deployment is required.

**Fix:** Deploy as a container image. Scaffold will target Azure Container Apps or App Service (container mode) with B1+ SKU. F1/Free tier is not viable. Fixed at: `scaffold`.

---

## Build Requirements

| Property | Value |
|----------|-------|
| `hasNativeModules` | `true` |
| `hasDockerfile` | `true` |
| `f1Viable` | `false` |
| `hasBuildKitSyntax` | `true` |
| `exposedPort` | `3000` |
| `f1BlockReason` | `native modules (node-gyp: node-pty, gc-stats)` |

---

## Post-Deploy Recommendations

1. **Add a dedicated SSH target container** *(medium effort)* — Deploy a companion SSH container or point `SSHHOST` env var to a managed target rather than the default `localhost` fallback.
2. **Enable TLS termination at the ingress** *(low effort)* — Use Azure Container Apps ingress or Application Gateway for TLS rather than in-process SSL certs.
