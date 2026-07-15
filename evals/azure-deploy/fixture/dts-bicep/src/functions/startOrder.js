const { app } = require("@azure/functions");

app.http("startOrder", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (request, context) => {
    const order = await request.json();
    if (!order.orderId || !order.amount || !order.customerEmail) {
      return {
        status: 400,
        jsonBody: { error: "Request must include orderId, amount, and customerEmail" },
      };
    }

    // In production, use DurableTaskSchedulerClient with the connection string.
    // For local dev, use DurableClient from @azure/durable-functions.
    context.log(`Starting order processing for orderId: ${order.orderId}`);

    return {
      status: 202,
      jsonBody: {
        orderId: order.orderId,
        message: "Order processing started",
      },
    };
  },
});
