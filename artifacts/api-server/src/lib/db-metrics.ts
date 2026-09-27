// Database health & connection pool metrics for GET /api/admin/database/health
// (job-114). Mirrors lib/db-health.ts's lazy-import approach so route tests can
// inject a stub checker without needing DATABASE_URL set at all -- @workspace/db
// throws at import time if it's missing.
const CORE_TABLES = ["customer_leads", "customer_accounts", "payment_slips"] as const;

export type DatabaseHealthStatus = "healthy" | "degraded";

export type DatabaseHealthMetrics = {
  status: DatabaseHealthStatus;
  latencyMs: number;
  database: "postgres";
  timestamp: string;
  tablesCount: number;
};

/** Any failure (connection refused, timeout, missing DATABASE_URL, etc.) degrades to a safe zero-metrics response rather than throwing. */
export async function checkDatabaseHealth(): Promise<DatabaseHealthMetrics> {
  const startedAt = Date.now();
  try {
    const { pool } = await import("@workspace/db");
    await pool.query("SELECT current_timestamp");
    const latencyMs = Date.now() - startedAt;

    const tablesResult = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [CORE_TABLES],
    );
    const tablesCount = tablesResult.rows.length;

    return {
      status: tablesCount === CORE_TABLES.length ? "healthy" : "degraded",
      latencyMs,
      database: "postgres",
      timestamp: new Date().toISOString(),
      tablesCount,
    };
  } catch {
    return {
      status: "degraded",
      latencyMs: Date.now() - startedAt,
      database: "postgres",
      timestamp: new Date().toISOString(),
      tablesCount: 0,
    };
  }
}
