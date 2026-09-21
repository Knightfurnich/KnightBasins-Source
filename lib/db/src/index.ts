import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.ts";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// node-postgres crashes the whole process on an unhandled 'error' event from
// an idle client (e.g. the database container restarting) unless a listener
// is registered — see https://node-postgres.com/apis/pool#error
pool.on("error", (error) => {
  console.error("Unexpected error on idle Postgres client", error);
});

export const db = drizzle(pool, { schema });

export * from "./schema/index.ts";
