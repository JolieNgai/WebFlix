import { Client } from "pg";
import { getPgOptions } from "../config/pg_options.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
async function main() {
  const client = new Client(getPgOptions());

  try {
    console.log("connecting to postgresql");
    await client.connect();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const schemaPath = path.join(__dirname, "..", "..", "database", "create_table.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    console.log("running schema");
    await client.query(schemaSql);
    console.log("schema done");

    console.log("db initialised");

  } catch (err) {
    console.error("error during db init:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();