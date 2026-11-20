# Python

- [Detect the framework and app root](detect.md). Detection is advisory; don't rewrite the dependency manifest.
- Select a supported `PYTHON:<version>` Linux runtime consistent with the app and user constraints. Discover with `az webapp list-runtimes --os linux --runtime python -o json`; use the supported 3.14 default if compatible.
- [Set startup](startup-commands.md): Flask/Django normally use auto-detection; FastAPI needs its uvicorn command on `0.0.0.0`. Warn for unrecognized entry points.
- Before Django remote builds, require `STATIC_ROOT` and successful `python manage.py check` and `python manage.py collectstatic --noinput`.
- CLI: ZIP the source root, including the dependency manifest; exclude virtual environments, caches, local secrets and existing archives. Enable Oryx source build.
- azd: verify the selected service uses `language: python` and points to the app root. Retain the Python startup and source-build settings; don't hand-package the azd service.
