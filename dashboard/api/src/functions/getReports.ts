import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { enumerateBlobs, getBlobContent, BlobTree, BlobTreeNode } from "../blobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

const SKILL_REPORT_PATTERN = /^test-run-.*-SKILL-REPORT\.md$/;

/**
 * Recursively collect all blob paths matching the SKILL-REPORT pattern from a tree node.
 */
function collectSkillReportPaths(node: BlobTreeNode): string[] {
    const paths: string[] = [];
    for (const file of node.files) {
        if (SKILL_REPORT_PATTERN.test(file.name)) {
            paths.push(file.blobName);
        }
    }
    for (const child of Object.values(node.children)) {
        paths.push(...collectSkillReportPaths(child));
    }
    return paths;
}

/**
 * Returns concatenated markdown content of all SKILL-REPORT.md files for a given date.
 * GET /api/reports/{date}
 */
async function getReports(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getReports");

    const date = request.params.date;
    if (!date) {
        return { status: 400, body: "Missing date parameter" };
    }

    const tree: BlobTree = await enumerateBlobs(`${date}/`);
    const dateNode = tree[date];
    if (!dateNode) {
        return { status: 404, body: `No reports found for date: ${date}` };
    }

    const reportPaths = collectSkillReportPaths(dateNode);
    if (reportPaths.length === 0) {
        return { status: 404, body: `No SKILL-REPORT files found for date: ${date}` };
    }

    reportPaths.sort();

    const sections: string[] = [];
    for (const path of reportPaths) {
        const content = await getBlobContent(path);
        sections.push(content);
    }

    return {
        status: 200,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
        body: sections.join("\n\n---\n\n"),
    };
}

app.http("getReports", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "reports/{date}",
    handler: getReports,
});
