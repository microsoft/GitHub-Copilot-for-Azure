/**
 * Start from the repository root with Node 22.14+:
 *   cd tests
 *   npx tsx local-otlp-server/index.ts
 *
 * Open http://127.0.0.1:4318. Set PORT to override the default port.
 * Export to OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 with
 * OTEL_EXPORTER_OTLP_PROTOCOL=http/json. Stop with Ctrl+C.
 * See ./README.md for a sample export and supported endpoints.
 */
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

const unzip = promisify(gunzip);
const maxBodyBytes = 1024 * 1024;
const maxHistoryBytes = 4 * 1024 * 1024;
const signals = {
  "/v1/traces": "resourceSpans",
  "/v1/metrics": "resourceMetrics",
  "/v1/logs": "resourceLogs",
} as const;

interface TelemetryEvent {
  id: number;
  receivedAt: string;
  signal: string;
  payload: Record<string, unknown>;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createOtlpServer() {
  const clients = new Set<ServerResponse>();
  const history: { event: TelemetryEvent; bytes: number }[] = [];
  let historyBytes = 0;
  let nextId = 0;

  function send(client: ServerResponse, event: string, data: unknown) {
    if (client.destroyed) {
      clients.delete(client);
      return;
    }
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (client.writableLength > 8 * 1024 * 1024) {
      client.destroy();
      clients.delete(client);
    }
  }

  const server = createServer((request, response) => {
    const handle = async () => {
      // Reject cross-origin browser access and DNS rebinding to this local receiver.
      const host = request.headers.host;
      if (!host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
        throw new HttpError(403, "Only localhost requests are allowed");
      }
      if (request.headers.origin && request.headers.origin !== `http://${host}`) {
        throw new HttpError(403, "Cross-origin requests are not allowed");
      }
      const path = request.url?.split("?")[0];
      if (request.method === "GET" && path === "/") {
        const html = await readFile(new URL("./index.html", import.meta.url));
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        });
        response.end(html);
        return;
      }
      if (request.method === "GET" && path === "/events") {
        if (clients.size >= 20) {
          throw new HttpError(503, "Too many live viewers");
        }
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.flushHeaders();
        clients.add(response);
        send(response, "snapshot", history.map(({ event }) => event));
        const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15_000);
        response.on("close", () => {
          clearInterval(heartbeat);
          clients.delete(response);
        });
        return;
      }
      if (!path || !Object.hasOwn(signals, path)) {
        throw new HttpError(404, "Not found");
      }
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        throw new HttpError(405, "Use POST for OTLP exports");
      }
      const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        throw new HttpError(415, "Use OTLP HTTP/JSON (application/json), not gRPC or protobuf");
      }
      const encoding = request.headers["content-encoding"]?.toLowerCase();
      if (encoding && encoding !== "identity" && encoding !== "gzip") {
        throw new HttpError(415, "Only identity and gzip content encodings are supported");
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > maxBodyBytes) {
          throw new HttpError(413, "Export exceeds the 1 MiB request limit");
        }
        chunks.push(buffer);
      }
      let body: Buffer = Buffer.concat(chunks);
      if (encoding === "gzip") {
        try {
          body = await unzip(body, { maxOutputLength: maxBodyBytes });
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ERR_BUFFER_TOO_LARGE") {
            throw new HttpError(413, "Decompressed export exceeds the 1 MiB limit");
          }
          throw new HttpError(400, "Invalid gzip body");
        }
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body.toString("utf8"));
      } catch {
        throw new HttpError(400, "Invalid JSON body");
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new HttpError(400, "Expected an OTLP JSON object");
      }
      const field = signals[path as keyof typeof signals];
      if (Object.keys(payload).some(key => key !== field)) {
        throw new HttpError(400, `Expected an OTLP export containing ${field}`);
      }
      if (field in payload && !Array.isArray(Reflect.get(payload, field))) {
        throw new HttpError(400, `${field} must be an array`);
      }
      const event: TelemetryEvent = {
        id: ++nextId,
        receivedAt: new Date().toISOString(),
        signal: path.slice(4),
        payload: payload as Record<string, unknown>,
      };
      const bytes = Buffer.byteLength(JSON.stringify(event));
      history.push({ event, bytes });
      historyBytes += bytes;
      while (history.length > 100 || historyBytes > maxHistoryBytes) {
        historyBytes -= history.shift()!.bytes;
      }
      for (const client of clients) {
        send(client, "telemetry", event);
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
    };

    void handle().catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : "Internal server error";
      console.error(`[OTLP] ${request.method} ${request.url}:`, error);
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return;
      }
      response.writeHead(status, { "Content-Type": "application/json", "Connection": "close" });
      response.end(JSON.stringify({ code: status, message }));
    });
  });
  server.on("close", () => {
    for (const client of clients) {
      client.destroy();
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? "4318");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const server = createOtlpServer();
  server.on("error", error => {
    console.error("Unable to start local OTLP server:", error);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`OTLP viewer: http://127.0.0.1:${port}`);
    console.log(`Export with OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:${port} and OTEL_EXPORTER_OTLP_PROTOCOL=http/json`);
  });
  const shutdown = () => {
    server.close();
    server.closeAllConnections();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}