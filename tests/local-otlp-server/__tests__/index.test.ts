import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOtlpServer } from "../index.ts";

describe("local OTLP HTTP server", () => {
  let server: ReturnType<typeof createOtlpServer>;
  let endpoint: string;
  const controllers: AbortController[] = [];

  beforeEach(async () => {
    server = createOtlpServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    for (const controller of controllers.splice(0)) controller.abort();
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  });

  function post(path: string, body: string, headers: Record<string, string> = {}) {
    return fetch(endpoint + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  }

  async function subscribe() {
    const controller = new AbortController();
    controllers.push(controller);
    const response = await fetch(endpoint + "/events", { signal: controller.signal });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    let pending = "";
    return async () => {
      while (!pending.includes("\n\n")) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("SSE connection closed before an event arrived");
        pending += new TextDecoder().decode(chunk.value);
      }
      const boundary = pending.indexOf("\n\n");
      const frame = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      return frame;
    };
  }

  it("serves the local website", async () => {
    const response = await fetch(endpoint);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('new EventSource("/events")');
  });

  it.each([
    ["traces", "resourceSpans"],
    ["metrics", "resourceMetrics"],
    ["logs", "resourceLogs"],
  ])("accepts and streams %s without changing payloads", async (signal, field) => {
    const next = await subscribe();
    expect(await next()).toBe("event: snapshot\ndata: []");
    const payload = { [field]: [{ resource: { attributes: [] } }] };
    const response = await post(`/v1/${signal}`, JSON.stringify(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    const frame = await next();
    expect(frame).toContain("event: telemetry\n");
    expect(JSON.parse(frame.split("data: ")[1])).toEqual({
      id: 1, receivedAt: expect.any(String), signal, payload,
    });
  });

  it("accepts gzip JSON and empty exports", async () => {
    const response = await fetch(endpoint + "/v1/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Encoding": "gzip" },
      body: new Uint8Array(gzipSync('{"resourceLogs":[]}')),
    });
    expect(response.status).toBe(200);
    expect((await post("/v1/traces", "{}")).status).toBe(200);
  });

  it("replays the latest 100 exports on reconnect", async () => {
    for (let index = 0; index < 101; index++) {
      expect((await post("/v1/logs", "{}")).status).toBe(200);
    }
    const next = await subscribe();
    const frame = await next();
    const events = JSON.parse(frame.split("data: ")[1]);
    expect(events).toHaveLength(100);
    expect(events[0].id).toBe(2);
    expect(events[99].id).toBe(101);
  });

  it("limits retained history by bytes as well as count", async () => {
    const body = JSON.stringify({ resourceLogs: [{ padding: "x".repeat(900_000) }] });
    for (let index = 0; index < 5; index++) {
      expect((await post("/v1/logs", body)).status).toBe(200);
    }
    const next = await subscribe();
    const events = JSON.parse((await next()).split("data: ")[1]);
    expect(events).toHaveLength(4);
    expect(events[0].id).toBe(2);
  });

  it.each([
    ["/v1/logs", "{", {}, 400],
    ["/v1/logs", "null", {}, 400],
    ["/v1/logs", "[]", {}, 400],
    ["/v1/logs", '{"resourceLogs":{}}', {}, 400],
    ["/v1/logs", '{"resourceSpans":[]}', {}, 400],
    ["/v1/logs", "invalid", { "Content-Encoding": "gzip" }, 400],
    ["/v1/logs", "{}", { "Content-Encoding": "br" }, 415],
    ["/v1/logs", "{}", { "Content-Type": "application/x-protobuf" }, 415],
    ["/missing", "{}", {}, 404],
  ])("rejects invalid export %#", async (path, body, headers, status) => {
    const response = await post(path, body, headers);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ code: status, message: expect.any(String) });
    const next = await subscribe();
    expect(await next()).toBe("event: snapshot\ndata: []");
  });

  it("rejects unsupported methods", async () => {
    const response = await fetch(endpoint + "/v1/traces");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("rejects oversized plain and decompressed requests", async () => {
    const body = JSON.stringify({ resourceLogs: ["x".repeat(1024 * 1024)] });
    expect((await post("/v1/logs", body)).status).toBe(413);
    const response = await fetch(endpoint + "/v1/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: new Uint8Array(gzipSync(body)),
    });
    expect(response.status).toBe(413);
  });

  it("rejects cross-origin and non-localhost browser access", async () => {
    expect((await post("/v1/logs", "{}", { Origin: "http://example.com" })).status).toBe(403);
    // Fetch overrides Host, so use the HTTP client to exercise rebinding protection.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(endpoint, { headers: { Host: "example.com" } }, response => {
        response.resume();
        resolve(response.statusCode);
      });
      request.on("error", reject);
      request.end();
    });
    expect(status).toBe(403);
    expect((await post("/v1/logs", "{}", { Origin: endpoint })).status).toBe(200);
  });
});
