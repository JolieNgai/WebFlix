import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { pgQuery, closePg } from "../config/postgres.js";

test("watchlist persists enriched movies, isolates accounts, and handles stale references", async () => {
  const api = process.env.TEST_API_BASE || "http://127.0.0.1:8080";
  const marker = "watchlist-test-" + Date.now();
  const emails = [marker + "-a@example.test", marker + "-b@example.test"];
  const mongo = new MongoClient(process.env.MONGODB_URI || process.env.MONGO_URI);
  const movieId = new ObjectId();
  const request = async (path, method = "GET", body, token) => {
    const response = await fetch(api + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    await mongo.connect();
    const movies = mongo.db(process.env.DB_NAME || "inf2003_db").collection("movies_metadata");
    await movies.insertOne({ _id: movieId, title: marker + ' <film>', release_date: "2024-01-01", genres: ["Drama"], overview: "A test movie.", poster_path: "/fixture.jpg", vote_average: 8 });
    const tokens = [];
    for (const email of emails) {
      assert.equal((await request("/api/register", "POST", { name: marker, email, password: "Test-only-123!" })).status, 201);
      const login = await request("/api/login", "POST", { email, password: "Test-only-123!" });
      assert.equal(login.status, 200);
      tokens.push(login.data.token);
    }
    const [a,b] = tokens;
    assert.equal((await request("/api/watchlist")).status, 401);
    assert.equal((await request("/api/watchlist/add", "POST", { movie_id: "invalid" }, a)).status, 400);
    assert.equal((await request("/api/watchlist/add", "POST", { movie_id: new ObjectId().toString() }, a)).status, 404);
    for (let i=0;i<2;i++) assert.equal((await request("/api/watchlist/add", "POST", { movie_id: movieId.toString() }, a)).status, 201);
    const saved = await request("/api/watchlist", "GET", undefined, a);
    assert.equal(saved.data.length, 1);
    assert.equal(saved.data[0].title, marker + ' <film>');
    assert.equal(saved.data[0].movie_id, movieId.toString());
    assert.equal(saved.data[0].year, 2024);
    assert.deepEqual(saved.data[0].genres, ["Drama"]);
    assert.equal(saved.data[0].poster_url, "https://image.tmdb.org/t/p/w500/fixture.jpg");
    assert.equal(saved.data[0].unavailable, false);
    assert.equal((await request("/api/watchlist", "GET", undefined, b)).data.length, 0);
    await request("/api/watchlist/remove", "DELETE", { movie_id: movieId.toString() }, b);
    assert.equal((await request("/api/watchlist", "GET", undefined, a)).data.length, 1);
    await movies.deleteOne({ _id: movieId });
    const stale = await request("/api/watchlist", "GET", undefined, a);
    assert.equal(stale.data[0].unavailable, true);
    assert.equal(stale.data[0].title, "Movie no longer available");
    assert.equal((await request("/api/watchlist/remove", "DELETE", { movie_id: movieId.toString() }, a)).status, 200);
    assert.equal((await request("/api/watchlist", "GET", undefined, a)).data.length, 0);
    // Existing malformed references must remain viewable and removable.
    const user = await pgQuery("SELECT u_id FROM users WHERE u_email = $1", [emails[0]]);
    await pgQuery("INSERT INTO watchlist (user_id, movie_id) VALUES ($1, $2)", [user.rows[0].u_id, "legacy-key"]);
    assert.equal((await request("/api/watchlist", "GET", undefined, a)).data[0].unavailable, true);
    assert.equal((await request("/api/watchlist/remove", "DELETE", { movie_id: "legacy-key" }, a)).status, 200);
    assert.equal((await request("/api/watchlist", "GET", undefined, a)).data.length, 0);
  } finally {
    await mongo.db(process.env.DB_NAME || "inf2003_db").collection("movies_metadata").deleteOne({ _id: movieId });
    await pgQuery("DELETE FROM users WHERE u_email = ANY($1::text[])", [emails]);
    await mongo.close();
    await closePg();
  }
});
