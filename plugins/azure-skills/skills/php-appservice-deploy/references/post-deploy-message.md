# Post-deploy message to the user

After `az webapp deploy` / `azd deploy` returns successfully, **the skill is done**. Do not run any further verification commands.

## Hard rules

- ⛔ Never run `az webapp log tail` as a "confirm startup" step — logs are often quiet for 1–2 min during build/warm-up; silence is not a failure signal.
- ⛔ Never run `curl`, `Invoke-WebRequest`, `wget`, or any HTTP request against the deployed URL — first request often 502s or times out on a healthy deploy.
- ⛔ Never present an early 5xx or quiet log stream as a deploy failure.
- ✅ Always give the user the URL, the wait expectation, and the log command, then **stop**.

## Message template — standard

Use the HTTPS endpoint already resolved by the deployment path, including any regional/hash suffix; never reconstruct it from the app name.

Use when Step 2 found an entry point (`index.php` or `public/index.php`). Print exactly this (substituting real values), then end the turn:

```
✅ Deployment complete.

🌐 App URL: <resolved-https-endpoint>
   It can take 2–3 minutes for the site to be reachable while App Service finishes
   composer install and warms up the container. Open it in your browser after a short wait.

📜 If you want to watch live logs:
   az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
   az webapp log tail -n <app> -g <rg>
   (The first command is a one-time prereq on a fresh app — without it the stream stays empty.)
```

If Step 5 added `azure-startup.sh` / `azure-nginx.conf`, append:

```
📁 Added to your project: azure-startup.sh and azure-nginx.conf
   (serve public/ via NGINX and create Laravel writable folders at startup).
   Keep them for future deployments.
```

If Step 6 set `APP_KEY`, append (never print the key):

```
🔑 APP_KEY was set as an App Service app setting. Add other .env values
   (database, mail, etc.) with: az webapp config appsettings set -n <app> -g <rg> --settings KEY=value
```

## Message template — no entry

Use when Step 2 found no `index.php` or `public/index.php`:

```
✅ Code deployed — but no PHP entry point was found.

🌐 App URL: <resolved-https-endpoint>
   It can take 2–3 minutes for App Service to finish building and start the container.
   The site may show the default page or a 404 until the document root is configured.

⚠️  No index.php in the app root or public/. Configure the NGINX root with a startup
   script — see references/startup-commands.md.

📜 If you want to watch live logs:
   az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
   az webapp log tail -n <app> -g <rg>
```

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
