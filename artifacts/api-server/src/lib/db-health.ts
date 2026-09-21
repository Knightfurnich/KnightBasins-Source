export type DatabaseHealth = { connected: boolean };

// Imports @workspace/db lazily (only when actually invoked) so route tests
// can inject a stub ping function without needing DATABASE_URL set at all —
// @workspace/db throws at import time if it's missing.
export async function pingDatabase(): Promise<DatabaseHealth> {
  try {
    const { pool } = await import("@workspace/db");
    await pool.query("SELECT 1");
    return { connected: true };
  } catch {
    return { connected: false };
  }
}
