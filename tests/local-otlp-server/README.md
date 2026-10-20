# Local OTLP viewer

An in-memory HTTP/JSON receiver with a live browser UI. No build is required.

## Start the server

With Node 22.14+, run from the repository root:

```bash
cd tests
npx tsx local-otlp-server/index.ts
```

Open <http://127.0.0.1:4318>. Set `PORT` to change the port.
For example, from `tests/`:

```bash
PORT=14318 npx tsx local-otlp-server/index.ts
```

Stop with Ctrl+C.

`npx` downloads `tsx` on first use if it is not installed. To run without it,
use `node --experimental-strip-types local-otlp-server/index.ts` from `tests/`.

## Send telemetry

The receiver binds only to IPv4 loopback. It accepts JSON (including gzip)
at `/v1/traces`, `/v1/metrics`, and `/v1/logs`. It does not support gRPC or
HTTP/protobuf; unsupported content types return HTTP 415.

For Copilot SDK, just configure these:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

For Claude Code/SDK, configure all these environment variables:

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

The base endpoint is for exporters that append `/v1/<signal>`. Signal-specific
endpoint variables must include the full path. For Copilot SDK test runs, the
runner also forwards `OTEL_EXPORTER_OTLP_ENDPOINT` to the SDK's telemetry options.

## Use the viewer

The UI shows spans with duration bars, metric values, and log records. Filter by
signal or search payloads; select a row for full resource/scope/record JSON.
Server-Sent Events push updates and replay retained exports on reconnect.
Pause freezes rendering, not ingestion; clear resets only the current tab.

Storage is temporary: at most 100 exports / 4 MiB on the server, with a
1 MiB compressed and decompressed request limit. The browser shows up to 1,000
records from its retained exports. Older data is evicted; nothing is written
to disk. Cross-origin browser requests are blocked. This is a local debugging
utility, not a production collector; telemetry may contain sensitive data.

## Validation

From `tests/`:

```bash
npm test -- local-otlp-server/__tests__/index.test.ts
npm run lint -- local-otlp-server/index.ts local-otlp-server/__tests__/index.test.ts
npm run typecheck
```
