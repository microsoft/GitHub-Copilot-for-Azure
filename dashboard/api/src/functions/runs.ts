import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { query } from "../db.js";

/**
 * GET /api/runs?days=7
 * Returns list of workflow runs with aggregated test stats.
 */
app.http("runs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "runs",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const days = parseInt(request.query.get("days") || "7", 10);

    const result = await query(
      `
      SELECT
        wr.id,
        wr.run_number AS "runNumber",
        wr.trigger_type AS "triggerType",
        wr.branch,
        wr.conclusion,
        wr.started_at AS "startedAt",
        wr.completed_at AS "completedAt",
        wr.html_url AS "htmlUrl",
        COUNT(tr.id) AS "totalTests",
        COUNT(tr.id) FILTER (WHERE tr.status = 'passed') AS "passed",
        COUNT(tr.id) FILTER (WHERE tr.status = 'failed') AS "failed"
      FROM workflow_runs wr
      LEFT JOIN test_results tr ON tr.run_id = wr.id
      WHERE wr.started_at >= NOW() - make_interval(days => $1)
      GROUP BY wr.id
      ORDER BY wr.started_at DESC
      `,
      [days]
    );

    return {
      status: 200,
      jsonBody: result.rows,
    };
  },
});
