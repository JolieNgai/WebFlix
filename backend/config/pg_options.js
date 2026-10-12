import "./env.js";

// Cloud connections retain SSL by default; Compose explicitly disables it
// for PostgreSQL on its private development network.
export function getPgOptions(env = process.env) {
  const ssl = env.PGSSL === "false" ? false : { rejectUnauthorized: env.PGSSL_REJECT_UNAUTHORIZED !== "false" };
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL, ssl };
  if (!env.PGPASSWORD) throw new Error("Set DATABASE_URL or PGPASSWORD for PostgreSQL.");
  return {
    host: env.PGHOST || "localhost",
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE || "userdb",
    user: env.PGUSER || "postgres",
    password: env.PGPASSWORD || "",
    ssl,
  };
}
