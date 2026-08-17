# Panic Recovery in Goroutines — Go

An unrecovered panic in **any** goroutine terminates the entire worker process, failing every concurrent invocation across every function on that worker. Always guard goroutines you start yourself.

**Best-effort work** (`sdk.Recover`) — fire-and-forget, keeps the worker alive:

```go
go func() {
    defer sdk.Recover(ctx)  // must be the FIRST defer (runs LAST)
    defer wg.Done()
    warmCache(ctx)
}()
```

**Failure-propagating work** (`sdk.RecoverTo` — preferred pattern uses `errgroup`):

```go
import "golang.org/x/sync/errgroup"

func onEventHub(ctx context.Context, events []bindings.EventHubMessage) error {
    g, ctx := errgroup.WithContext(ctx)
    for _, e := range events {
        e := e
        g.Go(func() (err error) {
            defer sdk.RecoverTo(ctx, &err)
            return process(ctx, e)
        })
    }
    return g.Wait() // non-nil -> invocation fails -> host retries
}
```

See [retry-semantics.md](./retry-semantics.md) for how the returned error is interpreted by the host.
