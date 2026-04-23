import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { enumerateMsbenchBlobs } from "../msbenchBlobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

/**
 * Returns the blob tree for a given date from the msbench storage account.
 * GET /api/msbench-data/{date}
 */
async function getMsbenchData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getMsbenchData");

    const date = request.params.date;
    if (!date) {
        return { status: 400, body: "Missing date parameter" };
    }

    const root = await enumerateMsbenchBlobs(`${date}/`);

    return {
        status: 200,
        jsonBody: root,
    };
}

app.http("getMsbenchData", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "msbench-data/{date}",
    handler: getMsbenchData,
});
