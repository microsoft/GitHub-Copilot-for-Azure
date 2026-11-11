# Post-deploy message to the user

After `az webapp deploy` / `azd deploy` returns successfully, **the skill is done**. Resolve the host without probing it, print the message below, then end the turn.

## Hard rules

- ⛔ Never run `az webapp log tail` as a "confirm startup" step — logs are often quiet for 1–2 min during warm-up; silence is not a failure signal.
- ⛔ Never run `curl`, `Invoke-WebRequest`, `wget`, or any HTTP request against the deployed URL — first request often 502s or times out on a healthy deploy.
- ⛔ Never present an early 5xx or quiet log stream as a deploy failure — the platform may still be warming up.
- ✅ Always give the user the URL, the wait expectation, and the log command, then **stop**.

## Message template — standard

Use this when Step 2 detected a deployable web artifact. Print this (substituting the real values) as the final output of the skill, then end the turn:

```
✅ Deployment accepted.

🌐 App URL: https://<actual-defaultHostName>
   It can take 2–3 minutes for the site to be reachable while App Service starts
   the JVM and server. Open it in your browser after a short wait.

📜 If you want to watch live logs:
   az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
   az webapp log tail -n <app> -g <rg>
   (The first command is a one-time prereq on a fresh app — without it the stream stays empty.)
```

Name the deployed artifact and runtime (e.g., `hello-app-1.0.0.jar` on `JAVA:21-java21`). For azd, say it built locally and deployed the output. Use the actual endpoint from azd or `defaultHostName`, not a guessed host name.

If no deployable web artifact was produced, state that explicitly instead of claiming the app is running. A failed command must be reported as a failure with a suggested fix, never this success template.

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

For a later redeployment, rebuild and deploy a fresh artifact via [deploy-azcli.md](deploy-azcli.md) or use [deploy-azd.md](deploy-azd.md).

## What "success" means here

Either of these is enough to print the acceptance message — do **not** gate on log output or an HTTP probe:

- `az webapp deploy` returned without an error, **or**
- `azd deploy` printed `SUCCESS: Your application was deployed to Azure`

Upload acceptance alone does not confirm application health.
