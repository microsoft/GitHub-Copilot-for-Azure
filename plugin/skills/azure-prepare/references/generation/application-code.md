# Application Code Generation

Generate production-ready application scaffolding.

## TASK

Create or update application code structure for Azure deployment readiness.

## Directory Structure

```
src/
├── <component-name>/        # One per component
│   ├── Dockerfile           # If containerized
│   ├── package.json         # Or equivalent
│   └── ...
└── shared/                  # Shared libraries (optional)
```

## Essential Elements

Every application component must include:

### 1. Entry Point

```javascript
// Node.js example
const express = require('express');
const app = express();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### 2. Health Check Endpoint

```javascript
// GET /health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// GET /ready (optional, for readiness probes)
app.get('/ready', async (req, res) => {
  // Check dependencies
  const dbReady = await checkDatabase();
  if (dbReady) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});
```

### 3. Environment Configuration

```javascript
// config.js
module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  // Never hardcode secrets
};
```

### 4. Azure SDK Integration

```javascript
// For Application Insights
const appInsights = require('applicationinsights');
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup().start();
}
```

### 5. Error Handling

```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
```

## Language-Specific Templates

### Node.js (Express)

```
src/api/
├── package.json
├── src/
│   ├── index.js          # Entry point
│   ├── config.js         # Environment config
│   ├── routes/           # API routes
│   └── middleware/       # Express middleware
├── Dockerfile
└── .dockerignore
```

**package.json essentials:**

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "applicationinsights": "^2.9.1"
  }
}
```

### Python (FastAPI)

```
src/api/
├── requirements.txt
├── src/
│   ├── main.py           # Entry point
│   ├── config.py         # Environment config
│   ├── routers/          # API routers
│   └── models/           # Pydantic models
├── Dockerfile
└── .dockerignore
```

**main.py essentials:**

```python
from fastapi import FastAPI
import os

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
```

### .NET (ASP.NET Core)

```
src/api/
├── Api.csproj
├── Program.cs            # Entry point
├── appsettings.json      # Configuration
├── Controllers/          # API controllers
├── Dockerfile
└── .dockerignore
```

**Program.cs essentials:**

```csharp
var builder = WebApplication.CreateBuilder(args);

// Add Application Insights
builder.Services.AddApplicationInsightsTelemetry();

var app = builder.Build();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
```

## Security Requirements

### Forbidden

- ❌ Secrets in code
- ❌ Hardcoded connection strings
- ❌ Committed .env files

### Required

- ✅ Environment variables for configuration
- ✅ .env.example with placeholder values
- ✅ .gitignore excluding sensitive files

## Checklist Format

Document in Preparation Manifest:

```markdown
## Application Code Checklist

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| user-api | src/user-api | ✅ Generated | Node.js/Express |
| web-frontend | src/web | ✅ Preserved | Existing React app |
| order-worker | src/worker | ✅ Generated | Python |
```
