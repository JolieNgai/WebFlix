import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pgQuery, closePg } from "../config/postgres.js";

test("reviews enforce authenticated ownership, preserve legacy data, and validate content", async () => {
  const api = process.env.TEST_API_BASE || "http://127.0.0.1:8080";
  const title = "review-test-" + Date.now();
  const emails = [title + "-a@example.test", title + "-b@example.test"];
  const request = async (path, method = "GET", body, token) => {
    const response = await fetch(api + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json() };
  };
  const body = { movieTitle: title, rating: 4, comment: "Original comment." };
  try {
    const accounts = [];
    for (const email of emails) {
      assert.equal((await request("/api/register", "POST", { name: email, email, password: "Test-only-123!" })).status, 201);
      const login = await request("/api/login", "POST", { email, password: "Test-only-123!" });
      assert.equal(login.status, 200);
      accounts.push(login.data);
    }
    const [a,b] = accounts;
    assert.equal((await request("/api/reviews", "POST", body)).status, 401);
    const created = await request("/api/reviews", "POST", { ...body, user_id: b.user_id }, a.token);
    assert.equal(created.status, 201);
    const id = created.data.r_id;
    assert.equal(created.data.user_id, a.user_id, "Request body cannot spoof the owner");
    assert.equal((await request("/api/reviews/" + id, "PATCH", body)).status, 401);
    assert.equal((await request("/api/reviews/" + id, "DELETE")).status, 401);
    assert.equal((await request("/api/reviews/" + id, "PATCH", body, b.token)).status, 404);
    assert.equal((await request("/api/reviews/" + id, "DELETE", undefined, b.token)).status, 404);
    let visible = await request("/api/reviews?movieTitle=" + encodeURIComponent(title));
    assert.equal(visible.status, 200, "Reading reviews remains public");
    assert.equal(visible.data[0].author_name, emails[0]);
    assert.equal(visible.data[0].comment, body.comment);
    const updated = await request("/api/reviews/" + id, "PATCH", { rating: 5, comment: "Edited.", user_id: b.user_id, movieTitle: "Other movie" }, a.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.data.comment, "Edited.");
    assert.equal(updated.data.movie_title, title);
    assert.equal(updated.data.user_id, a.user_id);
    assert(updated.data.updated_at);
    for (const rating of [0,6,2.5,"4"]) {
      assert.equal((await request("/api/reviews", "POST", { ...body, rating }, a.token)).status, 400);
      assert.equal((await request("/api/reviews/" + id, "PATCH", { ...body, rating }, a.token)).status, 400);
    }
    for (const comment of ["   ","x".repeat(5001)]) assert.equal((await request("/api/reviews", "POST", { ...body, comment }, a.token)).status, 400);
    assert.equal((await request("/api/reviews/not-an-id", "DELETE", undefined, a.token)).status, 400);
    const legacy = await pgQuery("INSERT INTO reviews (movie_title, rating, comment) VALUES ($1, 3, 'Legacy data') RETURNING r_id", [title]);
    const schema = fs.readFileSync(new URL("../../database/create_table.sql", import.meta.url), "utf8");
    await pgQuery(schema);
    await pgQuery(schema);
    const preserved = await pgQuery("SELECT user_id, comment FROM reviews WHERE r_id = $1", [legacy.rows[0].r_id]);
    assert.equal(preserved.rows[0].user_id, null);
    assert.equal(preserved.rows[0].comment, "Legacy data");
    assert.equal((await request("/api/reviews/" + legacy.rows[0].r_id, "PATCH", body, a.token)).status, 404);
    assert.equal((await request("/api/reviews/" + legacy.rows[0].r_id, "DELETE", undefined, a.token)).status, 404);
    await assert.rejects(pgQuery("INSERT INTO reviews (user_id, movie_title, rating, comment) VALUES (2147483647, $1, 3, 'Bad owner')", [title]), error => error.code === "23503");
    assert.equal((await request("/api/reviews/" + id, "DELETE", undefined, a.token)).status, 200);
    visible = await request("/api/reviews?movieTitle=" + encodeURIComponent(title));
    assert.equal(visible.data.length, 1);
    assert.equal(visible.data[0].r_id, legacy.rows[0].r_id);
  } finally {
    await pgQuery("DELETE FROM reviews WHERE movie_title = $1", [title]);
    await pgQuery("DELETE FROM users WHERE u_email = ANY($1::text[])", [emails]);
    await closePg();
  }
});
