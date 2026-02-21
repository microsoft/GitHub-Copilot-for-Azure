# Post-Generation Updates

> **MANDATORY**: After creating or adding any Azure Function, perform these three steps.

## 1. File Naming Convention

Name function source files after their **route or purpose**, not the generic trigger type.

| Route / Purpose | ✅ Correct filename | ❌ Avoid |
|-----------------|---------------------|---------|
| `/api/random` | `src/functions/random.js` | `httpTrigger.js` |
| `/api/users` | `src/functions/users.js` | `httpTrigger.js` |
| `/api/health` | `src/functions/health.js` | `httpTrigger.js` |
| Cosmos DB change feed | `src/functions/cosmosProcessor.js` | `function1.js` |
| Scheduled job | `src/functions/dailyReport.js` | `timerTrigger.js` |

**Rules:**
- Derive the name from the route segment (e.g., `/api/random` → `random`) or the purpose (e.g., `dailyReport`)
- Use camelCase for multi-word names (e.g., `userProfile.js`, `orderProcessor.js`)
- Trigger-type suffixes are optional; prefer the shortest descriptive name
- Do **not** use generic names like `httpTrigger`, `function1`, or `index` unless unavoidable

## 2. README Update

After adding a new function, update (or create) the project's `README.md`:

1. **Add to endpoints table** – include function name, route, method, auth level, and description
2. **Add curl example** – provide a ready-to-run `curl` command for local and deployed testing
3. **Document env variables** – list any new environment variables the function requires

### Template

````markdown
## Available Endpoints

| Function | Route | Method | Auth | Description |
|----------|-------|--------|------|-------------|
| `<functionName>` | `/api/<route>` | GET/POST | anonymous/function | <description> |

### Test locally

```bash
curl http://localhost:7071/api/<route>
```

### Test deployed

```bash
curl https://<functionapp>.azurewebsites.net/api/<route>
```
````

### Example (route `/api/random`)

````markdown
## Available Endpoints

| Function | Route | Method | Auth | Description |
|----------|-------|--------|------|-------------|
| `random` | `/api/random` | GET | anonymous | Returns a random number |

### Test locally

```bash
curl http://localhost:7071/api/random
```

### Test deployed

```bash
curl https://<functionapp>.azurewebsites.net/api/random
```
````

## 3. Test File Updates

After adding a new function, update the project's test files.

### If a `test.http` file exists

Append a request block for the new function:

```http
### <FunctionName> - local
GET http://localhost:7071/api/<route>

### <FunctionName> - deployed
GET https://{{functionAppName}}.azurewebsites.net/api/<route>
```

For POST endpoints, include a body:

```http
### <FunctionName> POST - local
POST http://localhost:7071/api/<route>
Content-Type: application/json

{
  "key": "value"
}
```

### If a `testdata.json` (or similar data file used with curl) exists

Append an entry for the new function's expected input/output:

```json
{
  "<functionName>": {
    "route": "/api/<route>",
    "method": "GET",
    "expectedStatus": 200
  }
}
```

### If neither `test.http` nor a testdata file exists

Create a `test.http` file at the project root with a request block for the new function (see template above).
