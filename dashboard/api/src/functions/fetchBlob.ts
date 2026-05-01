import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getBlobBuffer } from "../blobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

/**
 * Returns the raw bytes of a specific blob (no Content-Disposition).
 * Useful for loading binary assets (e.g. images) directly via <img src>.
 * GET /api/fetch?path={blobPath}
 */
async function fetchBlob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "fetchBlob");

    const blobPath = request.query.get("path");
    if (!blobPath) {
        return { status: 400, body: "Missing 'path' query parameter" };
    }

    // Prevent directory traversal
    if (blobPath.includes("..")) {
        return { status: 400, body: "Invalid path" };
    }

    try {
        const buffer = await getBlobBuffer(blobPath);
        return {
            status: 200,
            headers: {
                "Content-Type": "application/octet-stream",
            },
            body: buffer,
        };
    } catch {
        return { status: 404, body: "Blob not found" };
    }
}

app.http("fetchBlob", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "fetch",
    handler: fetchBlob,
});
