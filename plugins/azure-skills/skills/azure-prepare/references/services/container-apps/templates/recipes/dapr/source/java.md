# Dapr with Java

Use `java.net.http.HttpClient` against the local sidecar:

```java
String port = System.getenv().getOrDefault("DAPR_HTTP_PORT", "3500");
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("http://localhost:" + port + "/v1.0/publish/pubsub/orders"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString("{\"orderId\":\"123\"}"))
    .build();
HttpResponse<String> response = HttpClient.newHttpClient()
    .send(request, HttpResponse.BodyHandlers.ofString());
if (response.statusCode() >= 300) {
    throw new IllegalStateException("Dapr publish failed: " + response.statusCode());
}
```
