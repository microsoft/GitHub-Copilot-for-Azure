import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getHealthData } from "../blobEnumerator";

/**
 * Returns the non-integration health dashboard data (data/latest.json)
 * from the "non-integration" blob container.
 * GET /api/static
 */
async function getHealthDataHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const data = await getHealthData();
        if (data === null) {
            return { status: 404, body: "Health data not found" };
        }
        return {
            status: 200,
            jsonBody: data,
        };
    } catch (err) {
        context.error("Failed to read health data:", err);
        return { status: 500, body: "Failed to read health data" };
    }
}

app.http("getHealthData", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "static",
    handler: getHealthDataHandler,
});
