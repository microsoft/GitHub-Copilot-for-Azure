const { app } = require("@azure/functions");

app.generic("orderProcessingOrchestrator", {
  trigger: app.trigger.generic({ type: "orchestrationTrigger" }),
  handler: async (ctx) => {
    const order = ctx.getInput();

    const validationResult = await ctx.callActivity("validateOrder", order);
    if (!validationResult.success) {
      return { status: "rejected", reason: validationResult.reason };
    }

    const paymentResult = await ctx.callActivity("processPayment", {
      orderId: order.orderId,
      amount: order.amount,
    });

    await ctx.callActivity("sendConfirmation", {
      orderId: order.orderId,
      email: order.customerEmail,
      paymentId: paymentResult.paymentId,
    });

    return {
      status: "completed",
      orderId: order.orderId,
      paymentId: paymentResult.paymentId,
    };
  },
});
