import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { query } from "../db.js";

/**
 * GET /api/test-history?test_name=...&days=7
 * Returns chronological history for a specific test.
 */
app.http("test-history", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "test-history",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const testName = request.query.get("test_name");
    const days = parseInt(request.query.get("days") || "7", 10);

    if (!testName) {
      return { status: 400, jsonBody: { error: "test_name is required" } };
    }

    const result = await query(
      `
      SELECT
        tr.run_id AS "runId",
        wr.started_at AS "runDate",
        tr.status,
        tr.duration_secs AS "duration",
        tr.confidence,
        tr.failure_message AS "failureMessage",
        wr.html_url AS "runUrl",
        jr.html_url AS "jobUrl"
      FROM test_results tr
      JOIN workflow_runs wr ON tr.run_id = wr.id
      LEFT JOIN job_results jr ON tr.job_id = jr.id
      WHERE tr.test_name = $1
        AND wr.started_at >= NOW() - make_interval(days => $2)
      ORDER BY wr.started_at DESC
      `,
      [testName, days]
    );

    return {
      status: 200,
      jsonBody: result.rows,
    };
  },
});
