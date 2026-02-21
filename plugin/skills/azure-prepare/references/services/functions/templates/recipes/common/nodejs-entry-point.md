# Node.js Entry Point (REQUIRED)

Azure Functions Node.js v4 programming model requires an entry point file that initializes the runtime.

> ⛔ **CRITICAL**: Without this file, functions will deploy but return 404 on all endpoints.

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

The Azure Functions Node.js v4 runtime automatically discovers functions in the `src/functions/` directory. The `main` field points to the entry point.

### JavaScript
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

> **Note**: Functions in `src/functions/*.js` are auto-discovered by the runtime when they call `app.http()`, `app.timer()`, etc. The `main` field only needs to point to the entry point that calls `app.setup()`.

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
| Missing `npm run build` for TypeScript | 404 or old code runs | Run build before deploy |
| Wrong `main` field in package.json | Functions not discovered | Use correct glob pattern |
