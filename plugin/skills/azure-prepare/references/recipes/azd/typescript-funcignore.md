# TypeScript .funcignore Configuration

When deploying TypeScript Azure Functions, configure `.funcignore` based on your build approach.

## Remote Build (Recommended)

**Remote build** uploads TypeScript source code and lets Azure's Oryx build system compile it remotely.

**Correct `.funcignore` for remote build:**
```gitignore
*.js.map
.git*
.vscode
__azurite_db*__.json
__blobstorage__
__queuestorage__
local.settings.json
test
node_modules/
```

**Critical rules:**
- ✅ **MUST exclude** `node_modules/` - prevents uploading local binaries with incorrect permissions
- ✅ **MUST NOT exclude** `*.ts` files - Oryx needs source code
- ✅ **MUST NOT exclude** `tsconfig.json` - Oryx needs compilation config

**Common errors:**
```
Error: sh: 1: tsc: Permission denied
```
**Root cause:** Local `node_modules/` uploaded with wrong permissions, or TypeScript source excluded.

**Reference:** [TypeScript .funcignore fix PR](https://github.com/Azure-Samples/remote-mcp-functions-typescript/pull/35)

## Local Build (Alternative)

**Local build** compiles TypeScript locally and uploads only JavaScript files.

**`.funcignore` for local build:**
```gitignore
*.ts
tsconfig.json
.git*
.vscode
local.settings.json
test
```

**azure.yaml configuration:**
```yaml
services:
  functions:
    project: ./src/functions
    language: js  # Use 'js' not 'ts' for local build
    host: function
    hooks:
      prepackage:
        shell: sh
        run: npm run build
```

## See Also

- [azure-yaml.md](azure-yaml.md) - Azure.yaml configuration for TypeScript Functions
- [functions-templates.md](functions-templates.md) - Function template selection
