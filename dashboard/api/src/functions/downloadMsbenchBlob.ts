import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { EXCLUDED_FILENAMES } from "../blobEnumerator";
import { getMsbenchBlobContent } from "../msbenchBlobEnumerator";
import { validateRequestIdentity } from "../requestIdentity";

/**
 * Returns the raw content of a specific blob from the msbench storage account.
 * GET /api/msbench-download?path={blobPath}
 */
async function downloadMsbenchBlob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const unauthorizedResponse = validateRequestIdentity(request, context, "downloadMsbenchBlob");
    if (unauthorizedResponse) {
        return unauthorizedResponse;
    }

    const blobPath = request.query.get("path");
    if (!blobPath) {
        return { status: 400, body: "Missing 'path' query parameter" };
    }

    // Prevent directory traversal
    if (blobPath.includes("..")) {
        return { status: 400, body: "Invalid path" };
    }

    const rawFileName = blobPath.split("/").pop() ?? "";
    if (EXCLUDED_FILENAMES.has(rawFileName)) {
        return { status: 404, body: "Blob not found" };
    }

    try {
        const content = await getMsbenchBlobContent(blobPath);
        const fileName = (rawFileName || "download").replace(/[\r\n"\\]/g, "_");

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
