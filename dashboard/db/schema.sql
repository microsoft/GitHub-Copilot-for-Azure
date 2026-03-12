-- Integration Test Dashboard Schema
-- Azure PostgreSQL Flexible Server
-- Run this to initialize the database.

-- Each "Integration Tests - all" workflow run
CREATE TABLE IF NOT EXISTS workflow_runs (
    id              BIGINT PRIMARY KEY,          -- GitHub run_id (databaseId)
    run_number      INT NOT NULL,
    trigger_type    VARCHAR(50) NOT NULL,         -- schedule | workflow_dispatch
    cron_schedule   VARCHAR(20),                  -- e.g., "0 12 * * *"
    branch          VARCHAR(255) NOT NULL,
    commit_sha      VARCHAR(40),
    status          VARCHAR(50) NOT NULL,         -- completed, failure, etc.
    conclusion      VARCHAR(50),                  -- success, failure, cancelled
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    html_url        TEXT NOT NULL,
    collected_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Each job within a workflow run (one per skill)
CREATE TABLE IF NOT EXISTS job_results (
    id              BIGINT PRIMARY KEY,          -- GitHub job_id (databaseId)
    run_id          BIGINT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    skill           VARCHAR(100) NOT NULL,
    status          VARCHAR(50) NOT NULL,
    conclusion      VARCHAR(50),                 -- success, failure, skipped
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    html_url        TEXT
);

-- Individual test cases from JUnit XML (integration + trigger tests)
CREATE TABLE IF NOT EXISTS test_results (
    id              SERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    job_id          BIGINT REFERENCES job_results(id) ON DELETE SET NULL,
    skill           VARCHAR(100) NOT NULL,
    suite_name      VARCHAR(500),
    test_name       VARCHAR(1000) NOT NULL,
    classname       VARCHAR(500),
    test_type       VARCHAR(20) NOT NULL DEFAULT 'integration',  -- integration | trigger
    status          VARCHAR(20) NOT NULL,        -- passed, failed, error, skipped
    duration_secs   FLOAT,
    failure_message TEXT,
    confidence      FLOAT,                       -- trigger test confidence (0-1), NULL for integration
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_results_run_id ON job_results(run_id);
CREATE INDEX IF NOT EXISTS idx_job_results_skill ON job_results(skill);
CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_skill ON test_results(skill);
CREATE INDEX IF NOT EXISTS idx_test_results_test_name ON test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_test_results_skill_status ON test_results(skill, status);

-- Useful view: latest results per test
CREATE OR REPLACE VIEW latest_test_results AS
SELECT DISTINCT ON (skill, test_name)
    tr.skill,
    tr.test_name,
    tr.test_type,
    tr.status,
    tr.duration_secs,
    tr.confidence,
    tr.failure_message,
    wr.started_at AS run_date,
    wr.html_url AS run_url,
    jr.html_url AS job_url
FROM test_results tr
JOIN workflow_runs wr ON tr.run_id = wr.id
LEFT JOIN job_results jr ON tr.job_id = jr.id
ORDER BY skill, test_name, wr.started_at DESC;

-- Useful view: pass rate per test (last 7 days)
CREATE OR REPLACE VIEW test_pass_rates AS
SELECT
    tr.skill,
    tr.test_name,
    tr.test_type,
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE tr.status = 'passed') AS passed,
    COUNT(*) FILTER (WHERE tr.status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE tr.status = 'error') AS errors,
    COUNT(*) FILTER (WHERE tr.status = 'skipped') AS skipped,
    ROUND(
        COUNT(*) FILTER (WHERE tr.status = 'passed')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
    ) AS pass_rate,
    ROUND(AVG(tr.duration_secs)::NUMERIC, 1) AS avg_duration_secs,
    ROUND(AVG(tr.confidence)::NUMERIC, 3) AS avg_confidence
FROM test_results tr
JOIN workflow_runs wr ON tr.run_id = wr.id
WHERE wr.started_at >= NOW() - INTERVAL '7 days'
GROUP BY tr.skill, tr.test_name, tr.test_type;
