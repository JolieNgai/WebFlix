import test from "node:test";
import assert from "node:assert/strict";
import { getMongoOptions, getJwtSecret } from "../config/env.js";
import { getPgOptions } from "../config/pg_options.js";

test("configuration requires supplied secrets instead of credential defaults", () => {
  assert.throws(() => getMongoOptions({}), /MONGODB_URI/);
  assert.throws(() => getPgOptions({}), /DATABASE_URL or PGPASSWORD/);
  assert.throws(() => getJwtSecret({}), /32 characters/);
  assert.throws(() => getJwtSecret({ JWT_SECRET: "short" }), /32 characters/);
  const options = getPgOptions({ PGHOST: "postgres", PGPASSWORD: "test-fixture", PGSSL: "false" });
  assert.equal(options.host, "postgres");
  assert.equal(options.password, "test-fixture");
  assert.equal(options.ssl, false);
  assert.deepEqual(getPgOptions({ DATABASE_URL: "postgresql://example/db" }).ssl, { rejectUnauthorized: true });
  assert.deepEqual(getMongoOptions({ MONGODB_URI: "mongodb://mongo:27017", DB_NAME: "custom" }), { uri: "mongodb://mongo:27017", database: "custom" });
});

test("Docker receives generated secrets and uses the local database configuration", () => {
  assert.match(process.env.JWT_SECRET, /^[0-9a-f]{64}$/);
  assert.match(process.env.PGPASSWORD, /^[0-9a-f]{64}$/);
  assert.equal(getJwtSecret(), process.env.JWT_SECRET);
  assert.equal(getPgOptions().password, process.env.PGPASSWORD);
  assert.equal(getPgOptions().ssl, false);
  assert.equal(getMongoOptions().uri, "mongodb://mongo:27017");
});
