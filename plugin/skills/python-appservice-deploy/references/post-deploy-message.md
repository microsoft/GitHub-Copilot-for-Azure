# Post-deploy message to the user

After `az webapp deploy` / `azd deploy` returns successfully, **the skill is done**. Do not run any further verification commands.

## Hard rules

| Rule | Why |
|---|---|
| ⛔ Never run `az webapp log tail` as a "confirm startup" step | Logs are often quiet for 1–2 minutes during container build/warm-up — silence is **not** a failure signal |
| ⛔ Never run `curl`, `Invoke-WebRequest`, `wget`, or any HTTP request against the deployed URL | First request often 502s or times out even on a healthy deploy while the platform warms the container |
| ⛔ Never present a quiet log stream, a 5xx, or a connection refused in the first few minutes as a deploy failure | The deploy already succeeded — the platform just isn't warm yet |
| ✅ Always give the user the URL, the wait expectation, and the log command, then **stop** | Lets the user verify on their own terms; the skill turn ends here |

## Message template — standard (Flask / Django / FastAPI)

Use this when Step 2 detected a known framework (`flask`, `django`, or `fastapi`). Print exactly this (substituting the real values) as the final output of the skill, then end the turn:

```
✅ Deployment complete.

🌐 App URL: https://<app>.azurewebsites.net
   It can take 2–3 minutes for the site to be reachable while App Service finishes
   warming up the container. Open it in your browser after a short wait.

📜 If you want to watch live logs:
   az webapp log tail -n <app> -g <rg>

🛠️  Other log options if anything looks off:
   az webapp log deployment list -n <app> -g <rg>     # deployment history
   az webapp log download         -n <app> -g <rg>    # full log bundle
```

## Message template — unknown framework

Use this when Step 2 detected `wsgi-generic`, `asgi-generic`, or `unknown` (i.e. **not** Flask, Django, or FastAPI). The code is already deployed and `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is set, but Oryx will not know how to start the app until the user sets a startup command. Print this instead:

```
✅ Code deployed — but framework not detected.

🌐 App URL: https://<app>.azurewebsites.net
   It can take 2–3 minutes for App Service to finish building and start the
   container. The site will likely return an error page until you set a
   startup command (next step).

⚠️  We could not detect Flask, Django, or FastAPI in your project, so no
   startup command was set automatically. App Service won't know how to run
   your app until you tell it. Set a startup command with:

   az webapp config set -n <app> -g <rg> \
     --startup-file "<your-startup-command>"

   Examples:
     • Generic WSGI (gunicorn):
         gunicorn --bind=0.0.0.0 --timeout 600 <module>:<callable>
     • Generic ASGI (uvicorn):
         python -m uvicorn <module>:<callable> --host 0.0.0.0 --port 8000

   See references/startup-commands.md for more guidance.

📜 If you want to watch live logs:
   az webapp log tail -n <app> -g <rg>

🛠️  Other log options if anything looks off:
   az webapp log deployment list -n <app> -g <rg>     # deployment history
   az webapp log download         -n <app> -g <rg>    # full log bundle
```

Replace `<module>:<callable>` with the user's actual entry point (e.g. `app:app`, `main:application`, `myapp.wsgi:application`). If you can identify a likely entry point from the source code, **suggest a concrete command** instead of leaving placeholders.

## Picking which template to use

| Detected framework (Step 2) | Template |
|---|---|
| `flask`, `django`, `fastapi` (any Python version) | **standard** |
| `wsgi-generic`, `asgi-generic`, `unknown` | **unknown framework** |

## What "success" means here

The deploy step succeeded if **either** of these is true:

- `az webapp deploy` returned without an error, **or**
- `azd deploy` printed `SUCCESS: Your application was deployed to Azure`

That is enough to print the success message above. Do **not** gate it on log output or an HTTP probe. The user will run `az webapp log tail` themselves if they want to investigate.
