const { randomUUID } = require("node:crypto");
const { app } = require("@azure/functions");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function observeOutboundIp(request) {
  const echoUrl = new URL(request.url);
  echoUrl.pathname = "/api/echo-client-ip";
  echoUrl.search = "";
  const response = await fetch(echoUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Outbound IP echo returned ${response.status}.`);
  }
  const body = await response.json();
  return typeof body.observedClientIp === "string" ? body.observedClientIp : "unknown";
}

app.http("outbound-api", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request, context) => {
    const correlationId = request.headers.get("x-correlation-id") || randomUUID();
    const load = request.query.get("load") || "pressure";
    const successful = load === "baseline" || load === "recovery" || load === "nat-recovery";
    let observedOutboundIp;
    let evidence;

    if (load === "capacity-pressure") {
      evidence = {
        requestCount: 1200,
        successfulRequestCount: 1008,
        failedRequestCount: 192,
        peakConcurrentConnections: 80,
        newConnectionCount: 12,
        reusedConnectionCount: 1188,
        errorBreakdown: {
          EADDRNOTAVAIL: 105,
          ETIMEDOUT: 87,
        },
      };
    } else if (successful) {
      evidence = {
          requestCount: 80,
          successfulRequestCount: 80,
          failedRequestCount: 0,
          peakConcurrentConnections: 12,
          newConnectionCount: 8,
          reusedConnectionCount: 72,
          errorBreakdown: {},
        };
    } else {
      evidence = {
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
    }

    if (load === "nat-recovery") {
      observedOutboundIp = await observeOutboundIp(request);
    }

    await delay(successful ? 50 : 1000);
    const telemetry = {
      event: load === "capacity-pressure" || load === "nat-recovery"
        ? "PartnerApiCapacityWindow"
        : "PartnerApiConnectionWindow",
      correlationId,
      destinationHostname: "api.partner.example",
      destinationPort: 443,
      load,
      elapsedMs: successful ? 50 : 1000,
      outcome: successful ? "success" : "failure",
      ...(observedOutboundIp ? { observedOutboundIp } : {}),
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
            ...(observedOutboundIp ? { observedOutboundIp } : {}),
          }
        : {
            correlationId,
            error: "Partner API requests experienced outbound connection failures.",
          },
    };
  },
});
