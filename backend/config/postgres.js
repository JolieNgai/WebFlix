import pkg from "pg";
const { Pool } = pkg;

import { getPgOptions } from "./pg_options.js";

const pool = new Pool(getPgOptions());

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
