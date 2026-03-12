import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { query } from "../db.js";

/**
 * GET /api/summary?days=7
 * Returns aggregated pass rate per test over the lookback window.
 */
app.http("summary", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "summary",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const days = parseInt(request.query.get("days") || "7", 10);

    const result = await query(
      `
      WITH stats AS (
        SELECT
          tr.skill,
          tr.test_name,
          tr.test_type,
          COUNT(*) AS total_runs,
          COUNT(*) FILTER (WHERE tr.status = 'passed') AS passed,
          COUNT(*) FILTER (WHERE tr.status = 'failed') AS failed,
          COUNT(*) FILTER (WHERE tr.status = 'error') AS errors,
          COUNT(*) FILTER (WHERE tr.status = 'skipped') AS skipped,
          ROUND(COUNT(*) FILTER (WHERE tr.status = 'passed')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS pass_rate,
          ROUND(AVG(tr.duration_secs)::NUMERIC, 1) AS avg_duration,
          ROUND(AVG(tr.confidence)::NUMERIC, 3) AS avg_confidence
        FROM test_results tr
        JOIN workflow_runs wr ON tr.run_id = wr.id
        WHERE wr.started_at >= NOW() - make_interval(days => $1)
        GROUP BY tr.skill, tr.test_name, tr.test_type
      ),
      latest AS (
        SELECT DISTINCT ON (tr.skill, tr.test_name)
          tr.skill,
          tr.test_name,
          tr.status AS last_status,
          wr.started_at AS last_run_date
        FROM test_results tr
        JOIN workflow_runs wr ON tr.run_id = wr.id
        WHERE wr.started_at >= NOW() - make_interval(days => $1)
        ORDER BY tr.skill, tr.test_name, wr.started_at DESC
      ),
      trends AS (
        SELECT
          tr.skill,
          tr.test_name,
          ARRAY_AGG(tr.status ORDER BY wr.started_at) AS trend
        FROM test_results tr
        JOIN workflow_runs wr ON tr.run_id = wr.id
        WHERE wr.started_at >= NOW() - make_interval(days => $1)
        GROUP BY tr.skill, tr.test_name
      )
      SELECT
        s.skill,
        s.test_name AS "testName",
        s.test_type AS "testType",
        s.total_runs AS "totalRuns",
        s.passed,
        s.failed,
        s.errors,
        s.skipped,
        s.pass_rate AS "passRate",
        s.avg_duration AS "avgDuration",
        s.avg_confidence AS "avgConfidence",
        l.last_status AS "lastStatus",
        l.last_run_date AS "lastRunDate",
        t.trend
      FROM stats s
      LEFT JOIN latest l ON s.skill = l.skill AND s.test_name = l.test_name
      LEFT JOIN trends t ON s.skill = t.skill AND s.test_name = t.test_name
      ORDER BY s.skill, s.test_name
      `,
      [days]
    );

    return {
      status: 200,
      jsonBody: result.rows,
    };
  },
});
