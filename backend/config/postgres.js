import pkg from "pg";
const { Pool } = pkg;

// Build config from env with safe defaults
const pgConfig = {
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "userdb",
  user: process.env.PGUSER ?? "postgres",
  // force password to always be a string
  password:
    process.env.PGPASSWORD !== undefined
      ? String(process.env.PGPASSWORD)
      : "joliengai",
};

console.log("🔌 PG config (masked):", {
  host: pgConfig.host,
  port: pgConfig.port,
  database: pgConfig.database,
  user: pgConfig.user,
  password: pgConfig.password ? "***" : "(none)",
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // <-- turn SSL on
});


// Generic query helper
export async function pgQuery(text, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// Health check used by /health
export async function pgHealth() {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    return result.rows[0].ok === 1;
  } catch (e) {
    console.error("PostgreSQL health check failed:", e.message);
    return false;
  }
}

// Called on shutdown
export async function closePg() {
  await pool.end();
}
