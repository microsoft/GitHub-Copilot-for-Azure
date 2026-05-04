import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { listDates } from "../blobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

/**
 * Returns the list of available date prefixes (yyyy-mm-dd) in descending order.
 * GET /api/dates
 */
async function getDates(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getDates");

    const dates = await listDates();

    return {
        status: 200,
        jsonBody: dates,
    };
}

app.http("getDates", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "dates",
    handler: getDates,
});
