# Node.js

- [Detect the project, workspace, framework, and start entry](detect.md). Preserve workspace root manifests, lockfile, and dependent packages; ensure the selected app consumes `process.env.PORT`.
- Discover Linux runtimes with `az webapp list-runtimes --os linux --runtime node -o json`. Select `NODE:<version>` compatible with `engines.node` and the user's request.
- [Follow the startup guidance](startup-commands.md) for the detected app type.
- CLI: ZIP the selected source or workspace root; keep lockfiles, exclude `node_modules`, local secrets, and old archives. Enable Oryx source build for dependency install and the package's build scripts. Preserve the workspace build and start commands rather than using a standalone package layout.
- azd: verify `language: js` or `ts`, project path, and build/start entry for the selected service. Use azd packaging.
