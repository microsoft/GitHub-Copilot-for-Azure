const { app } = require("@azure/functions");

app.http("echo-client-ip", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request) => {
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const observedClientIp = forwardedFor.split(",")[0].trim()
      || request.headers.get("x-azure-socketip")
      || "unknown";

    return {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
      jsonBody: {
        observedClientIp,
      },
    };
  },
});
