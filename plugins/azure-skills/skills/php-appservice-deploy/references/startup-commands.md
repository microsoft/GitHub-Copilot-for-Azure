# Startup Commands by Framework

The Linux PHP container runs NGINX + PHP-FPM and serves `/home/site/wwwroot` on port 8080. Set a startup command only when the document root is `public/` or Laravel needs writable folders. Startup scripts must use LF line endings ([deploy-azcli.md](deploy-azcli.md#normalize-linux-scripts)).

## Plain PHP (`index.php` in app root) — no startup command needed

## `public/` document root (Laravel, Symfony, Slim, CodeIgniter 4)

Edits to `/etc/nginx/sites-available/default` are lost on restart, so copy a custom config at startup. Tell the user you are adding two files to the app root (ask first if either name exists).

**`azure-nginx.conf`** (based on the [Azure Laravel sample](https://github.com/Azure-Samples/laravel-tasks/blob/main/default)):

```nginx
server {
    listen 8080;
    listen [::]:8080;
    root /home/site/wwwroot/public;
    index index.php index.html index.htm;
    server_name example.com www.example.com;
    port_in_redirect off;

    location / {
        index index.php index.html index.htm hostingstart.html;
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ /\.git { deny all; access_log off; log_not_found off; }

    location ~ [^/]\.php(/|$) {
        fastcgi_split_path_info ^(.+?\.php)(|/.*)$;
        fastcgi_pass 127.0.0.1:9000;
        include fastcgi_params;
        fastcgi_param HTTP_PROXY "";
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_param QUERY_STRING $query_string;
        fastcgi_intercept_errors on;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 3600;
        fastcgi_read_timeout 3600;
        fastcgi_buffer_size 128k;
        fastcgi_buffers 4 256k;
        fastcgi_busy_buffers_size 256k;
        fastcgi_temp_file_write_size 256k;
    }
}
```

**`azure-startup.sh`** — keep the `mkdir`/`chmod` lines for Laravel only:

```bash
#!/bin/bash
set -e
cd /home/site/wwwroot
# Laravel: writable runtime folders (ZIP deploys may drop empty folders)
mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs bootstrap/cache
chmod -R 775 storage bootstrap/cache
# public/ document root
cp /home/site/wwwroot/azure-nginx.conf /etc/nginx/sites-available/default
service nginx reload
```

Set it (invoking via `bash` avoids relying on the executable bit):

```bash
az webapp config set -n <app> -g <rg> --startup-file "bash /home/site/wwwroot/azure-startup.sh"
```
```powershell
az webapp config set -n <app> -g <rg> --startup-file "bash /home/site/wwwroot/azure-startup.sh"
```

## Laravel app settings

`.env` is not deployed. If `APP_KEY` is not already an app setting, generate one (`php artisan key:generate --show` locally, or 32 random bytes base64-encoded with a `base64:` prefix) and set it with other required values. Never print the key back to the user.

Some Laravel projects default sessions and cache to the `database` driver on SQLite, which fails without a provisioned database. Unless the user has configured a database or explicit drivers, set `SESSION_DRIVER=file` and the file cache driver (these use the writable `storage/framework/` folders). Inspect `config/cache.php`: older Laravel projects may use `CACHE_DRIVER` instead of `CACHE_STORE`; set the key the project actually reads.

```bash
az webapp config appsettings set -n <app> -g <rg> \
  --settings APP_KEY="<generated-key>" APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr SESSION_DRIVER=file CACHE_STORE=file
```
```powershell
az webapp config appsettings set -n <app> -g <rg> `
  --settings APP_KEY="<generated-key>" APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr SESSION_DRIVER=file CACHE_STORE=file
```

These examples assume `CACHE_STORE`; substitute `CACHE_DRIVER` if the project uses that key. Omit settings already explicitly configured by the user.

## Not auto-configured — warn & deploy anyway

When there is no `index.php` or `public/index.php`, deploy without a startup command and surface:

> ⚠️ No PHP entry point was found. The app has been deployed, but you may need to set the document root with a startup script (see above).

## Diagnosing a wrong startup command

```bash
az webapp config show -n <app> -g <rg> --query linuxFxVersion -o tsv
az webapp config show -n <app> -g <rg> --query appCommandLine -o tsv
```

Look for:
- `/bin/bash^M: bad interpreter` or `$'\r': command not found` → CRLF in `azure-startup.sh`; normalize to LF and redeploy
- 404 on all routes except `/` → NGINX `root`/`try_files` not applied
- `Please provide a valid cache path` → `storage/framework/*` missing or not writable
