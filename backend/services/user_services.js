import bcrypt from "bcrypt";
import { pgQuery } from "../config/postgres.js";

const SALT_ROUNDS = 10;

export async function registerUser(username, email, plainPassword) {
  const existing = await pgQuery(
    "SELECT u_id FROM users WHERE u_email = $1", [email]
  );
  if (existing.rowCount > 0) {
    return { ok: false, message: "Email already registered."};
  }

  const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

  await pgQuery(
    "INSERT INTO users (u_name, u_email, u_password_hash) VALUES ($1, $2, $3)", [username, email, hash]
  );

  return { ok: true, message: "Registered successfully" };
}

export async function loginUser(email, plainPassword) {
  const res = await pgQuery(
    "SELECT u_id, u_name, u_password_hash FROM users WHERE u_email = $1", [email]
  );

  if (res.rowCount === 0) {
    return { ok: false, message: "Invalid email or password" };
  }

  const user = res.rows[0];
  const match = await bcrypt.compare(plainPassword, user.u_password_hash);

  if (!match) return { ok: false, message: "Invalid email or password" };

  return {
    ok: true,
    user: { id: user.u_id, username: user.u_name, email },
  };
}