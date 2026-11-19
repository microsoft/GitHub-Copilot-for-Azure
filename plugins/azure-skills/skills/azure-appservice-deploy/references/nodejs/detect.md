# Framework Detection (Advisory)

Framework detection is **advisory only**. The deployment never blocks because of an unknown framework.

## What to check

1. **Confirm Node.js project** — `package.json` in the app root. If missing, stop and hand off to `azure-prepare`. For monorepos/workspaces (`workspaces`, `pnpm-workspace.yaml`, `turbo.json`, `nx.json`), identify the app and check its workspace/local dependencies before changing roots. Use a subfolder only if independently installable; otherwise hand off to `azure-prepare` to preserve root manifests, lockfiles and sibling packages.
2. **Scan `dependencies` / `devDependencies`** in `package.json`:

| Package (first match wins, top to bottom) | Detected framework |
|---|---|
| `next` | **nextjs** |
| `@nestjs/core` | **nestjs** |
| `express`, `fastify`, `koa`, `@hapi/hapi` | **node-server** (`express` / `fastify` / `koa` / `hapi`) |
| `vite`, `react-scripts`, `@angular/core`, `vue` (and none of the above) | **static-spa** |
| None of the above | **unknown** |

3. **Resolve the start entry** (Linux Node container order):
   - `scripts.start` in `package.json` → container runs `npm start`.
   - Else one of `bin/www`, `server.js`, `app.js`, `index.js` in the root → container runs it with `node`.
   - Else → **no start entry**.
4. **Check `PORT` usage** — search server source for `process.env.PORT`. If the app hard-codes a port without reading `process.env.PORT`, record **port-hardcoded** (the platform default is 8080).
5. **Check build** — if TypeScript (`tsconfig.json`) or Next.js/NestJS/SPA, `scripts.build` must exist; Oryx runs `npm run build` (and `npm run build:azure` if present).
6. **Record findings** for Step 5 (startup) and Step 8 (post-deploy message).

## Outcomes

| Detection | Step 5 behavior |
|---|---|
| `nextjs` | No startup command if `scripts.start` is `next start` (Next.js reads `PORT`). Require `scripts.build`. |
| `nestjs` | **Set** startup `node dist/main.js` (default Nest `start` uses the Nest CLI). Adjust path if `nest-cli.json` changes `outDir`/`entryFile`. |
| `node-server` with start entry | No startup command. |
| `static-spa` | **Set** `pm2 serve` startup for the build output folder. See [startup-commands.md](startup-commands.md). |
| `unknown` with start entry | Use the existing start entry; report that the framework was not recognized. |
| No start entry and no framework-specific startup | Skip startup auto-config. Warn that the user may need to set a startup command. |

## Important rules

- ⛔ **Do not** abort deployment when framework is unknown.
- ⛔ **Do not** add or upgrade dependencies, or edit user code, without asking.
- ✅ If **port-hardcoded**, warn before deploying and show the fix: `const port = process.env.PORT || 3000;`.
- ✅ Always report what was detected so the user has full context.
- ✅ When there is no start entry and no framework-specific startup, include a startup warning in [post-deploy-message.md](../post-deploy-message.md).

## Example output to surface to the user

```
Detected: Express (Node.js 26)
Start entry: package.json "start" → node ./bin/www
PORT: reads process.env.PORT ✅
No startup command needed.
```

or

```
Detected: NestJS (Node.js 26)
Build: npm run build → dist/
Setting startup command: node dist/main.js
```

or

```
Detected: Node.js project, no start script or entry file found.
The app will deploy, but App Service may not start it until you set a
startup command. See startup-commands.md for examples.
```
