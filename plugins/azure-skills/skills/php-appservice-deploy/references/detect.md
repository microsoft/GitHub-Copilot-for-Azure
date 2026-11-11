# Framework Detection (Advisory)

Framework detection is **advisory only**. The deployment never blocks because of an unknown framework.

## What to check

1. **Confirm PHP project** — `composer.json` or `index.php` in the app root. If neither exists, stop and hand off to `azure-prepare`. If the app is in a subfolder of a larger repo, ask which folder to deploy and run the workflow from there.
2. **Scan `require`** in `composer.json` and root files:

| Signal (first match wins, top to bottom) | Detected framework |
|---|---|
| `laravel/framework` or `artisan` file | **laravel** |
| `symfony/framework-bundle` | **symfony** |
| `slim/slim` | **slim** |
| `codeigniter4/framework` | **codeigniter** |
| `wp-config.php` or `wp-content/` | **wordpress** → hand off to `azure-prepare` (WordPress on App Service has a dedicated offering) |
| None of the above | **plain-php** |

3. **Resolve the document root** — the folder that contains the front controller:
   - `public/index.php` exists (Laravel, Symfony, Slim, CodeIgniter 4) → **public-root**.
   - Else `index.php` in the app root → **app-root** (NGINX default `/home/site/wwwroot`).
   - Else → **no entry**.
4. **Laravel writable dirs** — check `storage/framework/{sessions,views,cache}`, `storage/logs`, and `bootstrap/cache` exist with placeholder files (usually `.gitignore`). Record any missing folder; the startup script creates them at runtime.
5. **Laravel config** — record whether `.env` exists locally. `.env` is never deployed; `APP_KEY` and other required values must be app settings.
6. **Front-end assets** — if `package.json` has a `build` script (e.g. Vite), Oryx's PHP build does **not** run npm. Record **assets-local-build**: run `npm run build` locally and keep `public/build/` in the ZIP.
7. **Record findings** for Step 5 (startup), Step 6 (app settings), and Step 8 (post-deploy message).

## Outcomes

| Detection | Step 5 behavior |
|---|---|
| `plain-php` with app-root | No startup command. |
| `laravel` | **Set** startup script: writable dirs + NGINX `root` → `public/`. See [startup-commands.md](startup-commands.md). |
| `symfony`, `slim`, `codeigniter` (public-root) | **Set** startup script: NGINX `root` → `public/`. |
| `wordpress` | Stop and hand off to `azure-prepare`. |
| `unknown`, or no entry | Skip startup auto-config. Emit warning: *"Could not find `index.php` or `public/index.php`. The app will deploy, but you may need to configure the NGINX document root or startup command manually."* |

## Important rules

- ⛔ **Do not** abort deployment when framework is unknown.
- ⛔ **Do not** add or upgrade dependencies, or edit existing user code, without asking. Adding the startup script and NGINX config files is allowed after telling the user; ask first if files with those names already exist.
- ✅ Always report what was detected so the user has full context.
- ✅ When there is no entry, **remember this for Step 8** — use the **no-entry template** in [post-deploy-message.md](post-deploy-message.md).

## Example output to surface to the user

```
Detected: Laravel (PHP 8.5)
Document root: public/ → NGINX root override via startup script
Writable dirs: storage/, bootstrap/cache/ present ✅
APP_KEY: not set in App Service → will set as app setting
```

or

```
Detected: plain PHP (PHP 8.5)
Document root: app root (index.php)
No startup command needed.
```
