import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// All entry points read the same project-root file. Shell/deployment variables win.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

export function getMongoOptions(env = process.env) {
  const uri = env.MONGODB_URI || env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is required.");
  return { uri, database: env.DB_NAME || "inf2003_db" };
}

export function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return secret;
}
