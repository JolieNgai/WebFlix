import express from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/env.js";
const jwtSecret = getJwtSecret();

import { pgQuery } from "../config/postgres.js";
import { registerUser, loginUser } from "../services/user_services.js";

export const authRouter = express.Router();

// ========== REGISTER ==========
authRouter.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Missing name, email or password" });
  }

  try {
    const result = await registerUser(name, email, password);

    if (!result.ok) {
      // e.g. email already exists
      return res.status(400).json({ error: result.message });
    }

    return res.status(201).json({ message: "User registered successfully" });
  } catch (e) {
    console.error("Register error:", e);
    return res.status(500).json({ error: "Server Error" });
  }
});

// ========== LOGIN ==========
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const result = await loginUser(email, password);

    if (!result.ok) {
      return res.status(400).json({ error: result.message });
    }

    const userId = result.user.id; // from user_services.js

    const token = jwt.sign(
      { user_id: userId },
      jwtSecret,
      { expiresIn: "1h" }
    );

    return res.status(200).json({ token, user_id: userId });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({ error: "Server Error" });
  }
});

// ========== VERIFY TOKEN ==========
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: " missing or invalid authorization header" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = { id: decoded.user_id };
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ========== CURRENT USER PROFILE ==========
authRouter.get("/user/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pgQuery(
      "SELECT u_id, u_name, u_email FROM users WHERE u_id = $1",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];

    res.json({
      id: row.u_id,
      name: row.u_name,
      email: row.u_email,
    });

  } catch (err) {
    console.error("Get /user/me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});