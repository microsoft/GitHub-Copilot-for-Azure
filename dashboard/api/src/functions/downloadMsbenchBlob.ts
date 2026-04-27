import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getMsbenchBlobContent } from "../msbenchBlobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

/**
 * Returns the raw content of a specific blob from the msbench storage account.
 * GET /api/msbench-download?path={blobPath}
 */
async function downloadMsbenchBlob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "downloadMsbenchBlob");

    const blobPath = request.query.get("path");
    if (!blobPath) {
        return { status: 400, body: "Missing 'path' query parameter" };
    }

    // Prevent directory traversal
    if (blobPath.includes("..")) {
        return { status: 400, body: "Invalid path" };
    }

    try {
        const content = await getMsbenchBlobContent(blobPath);
        const rawFileName = blobPath.split("/").pop() ?? "download";
        const fileName = rawFileName.replace(/[\r\n"\\]/g, "_");

        return {
            status: 200,
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
            body: content,
        };
    } catch {
        return { status: 404, body: "Blob not found" };
    }
}

app.http("downloadMsbenchBlob", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "msbench-download",
    handler: downloadMsbenchBlob,
});
