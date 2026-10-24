import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { validateRequestIdentity } from "../requestIdentity";
import { getAppServiceQuotas } from "../appServiceQuotas";

async function getQuotasHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const unauthorizedResponse = validateRequestIdentity(request, context, "getQuotas");
    if (unauthorizedResponse) {
        return unauthorizedResponse;
    }

    try {
        return {
            status: 200,
            jsonBody: await getAppServiceQuotas(),
        };
    } catch (err) {
        context.error("Failed to query App Service quotas:", err);
        return {
            status: 500,
            jsonBody: { error: "Failed to query App Service quotas" },
        };
    }
}

app.http("getQuotas", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "quotas",
    handler: getQuotasHandler,
});
