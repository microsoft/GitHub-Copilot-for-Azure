const { randomUUID } = require("node:crypto");
const { app } = require("@azure/functions");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

app.http("outbound-api", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request, context) => {
    const correlationId = request.headers.get("x-correlation-id") || randomUUID();
    const load = request.query.get("load") || "pressure";
    const successful = load === "baseline" || load === "recovery";
    const evidence = successful
      ? {
          requestCount: 80,
          successfulRequestCount: 80,
          failedRequestCount: 0,
          peakConcurrentConnections: 12,
          newConnectionCount: 8,
          reusedConnectionCount: 72,
          errorBreakdown: {},
        }
      : {
          requestCount: 1200,
          successfulRequestCount: 428,
          failedRequestCount: 772,
          peakConcurrentConnections: 640,
          newConnectionCount: 1189,
          reusedConnectionCount: 11,
          errorBreakdown: {
            EADDRNOTAVAIL: 493,
            ETIMEDOUT: 279,
          },
        };

    await delay(successful ? 50 : 1000);
    const telemetry = {
      event: "PartnerApiConnectionWindow",
      correlationId,
      destinationHostname: "api.partner.example",
      destinationPort: 443,
      load,
      elapsedMs: successful ? 50 : 1000,
      outcome: successful ? "success" : "failure",
      ...evidence,
    };
    if (successful) {
      context.log(JSON.stringify(telemetry));
    } else {
      context.error(JSON.stringify(telemetry));
    }

    return {
      status: successful ? 200 : 503,
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      jsonBody: successful
        ? {
            correlationId,
            status: "partner API requests completed",
          }
        : {
            correlationId,
            error: "Partner API requests experienced outbound connection failures.",
          },
    };
  },
});
