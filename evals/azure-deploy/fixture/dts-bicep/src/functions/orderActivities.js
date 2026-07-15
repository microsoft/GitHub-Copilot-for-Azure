const { app } = require("@azure/functions");

app.generic("validateOrder", {
  trigger: app.trigger.generic({ type: "activityTrigger" }),
  handler: async (order) => {
    if (!order.orderId || !order.amount || order.amount <= 0) {
      return { success: false, reason: "Invalid order: missing orderId or invalid amount" };
    }
    if (!order.customerEmail) {
      return { success: false, reason: "Invalid order: missing customer email" };
    }
    return { success: true };
  },
});

app.generic("processPayment", {
  trigger: app.trigger.generic({ type: "activityTrigger" }),
  handler: async ({ orderId, amount }) => {
    const paymentId = `pay-${orderId}-${Date.now()}`;
    return { paymentId, orderId, amount, processedAt: new Date().toISOString() };
  },
});

app.generic("sendConfirmation", {
  trigger: app.trigger.generic({ type: "activityTrigger" }),
  handler: async ({ orderId, email, paymentId }) => {
    return { sent: true, orderId, email, paymentId };
  },
});
