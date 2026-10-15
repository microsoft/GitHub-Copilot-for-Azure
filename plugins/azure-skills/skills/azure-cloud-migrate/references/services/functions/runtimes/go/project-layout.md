# Project Layout

> **Overrides [lambda-to-functions.md § Project Structure](../../lambda-to-functions.md#project-structure).** The `src/`-based layout there is a JS/Python convention and breaks Go builds.

`main.go` and `go.mod` **must sit next to `host.json`** at the project root. `func start` runs `go build` from `host.json`'s directory; `.go` files elsewhere are invisible.

## Required

```
myapp/
├── go.mod
├── go.sum
├── main.go              # entry — calls worker.Start(app)
├── host.json
├── local.settings.json
└── internal/            # OPTIONAL sub-packages
    ├── handlers/http.go
    └── store/cosmos.go
```

## Anti-pattern (breaks `func start`)

```
myapp/
├── host.json            # build root
├── go.mod
└── src/
    └── main.go          # invisible — build fails
```

Error: `no Go files in <build root>` → `Go build failed with exit code 1.`

## Rules

- **Never use `src/`** — not idiomatic Go, not recognized by `go build`. Matches [go.dev module layout](https://go.dev/doc/modules/layout) and [worker samples](https://github.com/Azure/azure-functions-golang-worker/tree/main/samples).
- Sub-packages go in **`internal/<role>/`** (compiler-private) or top-level named packages (`handlers/`, `store/`). Name by role, not generic buckets.
- Exactly one `go.mod` per app, at project root.
- Run all `func` and `go` commands from project root.
- **Wrapper directory naming**: when the Function app lives inside a wrapper (e.g., alongside migration reports at `<workspace>-azure/`), name it `func/` or the service name — **never `app/`** (collides with the required binary name `app`, invites hand-zip mistakes like `zip -r deploy.zip app` producing the wrong archive shape). Update `azure.yaml`'s `project:` to match (e.g., `project: ./func`).
