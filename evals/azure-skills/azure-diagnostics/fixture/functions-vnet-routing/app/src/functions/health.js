const { app } = require("@azure/functions");

app.http("health", {
  methods: ["GET"],
  authLevel: "function",
  handler: async () => ({
    status: 200,
    jsonBody: {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  }),
});
