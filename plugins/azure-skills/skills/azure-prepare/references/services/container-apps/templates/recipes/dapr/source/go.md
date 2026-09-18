# Dapr with Go

Use `net/http` against the local sidecar:

```go
port := os.Getenv("DAPR_HTTP_PORT")
if port == "" { port = "3500" }
body := strings.NewReader(`{"orderId":"123"}`)
req, _ := http.NewRequest(http.MethodPost,
    "http://localhost:"+port+"/v1.0/publish/pubsub/orders", body)
req.Header.Set("Content-Type", "application/json")
resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
if err != nil { return err }
defer resp.Body.Close()
if resp.StatusCode >= 300 { return fmt.Errorf("dapr publish: %s", resp.Status) }
```

Apply the same status and timeout handling to invocation, state, and secrets calls.
