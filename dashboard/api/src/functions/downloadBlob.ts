import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getBlobContent } from "../blobEnumerator";

/**
 * Returns the raw content of a specific blob for download.
 * GET /api/download?path={blobPath}
 */
async function downloadBlob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const blobPath = request.query.get("path");
    if (!blobPath) {
        return { status: 400, body: "Missing 'path' query parameter" };
    }

    // Prevent directory traversal
    if (blobPath.includes("..")) {
        return { status: 400, body: "Invalid path" };
    }

    try {
        const content = await getBlobContent(blobPath);
        const fileName = blobPath.split("/").pop() ?? "download";

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

app.http("downloadBlob", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "download",
    handler: downloadBlob,
});
