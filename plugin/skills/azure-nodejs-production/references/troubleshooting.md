# Common Issues and Fixes

## Cookies Not Setting

**Symptom:** Session lost between requests

**Fix:**
1. Add `app.set('trust proxy', 1)`
2. Set `sameSite: 'lax'` in cookie config
3. Set `secure: true` only if using HTTPS

## Wrong Client IP

**Symptom:** `req.ip` returns Azure internal IP

**Fix:**
```javascript
app.set('trust proxy', 1);
// Now req.ip returns actual client IP
```

## HTTPS Redirect Loop

**Symptom:** Infinite redirects when forcing HTTPS

**Fix:**
```javascript
// Check x-forwarded-proto, not req.secure; use trusted host to avoid open redirects
const TRUSTED_HOST = process.env.APP_PUBLIC_HOSTNAME;
app.use((req, res, next) => {
  if (req.get('x-forwarded-proto') !== 'https' && TRUSTED_HOST) {
    return res.redirect(`https://${TRUSTED_HOST}${req.originalUrl}`);
  }
  next();
});
```

## Health Check Failing

**Symptom:** Container restarts repeatedly

**Fix:**
1. Ensure `/health` endpoint returns 200
2. Check app starts within startup probe timeout
3. Verify port matches container configuration

## Configure Health Probes

```bash
az containerapp update \
  --name APP \
  --resource-group RG \
  --health-probe-path /health \
  --health-probe-interval 30
```
