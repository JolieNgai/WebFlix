import dotenv from "dotenv";
dotenv.config({ path: "./postgre.env" }); 

import { Client } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

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