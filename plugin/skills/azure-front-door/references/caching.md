# Caching Behavior and Configuration

## How Front Door Caching Works

Front Door caches content at edge POPs (Points of Presence) worldwide. When a request hits an edge POP:

1. **Cache lookup** — Is the content in the POP's cache?
2. **Cache HIT** — Return cached content directly (no origin request)
3. **Cache MISS** — Forward request to origin, cache the response, return to client

## Cache Configuration

Caching is configured per route.

### Enable Caching on a Route

```bash
az afd route create \
  --route-name cachedRoute \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --origin-group myOriginGroup \
  --supported-protocols Https \
  --patterns-to-match "/static/*" "/*.css" "/*.js" "/*.png" \
  --forwarding-protocol HttpsOnly \
  --enable-caching true \
  --query-string-caching-behavior IgnoreQueryString
```

### Cache Duration

Front Door determines cache duration in this order:

1. **Rules engine override** — RouteConfigurationOverride action
2. **Route-level cache duration** — Explicit TTL on the route config
3. **Origin response headers** — `Cache-Control` or `Expires` headers from origin
4. **Default** — If no cache headers from origin, Front Door uses built-in defaults

| Origin Header | Caching Behavior |
|---------------|-----------------|
| `Cache-Control: public, max-age=3600` | Cached for 3600 seconds |
| `Cache-Control: private` | Not cached by Front Door |
| `Cache-Control: no-cache` | Revalidated on each request |
| `Cache-Control: no-store` | Not cached |
| `Expires: <date>` | Cached until expiry date |
| No cache headers | Default: 1-3 days (varies by content type) |

## Query String Handling

| Mode | Behavior | Best For |
|------|----------|----------|
| IgnoreQueryString | Same cache entry regardless of query params | Static assets |
| UseQueryString | Each unique query string is a separate cache entry | Dynamic content with query params |
| IgnoreSpecifiedQueryStrings | Ignore listed params, cache on others | Strip tracking params |
| IncludeSpecifiedQueryStrings | Cache only on listed params, ignore others | Known meaningful params |

```bash
# Update route to use specific query string behavior
az afd route update \
  --route-name myRoute \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --query-string-caching-behavior UseQueryString
```

## Cache Purge

Remove content from all edge caches before it expires.

### Purge Operations

```bash
# Purge specific path
az afd endpoint purge \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --content-paths "/images/logo.png"

# Purge directory
az afd endpoint purge \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --content-paths "/css/*"

# Purge everything
az afd endpoint purge \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --content-paths "/*"

# Purge multiple paths
az afd endpoint purge \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --content-paths "/js/*" "/css/*" "/images/*"
```

### Purge Considerations

- Purge propagates to all global edge POPs (may take a few minutes)
- Purge is by URL path, not by cache key (includes all query string variants)
- Wildcard `*` purges all content under that path
- No way to purge by response header or tag (unlike some CDN providers)

## Compression

Front Door can compress content at the edge to reduce transfer size.

### Supported Compression Types

- gzip
- brotli (preferred, better compression ratio)

### Enabling Compression

Compression is enabled at the route level. Front Door compresses content when:
- Client sends `Accept-Encoding: gzip` or `Accept-Encoding: br`
- Response content type is compressible (text, JSON, JavaScript, CSS, etc.)
- Response size is between 1 KB and 8 MB

```bash
az afd route update \
  --route-name myRoute \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --enable-compression true
```

### Default Compressible Content Types

- `text/plain`, `text/html`, `text/css`, `text/javascript`
- `application/javascript`, `application/json`, `application/xml`
- `application/x-javascript`
- `image/svg+xml`

## Caching Best Practices

### Static Assets

```
Pattern: /static/*, /*.css, /*.js, /*.png, /*.jpg, /*.woff2
Query string: IgnoreQueryString
Cache duration: 7-30 days (use versioned file names for cache busting)
Compression: Enabled
```

### API Responses

```
Pattern: /api/*
Caching: Usually disabled (dynamic content)
Exception: Cache GET requests for read-heavy APIs with short TTL (30-300 seconds)
Query string: UseQueryString (if enabled)
```

### HTML Pages

```
Pattern: /*.html, /
Cache duration: Short (5-60 minutes) or no-cache
Query string: IgnoreQueryString
Note: Use Cache-Control: no-cache for personalized content
```

### Cache Busting Strategies

| Strategy | How It Works | Example |
|----------|-------------|---------|
| File versioning | Version in filename | `style.v2.css`, `app.20240115.js` |
| Query string version | Version in query param | `style.css?v=2` (requires UseQueryString) |
| Content hash | Hash in filename | `style.abc123.css` |
| Purge on deploy | Purge cache after deployment | CI/CD pipeline purge step |

## Monitoring Cache Performance

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Cache Hit Ratio | % of requests served from cache | > 80% for static sites |
| Origin Request Count | Requests forwarded to origin | Lower is better |
| Byte Hit Ratio | % of bytes served from cache | > 80% for static sites |
| Total Latency | Edge to client response time | < 50ms for cached content |

```bash
# View cache hit ratio
az monitor metrics list \
  --resource <fd-resource-id> \
  --metric "PercentageOfCacheHit" \
  --aggregation Average \
  --interval PT1H
```

## Source Documentation

- [Caching with Azure Front Door](https://learn.microsoft.com/azure/frontdoor/front-door-caching)
- [Cache purge](https://learn.microsoft.com/azure/frontdoor/front-door-caching#cache-purge)
- [Compression](https://learn.microsoft.com/azure/frontdoor/front-door-caching#compression)
