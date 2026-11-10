# Post-deploy message to the user

After `az webapp deploy` / `azd deploy` returns successfully, **the skill is done**. Do not run any further verification commands.

## Hard rules

- ⛔ Never run `az webapp log tail` as a "confirm startup" step — logs are often quiet for 1–2 min during build/warm-up; silence is not a failure signal.
- ⛔ Never run `curl`, `Invoke-WebRequest`, `wget`, or any HTTP request against the deployed URL — first request often 502s or times out on a healthy deploy.
- ⛔ Never present an early 5xx or quiet log stream as a deploy failure.
- ✅ Always give the user the URL, the wait expectation, and the log command, then **stop**.

## Message template — standard

Use when Step 2 found a start entry (`start` script or common entry file) or Step 5 set a startup command (NestJS, static SPA). Print exactly this (substituting real values), then end the turn:

```
✅ Deployment complete.

🌐 App URL: https://<app>.azurewebsites.net
   It can take 2–3 minutes for the site to be reachable while App Service finishes
   the npm build and warms up the container. Open it in your browser after a short wait.

📜 If you want to watch live logs:
   az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
   az webapp log tail -n <app> -g <rg>
   (The first command is a one-time prereq on a fresh app — without it the stream stays empty.)
```

If Step 2 recorded **port-hardcoded**, append:

```
⚠️  Your app listens on a fixed port. App Service routes traffic to process.env.PORT
   (8080). Update the listen call to: const port = process.env.PORT || 3000;
```

## Message template — no start entry

Use when Step 2 found no `start` script and no common entry file:

```
✅ Code deployed — but no start command was found.

🌐 App URL: https://<app>.azurewebsites.net
   Allow 2–3 minutes for the npm build and container startup.
   The site will likely return an error page until you set a startup command.

⚠️  No "start" script in package.json and no server.js/app.js/index.js/bin/www.
   Set one with:

   az webapp config set -n <app> -g <rg> --startup-file "node <entry>.js"

   See references/startup-commands.md for more guidance.

📜 If you want to watch live logs:
   az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
   az webapp log tail -n <app> -g <rg>
```

Replace `<entry>` with the most likely entry file if you can identify one from the source.

## Logging tips (mention only if the user asks for them)

> ⚠️ **Prereq for `az webapp log tail` on a fresh app**: filesystem container logging must be enabled or the live stream stays empty. Run once:
>
> ```bash
> az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
> ```
> ```powershell
> az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
> ```
>
> Deployment-build logs do **not** require this — read them with `az webapp log deployment list/show`.

| Log | Command |
|---|---|
| Deployment history | `az webapp log deployment list -n <app> -g <rg>` |
| Deployment details | `az webapp log deployment show -n <app> -g <rg> --deployment-id <id>` |
| Full log download | `az webapp log download -n <app> -g <rg>` |

## What "success" means here

Either is enough to print the success message — do **not** gate on log output or an HTTP probe:

- `az webapp deploy` returned without an error, **or**
- `azd deploy` printed `SUCCESS: Your application was deployed to Azure`
