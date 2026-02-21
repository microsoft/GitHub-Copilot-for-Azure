# Node.js Entry Point (REQUIRED)

Azure Functions Node.js v4 programming model requires an entry point file that initializes the runtime.

> ⛔ **CRITICAL**: Without this file, functions will deploy but return 404 on all endpoints.

## Project Structure (CRITICAL)

The project structure MUST be:

```
project-root/                # ← azure.yaml project: "."
├── azure.yaml
├── package.json             # ← MUST be at ROOT, not in src/
├── host.json
├── src/
│   ├── index.js             # ← Entry point (app.setup)
│   └── functions/
│       ├── myFunction.js    # ← Functions auto-discovered
│       └── ...
└── infra/
```

> ⛔ **CRITICAL**: `package.json` MUST be at project root, NOT inside `src/`.
> The `azure.yaml` must have `project: .` (not `project: ./src/`).

## JavaScript: src/index.js

**This file MUST exist and MUST NOT be removed when replacing trigger files.**

```javascript
const { app } = require('@azure/functions');

app.setup({
    enableHttpStream: true,
});
```

## TypeScript: src/index.ts

**This file MUST exist and MUST NOT be removed when replacing trigger files.**

```typescript
import { app } from '@azure/functions';

app.setup({
    enableHttpStream: true,
});
```

## package.json Configuration

The `package.json` MUST be at the project root (same level as `azure.yaml`).

### JavaScript (using glob pattern)
```json
{
  "main": "src/{index.js,functions/*.js}",
  "scripts": {
    "start": "func start"
  }
}
```

### JavaScript (simple entry point)
```json
{
  "main": "src/index.js",
  "scripts": {
    "start": "func start"
  }
}
```

### TypeScript
```json
{
  "main": "dist/src/index.js",
  "scripts": {
    "build": "tsc",
    "prestart": "npm run build",
    "start": "func start"
  }
}
```

> **How Auto-Discovery Works**: Functions in `src/functions/*.js` are auto-discovered when they call `app.http()`, `app.timer()`, etc. Both glob pattern and simple entry point work because:
> - The glob `src/{index.js,functions/*.js}` explicitly includes all function files
> - The simple `src/index.js` works because Node.js require() loads the functions when they register with `app.*`

## azure.yaml Configuration

```yaml
services:
  api:
    project: .           # ← ROOT directory, not ./src/
    language: js         # or ts for TypeScript
    host: function
```

> ⛔ **CRITICAL**: Use `project: .` — NOT `project: ./src/`. The runtime expects `package.json` at the project root.

## Build Requirements (TypeScript only)

Before deployment, TypeScript must be compiled:

```bash
npm run build
```

This outputs JavaScript to `dist/` which is what Azure Functions actually runs.

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `src/index.js` | 404 on all endpoints | Add the entry point file |
| Deleting `src/index.js` when replacing triggers | 404 after recipe applied | Keep index.js, only replace function files |
| `package.json` in `src/` instead of root | 404, functions not found | Move `package.json` to project root |
| `project: ./src/` in azure.yaml | Deployment fails or 404 | Use `project: .` |
| Missing `npm run build` for TypeScript | 404 or old code runs | Run build before deploy |
| Wrong `main` field in package.json | Functions not discovered | Use `src/index.js` or glob pattern |

## Terraform vs Bicep: Source Code is IDENTICAL

The Node.js source code and `package.json` are **exactly the same** for both IaC types.

Only the `infra/` folder differs:
- Bicep: `infra/*.bicep`
- Terraform: `infra/*.tf`

> ⚠️ If you find yourself changing imports or source code because of IaC choice, something is wrong. The application code should be IaC-agnostic.
