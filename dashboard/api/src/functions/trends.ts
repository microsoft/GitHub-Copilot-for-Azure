import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { query } from "../db.js";

/**
 * GET /api/trends?days=7
 * Returns pass rate per skill per run for charting.
 */
app.http("trends", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "trends",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const days = parseInt(request.query.get("days") || "7", 10);

    const result = await query(
      `
      SELECT
        wr.id AS "runId",
        wr.started_at AS "runDate",
        tr.skill,
        COUNT(*) AS "totalTests",
        COUNT(*) FILTER (WHERE tr.status = 'passed') AS "passed",
        COUNT(*) FILTER (WHERE tr.status = 'failed') AS "failed",
        COUNT(*) FILTER (WHERE tr.status = 'error') AS "errors",
        ROUND(
          COUNT(*) FILTER (WHERE tr.status = 'passed')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
          1
        ) AS "passRate",
        wr.html_url AS "runUrl"
      FROM test_results tr
      JOIN workflow_runs wr ON tr.run_id = wr.id
      WHERE wr.started_at >= NOW() - make_interval(days => $1)
      GROUP BY wr.id, wr.started_at, tr.skill, wr.html_url
      ORDER BY wr.started_at, tr.skill
      `,
      [days]
    );

    return {
      status: 200,
      jsonBody: result.rows,
    };
  },
});
