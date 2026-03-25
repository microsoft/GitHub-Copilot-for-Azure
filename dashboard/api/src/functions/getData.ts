import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { enumerateBlobs } from "../blobEnumerator";

/**
 * SWA Managed API endpoint that returns skill test report.
 * 
 * The report files have the following patterns.
 * 
 * For all skills other than "azure-deploy":
 * 1. ${DATE}/${RUN_ID}/{skill-name}/test-run-{datetime}-{skill-name}-SKILL-REPORT.md
 * 2. ${DATE}/${RUN_ID}/{skill-name}/testResults.json
 * 3. ${DATE}/${RUN_ID}/{skill-name}/token-summary.jsonl
 * 4. ${DATE}/${RUN_ID}/{skill-name}/{arbitrary-test-case-name}/test-consolidated-report.md
 * 5. ${DATE}/${RUN_ID}/{skill-name}/{arbitrary-test-case-name}/agent-metadata-{datetime}{optional-dedupe-suffix}.md
 * 6. ${DATE}/${RUN_ID}/{skill-name}/{arbitrary-test-case-name}/agent-metadata.json
 * 7. ${DATE}/${RUN_ID}/{skill-name}/{arbitrary-test-case-name}/token-usage.json
 * 
 * The test-run-{datetime}-{skill-name}-SKILL-REPORT.md is unique per skill. It is a summarized version of the result of all test runs in its job.
 * The test-consolidated-report.md is unique per test case. It is a summarized version of the result of all agent runs for its test case.
 * The agent-metadata-{datetime}{optional-dedupe-suffix}.md captures the details of each agent run for its test case.
 * token-usage.json and agent-metadata.json should not be exposed for now.
 * 
 * For azure-deploy skill:
 * 1. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/test-run-{datetime}-{skill-name}-SKILL-REPORT.md
 * 2. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/testResults.json
 * 3. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/token-summary.jsonl
 * 4. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/{arbitrary-test-case-name}/test-consolidated-report.md
 * 5. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/{arbitrary-test-case-name}/agent-metadata-{datetime}{optional-dedupe-suffix}.md
 * 6. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/{arbitrary-test-case-name}/agent-metadata.json
 * 7. ${DATE}/${RUN_ID}/{skill-name}/{test-group}/{arbitrary-test-case-name}/token-usage.json
 * 
 * All ${DATE} are in the format of yyyy-mm-dd.
 */
async function getData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const date = request.params.date;
    if (!date) {
        return { status: 400, body: "Missing date parameter" };
    }

    const root = await enumerateBlobs(`${date}/`);

    return {
        status: 200,
        jsonBody: root,
    };
}

app.http("getData", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "data/{date}",
    handler: getData,
});
