# Startup Commands by Framework

The Linux Node.js container starts the app automatically when `package.json` has a `start` script (`npm start`) or the root contains `bin/www`, `server.js`, `app.js`, or `index.js`. Set a startup command only for the cases below. Whatever runs must listen on `process.env.PORT` (default 8080).

For an existing app, read `appCommandLine` before relying on automatic startup (`az webapp config show -n <app> -g <rg> --query appCommandLine -o tsv`). Stop on read errors. Preserve an intentional custom command; ask before replacing or clearing an override that no longer matches the selected app. Automatic detection requires an empty override.

## Express / Fastify / Koa / hapi — no startup command needed

Use the existing `start` script or entry file. Bind to all interfaces — `app.listen(process.env.PORT || 3000)` is correct; Fastify needs `{ port: process.env.PORT || 3000, host: '0.0.0.0' }` because it defaults to `127.0.0.1`.

## Next.js — no startup command needed

Requires `"build": "next build"` and `"start": "next start"`. Oryx runs the build; `next start` reads `PORT`. For `output: 'standalone'`, set startup `node .next/standalone/server.js` and ensure `public/` and `.next/static/` are copied into the standalone folder by the build script.

## NestJS — always set startup

```bash
az webapp config set -n <app> -g <rg> --startup-file "node dist/main.js"
```
```powershell
az webapp config set -n <app> -g <rg> --startup-file "node dist/main.js"
```

`main.ts` must call `app.listen(process.env.PORT ?? 3000)`. Adjust the path if `nest-cli.json` changes the output.

## Static SPA (React/Vite/Angular/Vue) — always set startup

Serve the build output with PM2 if it is available in the selected runtime. Confirm the actual output folder from the project's build configuration rather than assuming it: common examples are Vite/Vue `dist`, Create React App `build`, and Angular `dist/<project>/browser`. If PM2 availability cannot be established, explain the uncertainty and ask before adding a server dependency or changing the deployment approach.

```bash
az webapp config set -n <app> -g <rg> \
  --startup-file "pm2 serve /home/site/wwwroot/dist --no-daemon --spa"
```
```powershell
az webapp config set -n <app> -g <rg> `
  --startup-file "pm2 serve /home/site/wwwroot/dist --no-daemon --spa"
```

> 💡 **Tip:** Mention that Azure Static Web Apps is usually a better fit for a pure SPA — but continue with App Service since the user asked for it.

## Not auto-configured — warn & deploy anyway

When there is no `start` script and no common entry file, deploy without a startup command and surface:

> ⚠️ No `start` script or entry file was found. The app has been deployed, but App Service may not start it until you set a startup command:

```bash
az webapp config set -n <app> -g <rg> --startup-file "node <entry>.js"
# or with PM2 (keep --no-daemon):
az webapp config set -n <app> -g <rg> --startup-file "pm2 start <entry>.js --no-daemon"
```
```powershell
az webapp config set -n <app> -g <rg> --startup-file "node <entry>.js"
az webapp config set -n <app> -g <rg> --startup-file "pm2 start <entry>.js --no-daemon"
```

## Diagnosing a wrong startup command

```bash
az webapp config show -n <app> -g <rg> --query linuxFxVersion -o tsv
az webapp config show -n <app> -g <rg> --query appCommandLine -o tsv
```

Look for:
- `didn't respond to HTTP pings on port: 8080` → app not listening on `process.env.PORT`, or bound to `127.0.0.1`
- `Cannot find module '/home/site/wwwroot/dist/main.js'` → build did not run or output path differs
- `npm ERR! Missing script: "start"` → add a `start` script or set a startup command
