# Go — Azure Functions Go Worker Triggers & Bindings

> **Model**: [`github.com/azure/azure-functions-golang-worker`](https://github.com/Azure/azure-functions-golang-worker) (**preview**).
> No `function.json` — triggers are declared in code via `sdk.FunctionApp()` + functional options.
> Entry point: `main.go` calling `worker.Start(app)`.
> Requires **Azure Functions Core Tools ≥ 4.12** (`npm i -g azure-functions-core-tools@4 --unsafe-perm true`).

## Project Layout

**`main.go`, `go.mod`, and `host.json` must live in the same directory** (project root). `func start` runs `go build` from `host.json`'s directory — `.go` files under `src/` produce `no Go files in <dir>` and the build fails. Sub-packages go in `internal/<role>/`. This overrides the generic `src/` layout in [lambda-to-functions.md § Project Structure](../lambda-to-functions.md#project-structure). Full layout, anti-pattern, and rules → [go/project-layout.md](./go/project-layout.md).

## Project Setup

Run these commands **from the project root** (see [Project Layout](#project-layout)):

```bash
func init --worker-runtime go
# Discover available versions first, then pin explicitly (see note below).
go list -m -versions github.com/azure/azure-functions-golang-worker
go get github.com/azure/azure-functions-golang-worker@main
go mod tidy
```

`func init --worker-runtime go` generates `host.json`, `local.settings.json`, and `.gitignore`. Verified templates + per-setting reference → [go/setup-templates.md](./go/setup-templates.md).

> ⚠️ **Never hand-author `require ... v0.0.0`** — the module is preview-only, has no `v0.0.0` tag, and sub-packages share the parent's version (no separate `require` lines). Let `go get @main` (or `@vX.Y.Z-preview`) resolve it. Full guidance → [go/version-pinning.md](./go/version-pinning.md).

## Lambda Migration Rules

> Shared rules (bindings over SDKs, latest runtime, identity-first auth) → [global-rules.md](../global-rules.md)

Go-specific:
- **`main.go`, `go.mod`, `host.json` co-located at project root** — never `src/`. See [Project Layout](#project-layout).
- **Non-HTTP output bindings unsupported** — use the Azure SDK for Go with `DefaultAzureCredential`.
- **Wrap every user-spawned goroutine** with `sdk.Recover` / `sdk.RecoverTo`. An unrecovered panic crashes the whole worker.
- Prefer **core triggers**. Use the **Blob extension trigger** (blank import) only when you need a live `*blob.Client` for streaming.
- Log with `slog.InfoContext(ctx, ...)`. The SDK's handler attaches `invocation_id`, `function_name`, `trigger_type` automatically.

## Triggers

Each entry links to a runnable `main.go`-style sample. All non-HTTP handlers return `error` — see [Handler Return Values & Retry Semantics](#handler-return-values--retry-semantics) for what the value means.

| Trigger | SDK method | Sample |
| --- | --- | --- |
| HTTP | `app.HTTP` | [triggers/http.md](./go/triggers/http.md) |
| Blob Storage (extension) | `app.Blob` | [triggers/blob.md](./go/triggers/blob.md) |
| Queue Storage | `app.Queue` | [triggers/queue.md](./go/triggers/queue.md) |
| Timer | `app.Timer` | [triggers/timer.md](./go/triggers/timer.md) |
| Event Grid | `app.EventGrid` | [triggers/event-grid.md](./go/triggers/event-grid.md) |
| Cosmos DB (change feed) | `app.CosmosDB` | [triggers/cosmos.md](./go/triggers/cosmos.md) |
| Service Bus (queue / topic) | `app.ServiceBusQueue`, `app.ServiceBusTopic` | [triggers/service-bus.md](./go/triggers/service-bus.md) |
| Event Hubs | `app.EventHub` | [triggers/event-hubs.md](./go/triggers/event-hubs.md) |
| SQL (change tracking) | `app.SQL` | [triggers/sql.md](./go/triggers/sql.md) |

## I/O Outside of Triggers — Use the Azure SDK for Go

The Go worker is **triggers-only by design** — no input bindings, no non-HTTP output bindings. This is the intentional exception to the "bindings over SDKs" rule in [global-rules.md](../global-rules.md); all non-HTTP I/O uses the Azure SDK for Go with `DefaultAzureCredential`.

## SDK Patterns for I/O

Ground rules (credentials, client lifetime, URL app settings) and per-service samples (Blob, Queue, Table, Cosmos, Service Bus, Event Hubs, Event Grid) → [go/sdk-patterns/README.md](./go/sdk-patterns/README.md).

## Core vs Extension Triggers

Most triggers are **core** (typed payload in gRPC message, no external SDK). **Blob** is the only extension trigger — requires blank import and streaming via `azblob`. Decision table → [go/core-vs-extension.md](./go/core-vs-extension.md).

## Handler Return Values & Retry Semantics

Non-HTTP handlers return `error`; the Functions host interprets the value according to the trigger's built-in retry behavior or configured function-level retry policy. Full per-trigger table (Storage Queue → `<name>-poison`, Service Bus → DLQ, Event Grid → 24 h backoff, Event Hubs / Cosmos → function-level retry policies) → [go/retry-semantics.md](./go/retry-semantics.md).

## Panic Recovery in Goroutines

An unrecovered panic in **any** goroutine terminates the entire worker process and fails every concurrent invocation. Always guard user-spawned goroutines with `sdk.Recover` (best-effort) or `sdk.RecoverTo` (propagates as handler error, triggers host retry). Full patterns including `errgroup` composition → [go/panic-recovery.md](./go/panic-recovery.md).

## Logging

The SDK installs an `slog` handler at package init. Records automatically carry `invocation_id`, `function_name`, `trigger_type`.

```go
slog.InfoContext(ctx, "processed order", "order_id", id, "amount", amount)
```

Richer metadata (trace parent, retry count) via `sdk.FromContext(ctx)`. Distributed tracing → upstream [`samples/otelTracing`](https://github.com/Azure/azure-functions-golang-worker/tree/main/samples/otelTracing), [`samples/collectorToAzureMonitor`](https://github.com/Azure/azure-functions-golang-worker/tree/main/samples/collectorToAzureMonitor).

## Build & Hosting Constraints

- **Hosting plan**: Flex Consumption only.
- **Binary format**: Linux ELF named **exactly `app`** (lowercase, no extension) at the deployment zip root. Host executes `/home/site/wwwroot/app` — any other name/location fails to start. `func pack` produces this; for hand-builds see [go/deployment.md § Hand-building the binary](./go/deployment.md#hand-building-the-binary).
- **`CGO_ENABLED=0`** — Flex Consumption base image has no C toolchain. Pick pure-Go alternatives (e.g., non-cgo SQLite driver).

## Local Run & Deployment

```bash
func start           # auto-compiles the Go module, hosts locally
func pack            # cross-compiles (`CGO_ENABLED=0 GOOS=linux GOARCH=amd64`) and packages an app-at-root zip
```

The `func pack` zip works with any Functions deployment path (`azd deploy`, `func azure functionapp publish`, `az functionapp deployment source config-zip`). Full deploy commands and the Windows/`Compress-Archive` executable-bit gotcha → [go/deployment.md](./go/deployment.md).

> Full reference: [Azure Functions Go developer guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-go) — and the [azure-functions-golang-worker README](https://github.com/Azure/azure-functions-golang-worker) / [samples/](https://github.com/Azure/azure-functions-golang-worker/tree/main/samples) for the preview SDK surface.
