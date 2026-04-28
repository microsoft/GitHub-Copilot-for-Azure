import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { listMsbenchDates } from "../msbenchBlobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

/**
 * Returns the list of available date prefixes (yyyy-mm-dd) from the msbench storage account.
 * GET /api/msbench-dates
 */
async function getMsbenchDates(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getMsbenchDates");

    const dates = await listMsbenchDates();

    return {
        status: 200,
        jsonBody: dates,
    };
}

app.http("getMsbenchDates", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "msbench-dates",
    handler: getMsbenchDates,
});
