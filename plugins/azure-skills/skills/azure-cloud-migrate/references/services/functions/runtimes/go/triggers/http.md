# HTTP Trigger — Go

```go
import (
    "net/http"
    "github.com/azure/azure-functions-golang-worker/sdk"
    "github.com/azure/azure-functions-golang-worker/worker"
)

func hello(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write([]byte("Hello from Go!"))
}

func main() {
    app := sdk.FunctionApp()
    app.HTTP("hello", hello,
        sdk.WithMethods("GET", "POST"),
        sdk.WithAuth("anonymous"),
        // sdk.WithRoute("users/{id}"),
    )
    worker.Start(app)
}
```

> The HTTP output binding is attached implicitly — write the response via `http.ResponseWriter`.

> **HTTP middleware and streaming.** For wrapping handlers with middleware (timing, tracing, auth), see the upstream [`samples/middleware`](https://github.com/Azure/azure-functions-golang-worker/tree/main/samples/middleware) sample. For streaming responses (Server-Sent Events, large-object downloads, chunked transfer), see [`samples/httpStreaming`](https://github.com/Azure/azure-functions-golang-worker/tree/main/samples/httpStreaming) — the HTTP path uses a real loopback `http.Server`, so `http.Flusher`, chunked encoding, and trailers work natively.
