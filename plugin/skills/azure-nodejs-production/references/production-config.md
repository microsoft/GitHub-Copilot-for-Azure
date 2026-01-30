# Production Configuration

Production-ready Express for Azure Container Apps/App Service.

```javascript
const express = require('express');
const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.json());
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Server on port ${port}`));
```

## Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| Trust proxy | `app.set('trust proxy', 1)` | Trust Azure load balancer |
| Cookie secure | `secure: isProduction` | HTTPS only in production |
| Cookie sameSite | `'lax'` | Required for Azure proxy |
| Port binding | `'0.0.0.0'` | Not localhost |
| Health check | `GET /health` | Container Apps readiness |

## Environment Detection

```javascript
const isAzure = process.env.WEBSITE_SITE_NAME || process.env.CONTAINER_APP_NAME;
```
