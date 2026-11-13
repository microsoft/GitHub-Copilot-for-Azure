const { randomUUID } = require("node:crypto");
const dns = require("node:dns").promises;
const { app } = require("@azure/functions");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobClient } = require("@azure/storage-blob");

const credential = new DefaultAzureCredential();

app.http("read-blob", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request, context) => {
    const correlationId = request.headers.get("x-correlation-id") || randomUUID();
    const blobUrl = process.env.TEST_STORAGE_BLOB_URL;
    const hostname = process.env.TEST_STORAGE_HOSTNAME;
    const startedAt = Date.now();
    let resolvedIp;

    try {
      if (!blobUrl || !hostname) {
        throw new Error("Test storage configuration is incomplete.");
      }

      resolvedIp = (await dns.lookup(hostname)).address;
      const blobClient = new BlobClient(blobUrl, credential, {
        keepAliveOptions: {
          enable: false,
        },
        retryOptions: {
          maxTries: 2,
          tryTimeoutInMs: 3000,
        },
      });
      const content = await blobClient.downloadToBuffer(0, undefined, {
        abortSignal: AbortSignal.timeout(8000),
      });

      context.log(JSON.stringify({
        event: "FlexVnetBlobRead",
        correlationId,
        destinationHostname: hostname,
        resolvedIp,
        elapsedMs: Date.now() - startedAt,
        outcome: "success",
      }));

      return {
        status: 200,
        headers: {
          "content-type": "text/plain",
          "x-correlation-id": correlationId,
          "x-resolved-ip": resolvedIp,
        },
        body: content.toString("utf8"),
      };
    } catch (error) {
      context.error(JSON.stringify({
        event: "FlexVnetBlobRead",
        correlationId,
        destinationHostname: hostname,
        resolvedIp,
        elapsedMs: Date.now() - startedAt,
        exceptionType: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        outcome: "failure",
      }));

      return {
        status: 503,
        headers: {
          "content-type": "application/json",
          "x-correlation-id": correlationId,
          ...(resolvedIp ? { "x-resolved-ip": resolvedIp } : {}),
        },
        jsonBody: {
          correlationId,
          error: "Test storage is unavailable.",
        },
      };
    }
  },
});
